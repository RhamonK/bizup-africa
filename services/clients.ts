import { supabase } from '../lib/supabase'
import { Client } from '../lib/types'

export async function getClients(shopId: string) {
  return supabase
    .from('clients')
    .select('*')
    .eq('shop_id', shopId)
    .order('name')
}

export async function getClientById(clientId: string) {
  return supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
}

/** Paiement + décrément de dette en une transaction Postgres (RPC, plancher à 0). */
export async function addCreditPayment(clientId: string, amount: number) {
  return supabase.rpc('apply_credit_payment', { p_client_id: clientId, p_amount: amount })
}

export async function getClientsByDebt(shopId: string) {
  return supabase
    .from('clients')
    .select('*')
    .eq('shop_id', shopId)
    .order('total_debt', { ascending: false })
}

export async function updateClient(clientId: string, data: Partial<Client>) {
  return supabase
    .from('clients')
    .update(data)
    .eq('id', clientId)
    .select()
    .single()
}

export async function getClientCreditPayments(clientId: string) {
  return supabase
    .from('credit_payments')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
}

export async function getClientSalesHistory(clientId: string) {
  return supabase
    .from('sales')
    .select('*, items:sale_items(*, product:products(*))')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
}

export async function createClient(shopId: string, data: Partial<Client>) {
  return supabase
    .from('clients')
    .insert({ shop_id: shopId, total_debt: 0, ...data })
    .select()
    .single()
}

export async function deleteClient(clientId: string) {
  return supabase.from('clients').delete().eq('id', clientId)
}
