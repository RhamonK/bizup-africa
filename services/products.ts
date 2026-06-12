import { supabase } from '../lib/supabase'
import { Product } from '../lib/types'

export async function getProducts(shopId: string) {
  return supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .order('name')
}

export async function updateStock(productId: string, qty: number, costPerUnit: number) {
  const { data: product, error: fetchErr } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .single()
  if (fetchErr) return { data: null, error: fetchErr }

  const { error: updateErr } = await supabase
    .from('products')
    .update({ stock_quantity: product.stock_quantity + qty })
    .eq('id', productId)
  if (updateErr) return { data: null, error: updateErr }

  return supabase
    .from('stock_entries')
    .insert({ product_id: productId, quantity: qty, cost_per_unit: costPerUnit, date: new Date().toISOString().split('T')[0] })
    .select()
    .single()
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

export async function getStockEntriesByShop(shopId: string) {
  return supabase
    .from('stock_entries')
    .select('product_id, cost_per_unit')
    .eq('shop_id', shopId)
    .gt('cost_per_unit', 0)
}
