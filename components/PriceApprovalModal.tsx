import { useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import { PriceRequest } from '../lib/types'
import { resolvePriceRequest } from '../services/priceRequests'
import { Input } from './Input'

interface Props {
  visible: boolean
  onClose: () => void
  bossId: string
  requests: PriceRequest[]
  onResolved: () => void
}

export function PriceApprovalModal({ visible, onClose, bossId, requests, onResolved }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>Demandes de prix ({requests.length})</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {requests.length === 0 && (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={s.emptyText}>Aucune demande en attente</Text>
            </View>
          )}
          {requests.map(req => (
            <RequestRow key={req.id} req={req} bossId={bossId} onResolved={onResolved} />
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function RequestRow({ req, bossId, onResolved }: { req: PriceRequest; bossId: string; onResolved: () => void }) {
  const [price, setPrice] = useState(req.requested_price.toString())
  const [busy, setBusy] = useState(false)

  async function resolve(approve: boolean) {
    setBusy(true)
    const val = parseFloat(price)
    await resolvePriceRequest(req.id, bossId, approve, approve ? (isNaN(val) ? req.requested_price : val) : undefined)
    setBusy(false)
    onResolved()
  }

  return (
    <View style={s.card}>
      <Text style={s.product}>{req.product_name}</Text>
      <Text style={s.meta}>
        {req.agent?.full_name ?? 'Agent'}{req.client_name ? ` · client : ${req.client_name}` : ''}
      </Text>
      {req.reason ? <Text style={s.reason}>« {req.reason} »</Text> : null}

      <View style={s.priceBox}>
        <Text style={s.priceLabel}>Prix demandé</Text>
        <Text style={s.priceValue}>{req.requested_price.toLocaleString('fr-FR')} F</Text>
      </View>

      <Input
        label="Prix accepté (modifiable)"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <View style={s.btnRow}>
        <TouchableOpacity style={[s.btn, s.reject]} onPress={() => resolve(false)} disabled={busy} activeOpacity={0.8}>
          <Text style={s.rejectText}>❌ Refuser</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.accept]} onPress={() => resolve(true)} disabled={busy} activeOpacity={0.8}>
          <Text style={s.acceptText}>✅ Accepter</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:     { fontSize: 18, fontWeight: '700', color: Colors.text },
  close:     { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  empty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
  card:      { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  product:   { fontSize: 17, fontWeight: '800', color: Colors.text },
  meta:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reason:    { fontSize: 13, color: Colors.text, fontStyle: 'italic', marginTop: 8 },
  priceBox:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceDark, borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 12 },
  priceLabel:{ fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  priceValue:{ fontSize: 18, fontWeight: '900', color: Colors.forest },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:       { flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reject:    { backgroundColor: Colors.dangerLight },
  rejectText:{ fontSize: 15, fontWeight: '800', color: Colors.danger },
  accept:    { backgroundColor: Colors.forest },
  acceptText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
})
