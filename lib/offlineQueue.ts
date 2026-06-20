import AsyncStorage from '@react-native-async-storage/async-storage'
import { createSale } from '../services/sales'
import { supabase } from './supabase'

const QUEUE_KEY = 'mamashop_offline_queue'

export interface QueuedSale {
  shop_id: string
  created_by: string
  total_amount: number
  paid_amount: number
  credit_amount: number
  date: string
  product_id: string
  product_name: string
  product_unit: string
  qty: number
  unit_price: number
  pay_mode: string
  client_name: string | null
  client_key?: string   // clé d'idempotence — évite un doublon au rejeu
  queued_at: string
}

export async function addToQueue(sale: Omit<QueuedSale, 'queued_at'>) {
  const existing = await getQueue()
  existing.push({ ...sale, queued_at: new Date().toISOString() })
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing))
}

export async function getQueue(): Promise<QueuedSale[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function flushQueue(shopId: string): Promise<number> {
  const queue = await getQueue()
  if (queue.length === 0) return 0

  let flushed = 0
  const remaining: QueuedSale[] = []

  for (const item of queue) {
    try {
      // Même chemin que la vente en ligne : RPC transactionnelle (items + stock atomiques)
      const { error } = await createSale(item.shop_id, item.created_by, {
        total_amount: item.total_amount,
        paid_amount: item.paid_amount,
        credit_amount: item.credit_amount,
        date: item.date,
        pay_mode: item.pay_mode as 'cash' | 'credit' | 'mobile_money',
        client_name: item.client_name ?? undefined,
        client_key: item.client_key,
        items: [{
          product_id: item.product_id,
          quantity: item.qty,
          unit_price: item.unit_price,
          total: item.total_amount,
        }],
      })
      if (error) { remaining.push(item); continue }
      flushed++
    } catch {
      remaining.push(item)
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  return flushed
}

// ─── Stock queue ────────────────────────────────────────────────────────────

const STOCK_QUEUE_KEY = 'mamashop_stock_queue'

export interface QueuedStockEntry {
  shop_id: string
  product_id: string
  quantity: number
  cost_per_unit: number
  date: string
  supplier_id: string | null
  queued_at: string
}

export async function addStockEntryToQueue(entry: Omit<QueuedStockEntry, 'queued_at'>): Promise<void> {
  const existing = await getStockQueue()
  existing.push({ ...entry, queued_at: new Date().toISOString() })
  await AsyncStorage.setItem(STOCK_QUEUE_KEY, JSON.stringify(existing))
}

export async function getStockQueue(): Promise<QueuedStockEntry[]> {
  const raw = await AsyncStorage.getItem(STOCK_QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function flushStockQueue(shopId: string): Promise<number> {
  const queue = await getStockQueue()
  if (queue.length === 0) return 0

  let flushed = 0
  const remaining: QueuedStockEntry[] = []

  for (const item of queue) {
    try {
      const { error: entryErr } = await supabase.from('stock_entries').insert({
        shop_id: item.shop_id,
        product_id: item.product_id,
        quantity: item.quantity,
        cost_per_unit: item.cost_per_unit,
        date: item.date,
        supplier_id: item.supplier_id,
      })
      if (entryErr) { remaining.push(item); continue }

      const { error: stockErr } = await supabase
        .rpc('increment_stock', { p_id: item.product_id, qty: item.quantity })
      if (stockErr) { remaining.push(item); continue }

      flushed++
    } catch {
      remaining.push(item)
    }
  }

  await AsyncStorage.setItem(STOCK_QUEUE_KEY, JSON.stringify(remaining))
  return flushed
}
