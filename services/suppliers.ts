import { supabase } from '../lib/supabase'
import { PriceHistory, Season, Supplier } from '../lib/types'

export async function getSuppliers(shopId: string, season?: Season) {
  let query = supabase
    .from('suppliers')
    .select('*, products:supplier_products(*, product:products(*))')
    .eq('shop_id', shopId)

  if (season) {
    query = query.or(`season.eq.${season},season.eq.all_year`)
  }

  return query.order('name')
}

export async function createSupplier(shopId: string, data: Partial<Supplier>) {
  return supabase
    .from('suppliers')
    .insert({ shop_id: shopId, ...data })
    .select()
    .single()
}

export async function addPriceHistory(supplierId: string, data: Partial<PriceHistory>) {
  return supabase
    .from('price_history')
    .insert({ supplier_id: supplierId, ...data })
    .select()
    .single()
}

export async function linkProducts(supplierId: string, productIds: string[]) {
  return supabase
    .from('supplier_products')
    .insert(productIds.map(pid => ({ supplier_id: supplierId, product_id: pid })))
}

export async function getSupplierPriceHistory(supplierId: string, productId: string) {
  return supabase
    .from('price_history')
    .select('*, product:products(*), supplier:suppliers(*)')
    .eq('supplier_id', supplierId)
    .eq('product_id', productId)
    .order('date', { ascending: false })
}

export async function getPriceHistoryByShop(shopId: string) {
  return supabase
    .from('price_history')
    .select('product_id, price_per_unit, suppliers!inner(shop_id)')
    .eq('suppliers.shop_id', shopId)
}
