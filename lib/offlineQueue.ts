import AsyncStorage from '@react-native-async-storage/async-storage'
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
      const { data: sale, error } = await supabase.from('sales').insert({
        shop_id: item.shop_id,
        created_by: item.created_by,
        total_amount: item.total_amount,
        paid_amount: item.paid_amount,
        credit_amount: item.credit_amount,
        date: item.date,
      }).select().single()

      if (error || !sale) { remaining.push(item); continue }

      await supabase.from('sale_items').insert({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.qty,
        unit_price: item.unit_price,
        total: item.total_amount,
      })

      await supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.qty })

      flushed++
    } catch {
      remaining.push(item)
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  return flushed
}
