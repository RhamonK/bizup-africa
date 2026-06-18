import { supabase } from '../lib/supabase'
import { getProducts, getStockEntriesByShop } from './products'
import { getSaleItemsByShop } from './sales'
import { getPriceHistoryByShop } from './suppliers'
import { computeMargins } from '../utils/helpers'

/** Marge moyenne du commerce — même calcul que l'écran Marges (cohérence garantie). */
export async function getShopAverageMargin(shopId: string): Promise<number> {
  const [prodRes, saleItemRes, priceHistRes, stockEntriesRes] = await Promise.all([
    getProducts(shopId),
    getSaleItemsByShop(shopId),
    getPriceHistoryByShop(shopId),
    getStockEntriesByShop(shopId),
  ])
  const buyRows = [
    ...(priceHistRes.data ?? []).map(ph => ({ product_id: ph.product_id, price: ph.price_per_unit })),
    ...(stockEntriesRes.data ?? []).map(se => ({ product_id: se.product_id, price: se.cost_per_unit })),
  ]
  const saleItems = (saleItemRes.data ?? []).map(si => ({ product_id: si.product_id, unit_price: si.unit_price }))
  return computeMargins(prodRes.data ?? [], saleItems, buyRows).avgPct
}

export interface TopProduct { name: string; revenue: number; qty: number }
export interface LowStockProduct { name: string; qty: number; unit: string; threshold: number }

export interface DiasporaSnapshot {
  revenueToday: number
  revenueWeek: number
  salesCount: number
  debtTotal: number
  trend30: number[]
  trend30Labels: string[]
  topProducts: TopProduct[]
  lowStockProducts: LowStockProduct[]
  overdueCreditsCount: number
  shopName: string
}

interface DaySaleRow {
  paid_amount: number
  items: { quantity: number; total: number; product: { name: string } | null }[]
}
interface TrendRow { total_amount: number; date: string }
interface StockRow { name: string; stock_quantity: number; alert_threshold: number; unit: string }

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
}

/** Vue lecture seule diaspora : KPIs du jour, tendance 30 jours, alertes. */
export async function getDiasporaSnapshot(shopId: string): Promise<DiasporaSnapshot> {
  const today = isoDaysAgo(0)
  const sevenDaysAgo = isoDaysAgo(7)
  const thirtyDaysAgo = isoDaysAgo(29)

  const [shopRes, dayRes, trend30Res, debtRes, productsRes, overdueRes] = await Promise.all([
    supabase.from('shops').select('name').eq('id', shopId).single(),
    supabase.from('sales').select('paid_amount, items:sale_items(quantity, total, product:products(name))').eq('shop_id', shopId).gte('date', today),
    supabase.from('sales').select('total_amount, date').eq('shop_id', shopId).gte('date', thirtyDaysAgo).order('date'),
    supabase.from('clients').select('total_debt').eq('shop_id', shopId).gt('total_debt', 0),
    supabase.from('products').select('name, stock_quantity, alert_threshold, unit').eq('shop_id', shopId),
    supabase.from('sales').select('id').eq('shop_id', shopId).gt('credit_amount', 0).lt('date', sevenDaysAgo),
  ])

  const daySales = (dayRes.data ?? []) as unknown as DaySaleRow[]
  const trendRows = (trend30Res.data ?? []) as TrendRow[]
  const products = (productsRes.data ?? []) as StockRow[]

  // Tendance 30 jours
  const days30 = Array.from({ length: 30 }, (_, i) => isoDaysAgo(29 - i))
  const trend30 = Array(30).fill(0) as number[]
  for (const s of trendRows) {
    const idx = days30.indexOf(s.date)
    if (idx >= 0) trend30[idx] += s.total_amount
  }

  // Top 3 produits du jour
  const prodMap: Record<string, TopProduct> = {}
  for (const sale of daySales) {
    for (const item of sale.items ?? []) {
      const name = item.product?.name ?? 'Inconnu'
      prodMap[name] ??= { name, revenue: 0, qty: 0 }
      prodMap[name].revenue += item.total
      prodMap[name].qty += item.quantity
    }
  }

  return {
    revenueToday: daySales.reduce((s, r) => s + r.paid_amount, 0),
    revenueWeek: trendRows.filter(s => s.date >= sevenDaysAgo).reduce((sum, s) => sum + s.total_amount, 0),
    salesCount: daySales.length,
    debtTotal: ((debtRes.data ?? []) as { total_debt: number }[]).reduce((s, r) => s + r.total_debt, 0),
    trend30,
    trend30Labels: days30.map(d => new Date(d).getDate().toString()),
    topProducts: Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    lowStockProducts: products
      .filter(p => p.stock_quantity <= p.alert_threshold)
      .map(p => ({ name: p.name, qty: p.stock_quantity, unit: p.unit, threshold: p.alert_threshold })),
    overdueCreditsCount: overdueRes.data?.length ?? 0,
    shopName: shopRes.data?.name ?? 'Commerce',
  }
}
