import { useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import { addToQueue } from '../lib/offlineQueue'
import { Product } from '../lib/types'
import { createSale } from '../services/sales'
import { fmtQty } from '../utils/helpers'
import { Button } from './Button'
import { PriceRequestModal } from './PriceRequestModal'
import { ProductImage } from './ProductImage'
import { Input } from './Input'

type PayMode = 'cash' | 'credit' | 'mobile_money'

const PAY_OPTIONS: { key: PayMode; icon: string; label: string }[] = [
  { key: 'cash',         icon: '💵', label: 'Cash'   },
  { key: 'credit',       icon: '📋', label: 'Crédit' },
  { key: 'mobile_money', icon: '📱', label: 'Mobile' },
]

interface Props {
  visible: boolean
  onClose: () => void
  products: Product[]
  shopId: string
  agentId: string
  onSaleCreated: () => void
  offline?: boolean
  onOfflineQueued?: () => void
}

type Receipt = {
  productName: string
  unit: string
  qty: number
  total: number
  paid: number
  credit: number
  payMode: PayMode
  clientName: string
}

export function SaleModal({ visible, onClose, products, shopId, agentId, onSaleCreated, offline, onOfflineQueued }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [product, setProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState('')
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [clientName, setClientName] = useState('')
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [priceRequest, setPriceRequest] = useState(false)

  function reset() {
    setStep(1); setProduct(null); setQty(1); setPrice('')
    setPayMode('cash'); setPaidAmount(''); setClientName(''); setReceipt(null)
  }

  function selectProduct(p: Product) {
    setProduct(p)
    setPrice(p.current_price.toString())
    setStep(2)
  }

  function adjustQty(delta: number) {
    setQty(prev => {
      const step = prev < 1 && delta < 0 ? 0.25 : prev <= 1 && delta > 0 && prev < 1 ? 0.25 : prev < 1 ? 0.25 : 1
      return Math.max(0.25, Math.round((prev + delta * step) * 4) / 4)
    })
  }

  async function confirm() {
    if (!product || !qty || !price) return
    const total = qty * parseFloat(price)
    const paid = payMode === 'credit' && paidAmount
      ? Math.min(parseFloat(paidAmount), total)
      : total
    const credit = total - paid
    const today = new Date().toISOString().split('T')[0]

    setSaving(true)
    const { data: sale, error } = await createSale(shopId, agentId, {
      total_amount: total, paid_amount: paid, credit_amount: credit, date: today,
      pay_mode: payMode,
      items: [{ product_id: product.id, quantity: qty, unit_price: parseFloat(price), total, current_stock: product.stock_quantity }],
      client_name: clientName || undefined,
    })
    setSaving(false)

    if (error) {
      if (offline) {
        await addToQueue({
          shop_id: shopId, created_by: agentId,
          total_amount: total, paid_amount: paid, credit_amount: credit, date: today,
          product_id: product.id, product_name: product.name, product_unit: product.unit,
          qty, unit_price: parseFloat(price),
          pay_mode: payMode, client_name: clientName || null,
        })
        onOfflineQueued?.()
        Alert.alert('⏳ Sauvegardé hors ligne', 'La vente sera synchronisée au retour du réseau.')
        onClose()
      }
      return
    }

    if (sale) {
      setReceipt({ productName: product.name, unit: product.unit, qty, total, paid, credit, payMode, clientName })
      setStep(3)
      onSaleCreated()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onDismiss={reset}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => step === 1 ? (onClose(), reset()) : setStep(v => (v === 3 ? 2 : 1))}
            style={s.backBtn}
          >
            <Text style={s.backText}>{step === 1 ? '✕ Fermer' : '← Retour'}</Text>
          </TouchableOpacity>
          <Text style={s.title}>
            {step === 1 ? 'Quel produit ?' : step === 2 ? 'Quantité & paiement' : 'Vente enregistrée !'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {[1, 2, 3].map(n => <View key={n} style={[s.dot, step >= n && s.dotActive]} />)}
          </View>
        </View>

        {/* Étape 1 — choisir le produit */}
        {step === 1 && (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {products.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 40 }}>📦</Text>
                <Text style={s.emptyTitle}>Aucun produit disponible</Text>
                <Text style={s.emptySub}>Crée d'abord des produits dans Gestion → Produits</Text>
              </View>
            ) : products.map(p => {
              const isOut = p.stock_quantity <= 0
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.productCard, isOut && { opacity: 0.4 }]}
                  onPress={() => !isOut && selectProduct(p)}
                  disabled={isOut}
                >
                  <ProductImage name={p.name} photoUrl={p.photo_url} size={52} borderRadius={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.productName}>{p.name}</Text>
                    <Text style={s.productDetail}>
                      {p.current_price.toLocaleString('fr-FR')} F/{p.unit} · Stock: {fmtQty(p.stock_quantity)} {p.unit}
                      {isOut ? ' — RUPTURE' : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: isOut ? Colors.textTertiary : Colors.forest }}>
                    {isOut ? '✕' : '›'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Étape 2 — quantité + paiement */}
        {step === 2 && product && (
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={s.selectedBar}>
              <ProductImage name={product.name} photoUrl={product.photo_url} size={40} borderRadius={10} />
              <View style={{ flex: 1 }}>
                <Text style={s.selectedName}>{product.name}</Text>
                <Text style={s.selectedStock}>Stock: {fmtQty(product.stock_quantity)} {product.unit}</Text>
              </View>
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={{ color: Colors.forest, fontWeight: '700' }}>Changer</Text>
              </TouchableOpacity>
            </View>

            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => adjustQty(-1)}>
                <Text style={s.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <View style={s.qtyDisplay}>
                <Text style={s.qtyDisplayText}>{fmtQty(qty)}</Text>
                <Text style={s.qtyUnit}>{product.unit}</Text>
              </View>
              <TouchableOpacity style={s.qtyBtn} onPress={() => adjustQty(1)}>
                <Text style={s.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Boutons de fraction rapide */}
            <View style={s.fracRow}>
              {([0.25, 0.5, 0.75, 1, 2, 5, 10] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.fracBtn, qty === v && s.fracBtnActive]}
                  onPress={() => setQty(v)}
                >
                  <Text style={[s.fracBtnText, qty === v && s.fracBtnTextActive]}>
                    {fmtQty(v)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label={`Prix / ${product.unit} (F)`} value={price} onChangeText={setPrice} keyboardType="numeric" />

            <TouchableOpacity style={s.askBossBtn} onPress={() => setPriceRequest(true)} activeOpacity={0.7}>
              <Text style={s.askBossText}>🙋 Demander un prix au patron</Text>
            </TouchableOpacity>

            {qty && price && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>{(qty * parseFloat(price)).toLocaleString('fr-FR')} F</Text>
              </View>
            )}

            <Input label="Client (optionnel)" value={clientName} onChangeText={setClientName} placeholder="Nom du client" />

            <Text style={s.payLabel}>Paiement</Text>
            <View style={s.payGrid}>
              {PAY_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[s.payOpt, payMode === o.key && s.payOptActive]}
                  onPress={() => setPayMode(o.key)}
                >
                  <Text style={{ fontSize: 22, marginBottom: 3 }}>{o.icon}</Text>
                  <Text style={[s.payOptText, payMode === o.key && { color: Colors.forest, fontWeight: '800' }]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {payMode === 'credit' && (
              <Input
                label="Montant payé maintenant (F)"
                value={paidAmount}
                onChangeText={setPaidAmount}
                keyboardType="numeric"
                placeholder="ex: 5000"
                hint="Le reste → crédit client automatique"
              />
            )}

            <Button title="Confirmer la vente →" onPress={confirm} loading={saving} size="lg" style={{ marginTop: 8, backgroundColor: Colors.accent }} />
          </ScrollView>
        )}

        {/* Étape 3 — reçu */}
        {step === 3 && receipt && (
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
              <Text style={{ fontSize: 52 }}>✅</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.text }}>Vente enregistrée !</Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Stock mis à jour automatiquement</Text>
            </View>

            <View style={s.receipt}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.forest, textAlign: 'center' }}>🌿 MamaShop</Text>
              <View style={{ height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border, marginVertical: 10 }} />
              {([
                ['Produit', `${receipt.productName} × ${fmtQty(receipt.qty)} ${receipt.unit}`],
                receipt.clientName ? ['Client', receipt.clientName] : null,
                ['Paiement', receipt.payMode === 'cash' ? '💵 Cash' : receipt.payMode === 'credit' ? '📋 Crédit' : '📱 Mobile'],
                ['Total payé', `${receipt.paid.toLocaleString('fr-FR')} F`],
                receipt.credit > 0 ? ['Reste dû', `${receipt.credit.toLocaleString('fr-FR')} F`] : null,
              ] as ([string, string] | null)[]).filter(Boolean).map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                  <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>{row![0]}</Text>
                  <Text style={{ fontWeight: '700', color: Colors.text }}>{row![1]}</Text>
                </View>
              ))}
            </View>

            <Button title="+ Nouvelle vente" onPress={reset} variant="secondary" size="lg" style={{ marginTop: 12 }} />
            <Button title="Fermer" onPress={() => { onClose(); reset() }} variant="ghost" size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        )}

      </SafeAreaView>

      <PriceRequestModal
        visible={priceRequest}
        onClose={() => setPriceRequest(false)}
        shopId={shopId}
        agentId={agentId}
        product={product}
        clientName={clientName}
        defaultPrice={price}
        onApproved={(p) => setPrice(p.toString())}
      />
    </Modal>
  )
}

const s = StyleSheet.create({
  header:       { backgroundColor: Colors.forest, padding: 20, paddingBottom: 16 },
  backBtn:      { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 10 },
  backText:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  title:        { fontSize: 20, fontWeight: '800', color: '#fff' },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive:    { backgroundColor: Colors.mint, width: 20, borderRadius: 4 },

  empty:        { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptySub:     { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  productCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 12 },
  productEmoji:  { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  productName:   { fontSize: 16, fontWeight: '700', color: Colors.text },
  productDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  selectedBar:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, marginBottom: 16 },
  selectedName:  { fontSize: 15, fontWeight: '700', color: Colors.forest },
  selectedStock: { fontSize: 11, color: Colors.textSecondary },

  qtyRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  qtyBtn:         { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:     { fontSize: 24, fontWeight: '700', color: Colors.text },
  qtyDisplay:     { flex: 1, height: 52, borderRadius: 14, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyDisplayText: { fontSize: 28, fontWeight: '900', color: Colors.text },
  qtyUnit:        { fontSize: 11, color: Colors.textSecondary, marginTop: -2 },
  fracRow:        { flexDirection: 'row' as const, gap: 6, marginBottom: 14, flexWrap: 'wrap' as const },
  fracBtn:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  fracBtnActive:  { borderColor: Colors.forest, backgroundColor: Colors.successLight },
  fracBtnText:    { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  fracBtnTextActive: { color: Colors.forest },

  askBossBtn:  { alignSelf: 'flex-start', backgroundColor: Colors.infoLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, marginTop: -4 },
  askBossText: { fontSize: 13, fontWeight: '700', color: Colors.info },

  totalRow:   { backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 14, flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: Colors.forest },
  totalValue: { fontSize: 22, fontWeight: '900', color: Colors.forest },

  payLabel:    { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  payGrid:     { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
  payOpt:      { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: Colors.background },
  payOptActive: { borderColor: Colors.forest, backgroundColor: Colors.successLight },
  payOptText:  { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  receipt: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
})
