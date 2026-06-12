// Vue Gérante — accès complet
import { useEffect, useState } from 'react'
import {
  Alert, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Button } from '../../components/Button'
import { ClientAvatar, LEVEL_COLORS, LEVEL_ICON, LEVEL_LABEL } from '../../components/ClientAvatar'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { Client, CreditPayment, PaymentPref, Product, Sale } from '../../lib/types'
import { getProducts } from '../../services/products'
import {
  addCreditPayment, getClientById, getClientCreditPayments,
  getClientSalesHistory, updateClient,
} from '../../services/clients'
import { fmt, formatDate } from '../../utils/helpers'

const PAYMENT_LABELS: Record<PaymentPref, string> = {
  cash: '💵 Cash',
  credit: '📒 Crédit',
  mixed: '🔀 Mixte',
}

export default function FicheClientGerante() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>()
  const { profile } = useAuth()

  const [client, setClient] = useState<Client | null>(null)
  const [salesHistory, setSalesHistory] = useState<Sale[]>([])
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({
    phone: '', whatsapp: '', address: '',
    preferred_payment: 'cash' as PaymentPref,
    product_preferences: [] as string[],
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)

  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)

  useEffect(() => { if (clientId) loadAll() }, [clientId])

  async function loadAll() {
    const [clientRes, salesRes, creditsRes, productsRes] = await Promise.all([
      getClientById(clientId),
      getClientSalesHistory(clientId),
      getClientCreditPayments(clientId),
      profile?.shop_id ? getProducts(profile.shop_id) : Promise.resolve({ data: [], error: null }),
    ])
    if (clientRes.data) {
      setClient(clientRes.data)
      setEditForm({
        phone: clientRes.data.phone ?? '',
        whatsapp: clientRes.data.whatsapp ?? '',
        address: clientRes.data.address ?? '',
        preferred_payment: clientRes.data.preferred_payment ?? 'cash',
        product_preferences: clientRes.data.product_preferences ?? [],
        notes: clientRes.data.notes ?? '',
      })
    }
    if (salesRes.data) setSalesHistory(salesRes.data)
    if (creditsRes.data) setCreditPayments(creditsRes.data)
    if (productsRes.data) setProducts(productsRes.data)
  }

  async function handleSave() {
    if (!client) return
    setSaving(true)
    const { error } = await updateClient(client.id, {
      phone: editForm.phone || null,
      whatsapp: editForm.whatsapp || null,
      address: editForm.address || null,
      preferred_payment: editForm.preferred_payment,
      product_preferences: editForm.product_preferences,
      notes: editForm.notes || null,
    })
    setSaving(false)
    if (error) { Alert.alert('Erreur', 'Impossible de sauvegarder.'); return }
    setEditMode(false)
    loadAll()
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

  function toggleProductPref(name: string) {
    setEditForm(f => ({
      ...f,
      product_preferences: f.product_preferences.includes(name)
        ? f.product_preferences.filter(p => p !== name)
        : [...f.product_preferences, name],
    }))
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

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

        {/* ── Infos ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Infos</Text>
            {!editMode && (
              <TouchableOpacity onPress={() => setEditMode(true)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>✏️ Modifier</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode ? (
            <>
              <Input label="Téléphone" value={editForm.phone} onChangeText={t => setEditForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />
              <Input label="WhatsApp" value={editForm.whatsapp} onChangeText={t => setEditForm(f => ({ ...f, whatsapp: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />
              <Input label="Adresse" value={editForm.address} onChangeText={t => setEditForm(f => ({ ...f, address: t }))} placeholder="ex: Marché Adidogomé" />
              <Text style={styles.fieldLabel}>Paiement habituel</Text>
              <View style={styles.chipRow}>
                {(['cash', 'credit', 'mixed'] as PaymentPref[]).map(p => (
                  <TouchableOpacity key={p}
                    style={[styles.chip, editForm.preferred_payment === p && styles.chipActive]}
                    onPress={() => setEditForm(f => ({ ...f, preferred_payment: p }))}>
                    <Text style={[styles.chipText, editForm.preferred_payment === p && styles.chipTextActive]}>
                      {PAYMENT_LABELS[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Produits préférés</Text>
              <View style={styles.chipRow}>
                {products.map(p => (
                  <TouchableOpacity key={p.id}
                    style={[styles.chip, editForm.product_preferences.includes(p.name) && styles.chipActive]}
                    onPress={() => toggleProductPref(p.name)}>
                    <Text style={[styles.chipText, editForm.product_preferences.includes(p.name) && styles.chipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label="Notes" value={editForm.notes} onChangeText={t => setEditForm(f => ({ ...f, notes: t }))} multiline numberOfLines={3} style={{ height: 72, textAlignVertical: 'top', paddingTop: 10 }} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Button title="Annuler" onPress={() => setEditMode(false)} variant="ghost" style={{ flex: 1 }} />
                <Button title="Enregistrer" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              {client.phone     && <Text style={styles.infoLine}>📞 {client.phone}</Text>}
              {client.whatsapp  && <Text style={styles.infoLine}>💬 {client.whatsapp}</Text>}
              {client.address   && <Text style={styles.infoLine}>📍 {client.address}</Text>}
              <Text style={styles.infoLine}>
                💳 {PAYMENT_LABELS[client.preferred_payment ?? 'cash']}
              </Text>
              {(client.product_preferences?.length ?? 0) > 0 && (
                <View style={[styles.chipRow, { marginTop: 8 }]}>
                  {client.product_preferences.map(name => (
                    <View key={name} style={styles.chipReadOnly}>
                      <Text style={styles.chipText}>{name}</Text>
                    </View>
                  ))}
                </View>
              )}
              {client.notes && <Text style={[styles.infoLine, { fontStyle: 'italic', marginTop: 4 }]}>{client.notes}</Text>}
            </>
          )}
        </View>

        {/* ── Historique ventes ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique ventes</Text>
          {salesHistory.length === 0 ? (
            <Text style={styles.emptyText}>Aucune vente enregistrée.</Text>
          ) : (
            salesHistory.slice(0, 10).map(sale => {
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
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.saleAmount}>{fmt(sale.paid_amount)}</Text>
                      {sale.credit_amount > 0 && (
                        <View style={styles.creditBadge}>
                          <Text style={styles.creditBadgeText}>Crédit</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {/* ── Paiements crédit ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paiements crédit</Text>
          {creditPayments.length === 0 ? (
            <Text style={styles.emptyText}>Aucun paiement crédit enregistré.</Text>
          ) : (
            creditPayments.map(cp => (
              <View key={cp.id} style={styles.creditPayRow}>
                <Text style={styles.creditPayDate}>{formatDate(new Date(cp.date))}</Text>
                <Text style={styles.creditPayAmount}>{fmt(cp.amount)}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── CTA ── */}
        <Button
          title="💰 Encaisser un paiement"
          onPress={() => setPaymentModal(true)}
          size="lg"
          style={[{ marginTop: 8 }, client.total_debt === 0 && { opacity: 0.4 }]}
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
  section: { backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7 },
  editBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 4 },
  infoLine: { fontSize: 14, color: Colors.text, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipReadOnly: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  emptyText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  saleRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  saleDate: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  saleSummary: { fontSize: 13, fontWeight: '600', color: Colors.text },
  saleItem: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  saleAmount: { fontSize: 14, fontWeight: '800', color: Colors.forestMid },
  creditBadge: { backgroundColor: Colors.goldLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  creditBadgeText: { fontSize: 9, fontWeight: '700', color: '#7A4A00' },
  creditPayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  creditPayDate: { fontSize: 13, color: Colors.textSecondary },
  creditPayAmount: { fontSize: 14, fontWeight: '800', color: Colors.success },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  clientSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 20 },
  remainCard: { backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  remainLabel: { fontSize: 12, color: Colors.textSecondary },
  remainValue: { fontSize: 24, fontWeight: '900', marginTop: 2 },
})
