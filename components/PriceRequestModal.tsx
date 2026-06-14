import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import { Product } from '../lib/types'
import { createPriceRequest, subscribeToPriceRequest } from '../services/priceRequests'
import { Button } from './Button'
import { Input } from './Input'
import { ProductImage } from './ProductImage'

interface Props {
  visible: boolean
  onClose: () => void
  shopId: string
  agentId: string
  product: Product | null
  clientName: string
  defaultPrice: string
  /** Appelé quand le patron a accepté — renvoie le prix validé à appliquer à la vente. */
  onApproved: (price: number) => void
}

type Phase = 'form' | 'waiting' | 'approved' | 'rejected'

export function PriceRequestModal({
  visible, onClose, shopId, agentId, product, clientName, defaultPrice, onApproved,
}: Props) {
  const [price, setPrice] = useState(defaultPrice)
  const [reason, setReason] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [approvedPrice, setApprovedPrice] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  // Réinitialise à chaque ouverture, coupe l'abonnement à la fermeture
  useEffect(() => {
    if (visible) {
      setPrice(defaultPrice); setReason(''); setPhase('form'); setApprovedPrice(null); setSaving(false)
    } else {
      unsubRef.current?.(); unsubRef.current = null
    }
  }, [visible, defaultPrice])

  useEffect(() => () => { unsubRef.current?.() }, [])

  async function submit() {
    if (!product) return
    const val = parseFloat(price)
    if (isNaN(val) || val <= 0) { Alert.alert('Erreur', 'Entre un prix valide.'); return }

    setSaving(true)
    const { data, error } = await createPriceRequest(shopId, agentId, {
      product_id: product.id,
      product_name: product.name,
      client_name: clientName || null,
      requested_price: val,
      reason: reason || null,
    })
    setSaving(false)

    if (error || !data) {
      Alert.alert('Erreur', 'La demande n\'a pas pu être envoyée. Vérifie ta connexion.')
      return
    }

    setPhase('waiting')
    unsubRef.current = subscribeToPriceRequest(data.id, (req) => {
      if (req.status === 'approved') {
        setApprovedPrice(req.approved_price ?? req.requested_price)
        setPhase('approved')
      } else if (req.status === 'rejected') {
        setPhase('rejected')
      }
    })
  }

  function applyAndClose() {
    if (approvedPrice != null) onApproved(approvedPrice)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>Demander un prix au patron</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          {product && (
            <View style={s.productRow}>
              <ProductImage name={product.name} photoUrl={product.photo_url} size={48} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.productSub}>
                  Prix normal : {Number(defaultPrice || 0).toLocaleString('fr-FR')} F/{product.unit}
                  {clientName ? ` · ${clientName}` : ''}
                </Text>
              </View>
            </View>
          )}

          {phase === 'form' && (
            <>
              <Input
                label="Prix demandé (F)"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="ex: 8000"
              />
              <Input
                label="Raison (optionnel)"
                value={reason}
                onChangeText={setReason}
                placeholder="ex: gros client, prend 10 caisses"
              />
              <Button title="📨 Envoyer au patron" onPress={submit} loading={saving} size="lg" style={{ marginTop: 8 }} />
            </>
          )}

          {phase === 'waiting' && (
            <View style={s.statusBox}>
              <ActivityIndicator size="large" color={Colors.forest} />
              <Text style={s.statusTitle}>En attente du patron…</Text>
              <Text style={s.statusSub}>Le patron a reçu ta demande de {parseFloat(price).toLocaleString('fr-FR')} F. La réponse arrivera ici.</Text>
              <Button title="Fermer (continuer sans attendre)" variant="ghost" onPress={onClose} style={{ marginTop: 16 }} />
            </View>
          )}

          {phase === 'approved' && approvedPrice != null && (
            <View style={s.statusBox}>
              <Text style={{ fontSize: 52 }}>✅</Text>
              <Text style={s.statusTitle}>Patron a accepté !</Text>
              <Text style={s.approvedPrice}>{approvedPrice.toLocaleString('fr-FR')} F</Text>
              {approvedPrice !== parseFloat(price) && (
                <Text style={s.statusSub}>Le patron a ajusté le prix (tu avais demandé {parseFloat(price).toLocaleString('fr-FR')} F).</Text>
              )}
              <Button title="Continuer la vente →" onPress={applyAndClose} size="lg" style={{ marginTop: 16, backgroundColor: Colors.accent }} />
            </View>
          )}

          {phase === 'rejected' && (
            <View style={s.statusBox}>
              <Text style={{ fontSize: 52 }}>❌</Text>
              <Text style={s.statusTitle}>Patron a refusé</Text>
              <Text style={s.statusSub}>Garde le prix normal ou redemande un autre montant.</Text>
              <Button title="Redemander" variant="ghost" onPress={() => setPhase('form')} style={{ marginTop: 16 }} />
              <Button title="Fermer" onPress={onClose} style={{ marginTop: 8 }} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:       { fontSize: 18, fontWeight: '700', color: Colors.text },
  close:       { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  body:        { padding: 20 },
  productRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.borderLight },
  productName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  productSub:  { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBox:   { alignItems: 'center', paddingVertical: 24, gap: 6 },
  statusTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginTop: 8 },
  statusSub:   { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
  approvedPrice: { fontSize: 34, fontWeight: '900', color: Colors.forest, marginTop: 4 },
})
