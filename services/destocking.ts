import { supabase } from '../lib/supabase'
import { DestockLot } from '../lib/types'

export interface NewLot {
  product_name: string
  unit: string
  location_label?: string | null
  quantity: number
  base_price: number
  floor_price: number
  window_hours: number
  latitude?: number | null
  longitude?: number | null
}

export async function createLot(shopId: string, createdBy: string, lot: NewLot) {
  return supabase
    .from('destock_lots')
    .insert({ shop_id: shopId, created_by: createdBy, quantity_remaining: lot.quantity, ...lot })
    .select()
    .single()
}

export async function getActiveLots(shopId: string) {
  return supabase
    .from('destock_lots')
    .select('*')
    .eq('shop_id', shopId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
}

/** Enregistre une vente sur le lot : décrémente le restant, clôture si épuisé. */
export async function recordLotSale(lot: DestockLot, soldQty: number) {
  const remaining = Math.max(0, lot.quantity_remaining - soldQty)
  return supabase
    .from('destock_lots')
    .update({ quantity_remaining: remaining, status: remaining <= 0 ? 'sold_out' : 'active' })
    .eq('id', lot.id)
    .select()
    .single()
}

export async function closeLot(lotId: string) {
  return supabase.from('destock_lots').update({ status: 'closed' }).eq('id', lotId)
}
