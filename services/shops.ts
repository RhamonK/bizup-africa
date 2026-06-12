import { supabase } from '../lib/supabase'

export async function getShop(shopId: string) {
  return supabase.from('shops').select('name, created_at').eq('id', shopId).single()
}
