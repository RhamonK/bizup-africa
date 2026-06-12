import { supabase } from '../lib/supabase'
import { Profile } from '../lib/types'

export async function getEmployees(shopId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('shop_id', shopId)
    .eq('role', 'terrain')
    .order('full_name')
}

export async function updateProfile(profileId: string, data: Partial<Profile>) {
  return supabase.from('profiles').update(data).eq('id', profileId).select().single()
}
