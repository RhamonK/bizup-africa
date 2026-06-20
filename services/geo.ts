import { supabase } from '../lib/supabase'

export interface NearbyClient {
  id: string
  name: string
  phone: string | null
  distance_m: number
}

/** Acheteuses de la boutique à moins de `radius` mètres d'un point (RPC PostGIS). */
export async function getClientsNearPoint(lat: number, lng: number, radius = 3000) {
  return supabase.rpc('clients_near_point', { p_lat: lat, p_lng: lng, p_radius_m: radius })
}
