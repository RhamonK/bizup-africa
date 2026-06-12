import { supabase } from '../lib/supabase'

/** S'abonne aux nouvelles ventes d'une boutique.
 *  Retourne la fonction de désabonnement (à appeler au cleanup du useEffect). */
export function subscribeToShopSales(shopId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`sales-${shopId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sales', filter: `shop_id=eq.${shopId}` },
      onInsert,
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
