import { supabase } from '../lib/supabase'
import { Product } from '../lib/types'

export async function getProducts(shopId: string) {
  return supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .order('name')
}

export interface StockEntryInput {
  quantity: number
  cost_per_unit: number
  supplier_id?: string | null
  driver_name?: string | null
  driver_phone?: string | null
  notes?: string | null
}

/** Enregistre un arrivage : ligne stock_entries + incrément atomique du stock (RPC). */
export async function addStockEntry(shopId: string, productId: string, entry: StockEntryInput) {
  const { error: entryErr } = await supabase.from('stock_entries').insert({
    shop_id: shopId,
    product_id: productId,
    date: new Date().toISOString().split('T')[0],
    ...entry,
  })
  if (entryErr) return { error: entryErr }

  const { error: stockErr } = await supabase
    .rpc('increment_stock', { p_id: productId, qty: entry.quantity })
  return { error: stockErr }
}

export async function createProduct(shopId: string, data: Partial<Product>) {
  return supabase
    .from('products')
    .insert({ shop_id: shopId, ...data })
    .select()
    .single()
}

export async function updateProduct(productId: string, data: Partial<Product>) {
  return supabase.from('products').update(data).eq('id', productId).select().single()
}

export async function deleteProduct(productId: string) {
  return supabase.from('products').delete().eq('id', productId)
}

export interface StockEntryCostRow {
  product_id: string
  cost_per_unit: number
}

export async function getStockEntriesByShop(shopId: string) {
  return supabase
    .from('stock_entries')
    .select('product_id, cost_per_unit')
    .eq('shop_id', shopId)
    .gt('cost_per_unit', 0)
}
