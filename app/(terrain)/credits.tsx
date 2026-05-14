import { useEffect, useState } from 'react'
import {
  Alert, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Client } from '../../lib/types'

const LEVEL_COLORS: Record<string, string> = {
  grand_compte: '#8E44AD',
  vip: '#2471A3',
  standard: '#7BAE96',
}

const LEVEL_ICON: Record<string, string> = {
  grand_compte: '👑',
  vip: '⭐',
  standard: '',
}

function ClientAvatar({ name, level }: { name: string; level: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const color = LEVEL_COLORS[level] ?? Colors.sage
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  )
}

export default function CreditsScreen() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [allClients, setAllClients] = useState<Client[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!profile?.shop_id) return
    const { data } = await supabase.from('clients').select('*').eq('shop_id', profile.shop_id).order('total_debt', { ascending: false })
    if (data) {
      setAllClients(data)
      setClients(data.filter((c: Client) => c.total_debt > 0))
    }
  }

  const totalDebt = clients.reduce((s, c) => s + c.total_debt, 0)

  async function handlePayment() {
    if (!selectedClient || !paymentAmount) { Alert.alert('Erreur', 'Entre le montant reçu.'); return }
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0 || amount > selectedClient.total_debt) {
      Alert.alert('Erreur', `Montant invalide (max: ${selectedClient.total_debt.toLocaleString('fr-FR')} F)`)
      return
    }
    setSaving(true)
    await Promise.all([
      supabase.from('credit_payments').insert({ client_id: selectedClient.id, amount, date: new Date().toISOString().split('T')[0] }),
      supabase.from('clients').update({ total_debt: selectedClient.total_debt - amount }).eq('id', selectedClient.id),
    ])
    setSaving(false)
    setSelectedClient(null); setPaymentAmount('')
    Alert.alert('✅ Paiement enregistré', `${amount.toLocaleString('fr-FR')} F reçu de ${selectedClient.name}`)
    load()
  }

  // Calculer depuis combien de temps
  function daysSince(dateStr: string) {
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    return d > 0 ? `${d} jour${d > 1 ? 's' : ''}` : 'Aujourd\'hui'
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.forest }} edges={[]}>
      {/* Header avec total en grand */}
      <View style={styles.header}>
        <Text style={styles.totalAmount}>
          {totalDebt.toLocaleString('fr-FR')} <Text style={styles.totalLabel}>FCFA à encaisser</Text>
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>En attente</Text>
          {clients.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Text style={{ fontSize: 32 }}>✅</Text>
              <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>Aucun impayé — tous soldés !</Text>
            </View>
          ) : (
            clients.map(client => (
              <View key={client.id} style={styles.clientRow}>
                <ClientAvatar name={client.name} level={client.level} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.clientSub}>
                    {LEVEL_ICON[client.level]} {client.level === 'grand_compte' ? 'Grand compte' : client.level === 'vip' ? 'VIP' : 'Standard'}
                    {client.created_at ? ` · depuis le ${new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.debtAmount}>{client.total_debt.toLocaleString('fr-FR')} F</Text>
                  <TouchableOpacity style={styles.payBtn} onPress={() => setSelectedClient(client)}>
                    <Text style={styles.payBtnText}>Encaisser</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Clients soldés */}
        {allClients.filter(c => c.total_debt === 0).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Soldés ✅</Text>
            {allClients.filter(c => c.total_debt === 0).map(client => (
              <View key={client.id} style={styles.clientRow}>
                <ClientAvatar name={client.name} level={client.level} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{client.name}</Text>
                  <Text style={styles.clientSub}>{client.level === 'grand_compte' ? 'Grand compte' : client.level === 'vip' ? 'VIP' : 'Standard'}</Text>
                </View>
                <Text style={[styles.debtAmount, { color: Colors.mint }]}>0 F</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={!!selectedClient} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Encaissement</Text>
            <TouchableOpacity onPress={() => { setSelectedClient(null); setPaymentAmount('') }}>
              <Text style={{ fontSize: 20, color: Colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 24 }}>
            {selectedClient && (
              <View style={styles.clientSummary}>
                <ClientAvatar name={selectedClient.name} level={selectedClient.level} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{selectedClient.name}</Text>
                  <Text style={[styles.debtAmount, { color: Colors.danger }]}>
                    Dette : {selectedClient.total_debt.toLocaleString('fr-FR')} F
                  </Text>
                </View>
              </View>
            )}
            <Input
              label="Montant reçu (FCFA)"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              placeholder="ex: 10000"
              hint={selectedClient ? `Maximum : ${selectedClient.total_debt.toLocaleString('fr-FR')} F` : ''}
            />
            {paymentAmount && selectedClient && (
              <View style={styles.remainCard}>
                <Text style={styles.remainLabel}>Solde restant</Text>
                <Text style={[styles.remainValue, { color: Math.max(0, selectedClient.total_debt - parseFloat(paymentAmount || '0')) === 0 ? Colors.mint : Colors.danger }]}>
                  {Math.max(0, selectedClient.total_debt - parseFloat(paymentAmount || '0')).toLocaleString('fr-FR')} F
                </Text>
              </View>
            )}
            <Button title="Confirmer le paiement" onPress={handlePayment} loading={saving} size="lg" style={{ marginTop: 12, backgroundColor: Colors.forest }} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { backgroundColor: Colors.forest, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
  totalAmount: { fontSize: 28, fontWeight: '900', color: '#fff' },
  totalLabel: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.4)' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  avatar: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  clientName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  clientSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  debtAmount: { fontSize: 16, fontWeight: '900', color: Colors.danger },
  payBtn: { backgroundColor: Colors.forest, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 5 },
  payBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  clientSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 20 },
  remainCard: { backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  remainLabel: { fontSize: 12, color: Colors.textSecondary },
  remainValue: { fontSize: 24, fontWeight: '900', marginTop: 2 },
})
