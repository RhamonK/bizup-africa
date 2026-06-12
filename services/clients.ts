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

export async function addCreditPayment(clientId: string, amount: number) {
  const { error: paymentErr } = await supabase
    .from('credit_payments')
    .insert({ client_id: clientId, amount, date: new Date().toISOString().split('T')[0] })
  if (paymentErr) return { data: null, error: paymentErr }

  const { data: client, error: fetchErr } = await supabase
    .from('clients')
    .select('total_debt')
    .eq('id', clientId)
    .single()
  if (fetchErr) return { data: null, error: fetchErr }

  return supabase
    .from('clients')
    .update({ total_debt: Math.max(0, client.total_debt - amount) })
    .eq('id', clientId)
    .select()
    .single()
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
