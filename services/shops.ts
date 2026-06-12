import { supabase } from '../lib/supabase'
import { Shop } from '../lib/types'

export async function getShop(shopId: string) {
  return supabase.from('shops').select('name, city, country, created_at').eq('id', shopId).single()
}

export async function updateShop(shopId: string, data: Partial<Pick<Shop, 'name' | 'city' | 'country'>>) {
  return supabase.from('shops').update(data).eq('id', shopId)
}
