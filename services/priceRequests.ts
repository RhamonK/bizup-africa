import { supabase } from '../lib/supabase'
import { PriceRequest } from '../lib/types'

export interface NewPriceRequest {
  product_id: string
  product_name: string
  client_name?: string | null
  requested_price: number
  reason?: string | null
}

/** L'agent demande un prix spécial au patron. */
export async function createPriceRequest(shopId: string, agentId: string, req: NewPriceRequest) {
  return supabase
    .from('price_requests')
    .insert({
      shop_id: shopId,
      agent_id: agentId,
      product_id: req.product_id,
      product_name: req.product_name,
      client_name: req.client_name ?? null,
      requested_price: req.requested_price,
      reason: req.reason ?? null,
    })
    .select()
    .single()
}

/** Demandes en attente pour le patron, avec le nom de l'agent. */
export async function getPendingPriceRequests(shopId: string) {
  return supabase
    .from('price_requests')
    .select('*, agent:profiles!price_requests_agent_id_fkey(full_name, job_title)')
    .eq('shop_id', shopId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
}

/** Le patron accepte (prix demandé ou contre-proposition) ou refuse. */
export async function resolvePriceRequest(
  id: string,
  bossId: string,
  approve: boolean,
  approvedPrice?: number,
) {
  return supabase
    .from('price_requests')
    .update({
      status: approve ? 'approved' : 'rejected',
      approved_price: approve ? approvedPrice ?? null : null,
      resolved_by: bossId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
}

/** Patron : notifie à chaque changement sur les demandes de la boutique. */
export function subscribeToPendingPriceRequests(shopId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`price-requests-${shopId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'price_requests', filter: `shop_id=eq.${shopId}` },
      onChange,
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

/** Agent : suit la résolution d'UNE demande précise. */
export function subscribeToPriceRequest(requestId: string, onResolved: (req: PriceRequest) => void): () => void {
  const channel = supabase
    .channel(`price-request-${requestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'price_requests', filter: `id=eq.${requestId}` },
      (payload) => onResolved(payload.new as PriceRequest),
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
