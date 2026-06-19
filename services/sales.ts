import { supabase } from '../lib/supabase'
import { SalePayload } from '../lib/types'

/**
 * Crée une vente de façon atomique via une fonction Postgres transactionnelle.
 * Si n'importe quelle étape plante (items, stock), tout est rollback automatiquement.
 */
export async function createSale(shopId: string, createdBy: string, payload: SalePayload) {
  const { data, error } = await supabase.rpc('create_sale', {
    p_shop_id:       shopId,
    p_created_by:    createdBy,
    p_total_amount:  payload.total_amount,
    p_paid_amount:   payload.paid_amount,
    p_credit_amount: payload.credit_amount,
    p_date:          payload.date,
    p_pay_mode:      payload.pay_mode ?? 'cash',
    p_client_key:    payload.client_key ?? null,
    p_items:         payload.items.map(i => ({
      product_id: i.product_id,
      quantity:   i.quantity,
      unit_price: i.unit_price,
      total:      i.total,
    })),
  })

  if (error) return { data: null, error }

  // Mise à jour crédit client (hors transaction — non critique)
  if (payload.credit_amount > 0 && payload.client_name) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, total_debt')
      .eq('shop_id', shopId)
      .ilike('name', payload.client_name)
      .single()

    if (client) {
      await supabase
        .from('clients')
        .update({ total_debt: client.total_debt + payload.credit_amount })
        .eq('id', client.id)
    }
  }

  // La fonction RPC retourne un array, on prend le premier élément
  return { data: Array.isArray(data) ? data[0] : data, error: null }
}

export async function getSalesByDate(shopId: string, date: string) {
  return supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(*)), client:clients(*)')
    .eq('shop_id', shopId)
    .eq('date', date)
    .order('created_at', { ascending: false })
}

export async function getSalesHistory(shopId: string, limit = 50) {
  return supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(*)), client:clients(*)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function getSalesTrend(shopId: string, fromDate: string) {
  return supabase
    .from('sales')
    .select('paid_amount, date')
    .eq('shop_id', shopId)
    .gte('date', fromDate)
}

export async function getSalesWithCreator(shopId: string, limit = 100) {
  return supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(*)), client:clients(*), creator:profiles(full_name, job_title)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function getSalesByCreator(shopId: string, createdBy: string, limit = 50) {
  return supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(*)), client:clients(*)')
    .eq('shop_id', shopId)
    .eq('created_by', createdBy)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function getEmployeeSales(shopId: string, createdBy: string, fromDate: string) {
  return supabase
    .from('sales')
    .select('paid_amount, credit_amount')
    .eq('shop_id', shopId)
    .eq('created_by', createdBy)
    .gte('date', fromDate)
}

export async function getSalesSummary(shopId: string, fromDate?: string) {
  let query = supabase
    .from('sales')
    .select('paid_amount, date')
    .eq('shop_id', shopId)
    .order('date')
  if (fromDate) query = query.gte('date', fromDate)
  return query
}

export interface SaleItemByShopRow {
  product_id: string
  unit_price: number
  quantity: number
  products: { name: string; shop_id: string } | null
}

export async function getSaleItemsByShop(shopId: string) {
  const { data, error } = await supabase
    .from('sale_items')
    .select('product_id, unit_price, quantity, products!inner(name, shop_id)')
    .eq('products.shop_id', shopId)
  // PostgREST renvoie un objet pour cette relation to-one, mais le client non typé infère un tableau
  return { data: (data ?? []) as unknown as SaleItemByShopRow[], error }
}

/** Ligne renvoyée par getSalesSummary / getSalesTrend. */
export interface SaleAmountRow {
  paid_amount: number
  date: string
}
