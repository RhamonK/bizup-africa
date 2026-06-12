// Vue Terrain — accès limité
import { useEffect, useState } from 'react'
import {
  Alert, Linking, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Button } from '../../components/Button'
import { ClientAvatar, LEVEL_COLORS, LEVEL_ICON, LEVEL_LABEL } from '../../components/ClientAvatar'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { Client, Sale } from '../../lib/types'
import { addCreditPayment, getClientById, getClientSalesHistory } from '../../services/clients'
import { fmt, formatDate } from '../../utils/helpers'

export default function FicheClientTerrain() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>()
  const { profile } = useAuth()

  const [client, setClient] = useState<Client | null>(null)
  const [salesHistory, setSalesHistory] = useState<Sale[]>([])
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  useEffect(() => { if (clientId) loadAll() }, [clientId])

  async function loadAll() {
    const [clientRes, salesRes] = await Promise.all([
      getClientById(clientId),
      getClientSalesHistory(clientId),
    ])
    if (clientRes.data) setClient(clientRes.data)
    if (salesRes.data) setSalesHistory(salesRes.data)
  }

  async function handlePayment() {
    if (!client || !paymentAmount) return
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0 || amount > client.total_debt) {
      Alert.alert('Erreur', `Montant invalide (max: ${client.total_debt.toLocaleString('fr-FR')} F)`)
      return
    }
    setPaymentSaving(true)
    const { error } = await addCreditPayment(client.id, amount)
    setPaymentSaving(false)
    if (error) { Alert.alert('Erreur', 'Paiement non enregistré.'); return }
    setPaymentModal(false)
    setPaymentAmount('')
    loadAll()
  }

  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTotal = salesHistory
    .filter(s => s.date?.startsWith(currentYM))
    .reduce((sum, s) => sum + s.total_amount, 0)

  if (!client) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <ClientAvatar name={client.name} level={client.level} size={56} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.clientName}>{client.name}</Text>
            <View style={styles.levelRow}>
              <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLORS[client.level] + '30' }]}>
                <Text style={[styles.levelText, { color: LEVEL_COLORS[client.level] }]}>
                  {LEVEL_ICON[client.level]} {LEVEL_LABEL[client.level]}
                </Text>
              </View>
            </View>
            <Text style={styles.sinceLine}>
              Client depuis le {new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Ce mois</Text>
            <Text style={styles.statValue}>{fmt(monthTotal)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Dette</Text>
            <Text style={[styles.statValue, { color: client.total_debt > 0 ? Colors.danger : Colors.success }]}>
              {fmt(client.total_debt)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Achats</Text>
            <Text style={styles.statValue}>{salesHistory.length}</Text>
          </View>
        </View>

        {/* ── Dette banner ── */}
        {client.total_debt > 0 && (
          <View style={styles.debtBanner}>
            <Text style={styles.debtBannerLabel}>Montant dû</Text>
            <Text style={styles.debtBannerAmount}>{fmt(client.total_debt)}</Text>
          </View>
        )}

        {/* ── Contact ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {client.phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${client.phone}`)}>
              <Text style={styles.contactLine}>📞 {client.phone}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptyText}>Pas de téléphone enregistré.</Text>
          )}
          {client.whatsapp && (
            <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${client.whatsapp?.replace(/\D/g, '')}`)}>
              <Text style={styles.contactLine}>💬 {client.whatsapp}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Historique ventes (5 max) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dernières ventes</Text>
          {salesHistory.length === 0 ? (
            <Text style={styles.emptyText}>Aucune vente enregistrée.</Text>
          ) : (
            salesHistory.slice(0, 5).map(sale => {
              const expanded = expandedSaleId === sale.id
              const summary = sale.items?.map(i => `${i.quantity} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ') || '—'
              return (
                <TouchableOpacity key={sale.id} onPress={() => setExpandedSaleId(expanded ? null : sale.id)}>
                  <View style={styles.saleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saleDate}>{formatDate(new Date(sale.date))}</Text>
                      <Text style={styles.saleSummary} numberOfLines={expanded ? undefined : 1}>{summary}</Text>
                      {expanded && sale.items?.map(i => (
                        <Text key={i.id} style={styles.saleItem}>
                          · {i.quantity} {i.product?.unit} {i.product?.name} — {fmt(i.total)}
                        </Text>
                      ))}
                    </View>
                    <Text style={styles.saleAmount}>{fmt(sale.paid_amount)}</Text>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {/* ── CTA ── */}
        <Button
          title="💰 Encaisser un paiement"
          onPress={() => setPaymentModal(true)}
          size="lg"
          style={[{ marginHorizontal: 16, marginTop: 4 }, client.total_debt === 0 && { opacity: 0.4 }]}
          disabled={client.total_debt === 0}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal encaissement ── */}
      <Modal visible={paymentModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Encaissement</Text>
            <TouchableOpacity onPress={() => { setPaymentModal(false); setPaymentAmount('') }}>
              <Text style={{ fontSize: 20, color: Colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 24 }}>
            <View style={styles.clientSummary}>
              <ClientAvatar name={client.name} level={client.level} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>{client.name}</Text>
                <Text style={{ color: Colors.danger, fontWeight: '700', marginTop: 2 }}>
                  Dette : {fmt(client.total_debt)}
                </Text>
              </View>
            </View>
            <Input
              label="Montant reçu (FCFA)"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              placeholder="ex: 10000"
              hint={`Maximum : ${client.total_debt.toLocaleString('fr-FR')} F`}
            />
            {paymentAmount ? (
              <View style={styles.remainCard}>
                <Text style={styles.remainLabel}>Solde restant</Text>
                <Text style={[styles.remainValue, {
                  color: Math.max(0, client.total_debt - parseFloat(paymentAmount || '0')) === 0
                    ? Colors.success : Colors.danger,
                }]}>
                  {fmt(Math.max(0, client.total_debt - parseFloat(paymentAmount || '0')))}
                </Text>
              </View>
            ) : null}
            <Button title="Confirmer le paiement" onPress={handlePayment} loading={paymentSaving} size="lg" style={{ marginTop: 12, backgroundColor: Colors.forest }} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 0 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.forest, padding: 20, paddingTop: 16 },
  clientName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  levelRow: { flexDirection: 'row', marginTop: 4 },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  levelText: { fontSize: 12, fontWeight: '700' },
  sinceLine: { fontSize: 11, color: Colors.heroMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '900', color: Colors.text },
  debtBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.dangerLight, borderRadius: 12, padding: 14 },
  debtBannerLabel: { fontSize: 11, fontWeight: '700', color: Colors.danger, textTransform: 'uppercase', letterSpacing: 0.5 },
  debtBannerAmount: { fontSize: 28, fontWeight: '900', color: Colors.danger, marginTop: 2 },
  section: { backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  contactLine: { fontSize: 14, color: Colors.text, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  emptyText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  saleRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  saleDate: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  saleSummary: { fontSize: 13, fontWeight: '600', color: Colors.text },
  saleItem: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  saleAmount: { fontSize: 14, fontWeight: '800', color: Colors.forestMid },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  clientSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 20 },
  remainCard: { backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  remainLabel: { fontSize: 12, color: Colors.textSecondary },
  remainValue: { fontSize: 24, fontWeight: '900', marginTop: 2 },
})
