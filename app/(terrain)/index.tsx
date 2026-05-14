import { useEffect, useState } from 'react'
import {
  Alert, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AvatarDisplay } from '../../components/AvatarDisplay'
import { BarChart } from '../../components/BarChart'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { addToQueue, flushQueue } from '../../lib/offlineQueue'
import { getSeasonAlert } from '../../lib/season'
import { supabase } from '../../lib/supabase'
import { Client, Product, Sale } from '../../lib/types'

type PayMode = 'cash' | 'credit' | 'mobile_money'

const MONTHS = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc']
const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function productEmoji(name = '') {
  const n = name.toLowerCase()
  if (n.includes('tomate')) return { emoji: '🍅', bg: '#FFF3E0' }
  if (n.includes('piment')) return { emoji: '🌶️', bg: '#FDF0EE' }
  if (n.includes('oignon')) return { emoji: '🧅', bg: '#F5F0E8' }
  return { emoji: '🌿', bg: '#E8F5EE' }
}

const PAY_OPTIONS: { key: PayMode; icon: string; label: string }[] = [
  { key: 'cash', icon: '💵', label: 'Cash' },
  { key: 'credit', icon: '📋', label: 'Crédit' },
  { key: 'mobile_money', icon: '📱', label: 'Mobile' },
]

export default function TerrainHome() {
  const { profile } = useAuth()
  useHamburgerHeader()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [pendingSync, setPendingSync] = useState(0)

  // Modal vente
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1=produit, 2=quantité/paiement, 3=reçu
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [clientName, setClientName] = useState('')
  const [lastReceipt, setLastReceipt] = useState<any>(null)

  const season = getSeasonAlert()
  const now = new Date()

  useEffect(() => {
    loadData()
    checkSync()
  }, [])

  async function loadData() {
    if (!profile?.shop_id) return
    const today = now.toISOString().split('T')[0]
    const [salesRes, prodRes, clientRes] = await Promise.all([
      supabase.from('sales')
        .select('*, items:sale_items(*, product:products(*)), client:clients(*)')
        .eq('shop_id', profile.shop_id)
        .gte('date', today)
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('shop_id', profile.shop_id).order('name'),
      supabase.from('clients').select('*').eq('shop_id', profile.shop_id),
    ])
    if (salesRes.data) setSales(salesRes.data)
    if (prodRes.data) {
      setProducts(prodRes.data)
      setLowStock(prodRes.data.filter((p: Product) => p.stock_quantity <= p.alert_threshold))
    }
    if (clientRes.data) setClients(clientRes.data)
  }

  async function checkSync() {
    const flushed = await flushQueue(profile?.shop_id ?? '')
    if (flushed > 0) { loadData(); setPendingSync(0) }
  }

  function openSaleModal() {
    setStep(1); setSelectedProduct(null); setQty('1'); setPrice('')
    setPaidAmount(''); setPayMode('cash'); setClientName('')
    setModal(true)
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    setPrice(p.current_price.toString())
    setStep(2)
  }

  async function confirmSale() {
    if (!selectedProduct || !qty || !price || !profile?.shop_id) return
    const total = parseFloat(qty) * parseFloat(price)
    const paid = payMode === 'credit' && paidAmount ? Math.min(parseFloat(paidAmount), total) : total
    const credit = total - paid
    setSaving(true)
    try {
      const { data: sale, error } = await supabase.from('sales').insert({
        shop_id: profile.shop_id,
        created_by: profile.id,
        total_amount: total,
        paid_amount: paid,
        credit_amount: credit,
        date: now.toISOString().split('T')[0],
      }).select().single()

      if (error) {
        await addToQueue({ shop_id: profile.shop_id, created_by: profile.id, total_amount: total, paid_amount: paid, credit_amount: credit, date: now.toISOString().split('T')[0], product_id: selectedProduct.id, product_name: selectedProduct.name, product_unit: selectedProduct.unit, qty: parseFloat(qty), unit_price: parseFloat(price), pay_mode: payMode, client_name: clientName || null })
        setPendingSync(p => p + 1)
        Alert.alert('⏳ Sauvegardé hors ligne', 'La vente sera synchronisée au retour du réseau.')
        setModal(false); return
      }

      await Promise.all([
        supabase.from('sale_items').insert({ sale_id: sale.id, product_id: selectedProduct.id, quantity: parseFloat(qty), unit_price: parseFloat(price), total }),
        // Stock auto-diminue
        supabase.from('products').update({ stock_quantity: Math.max(0, selectedProduct.stock_quantity - parseFloat(qty)) }).eq('id', selectedProduct.id),
      ])

      setLastReceipt({ productName: selectedProduct.name, unit: selectedProduct.unit, qty: parseFloat(qty), price: parseFloat(price), total, paid, credit, clientName, payMode })
      setStep(3)
      loadData()
    } finally { setSaving(false) }
  }

  const totalRevenue = sales.reduce((s, v) => s + v.paid_amount, 0)
  const clientsWithDebt = clients.filter(c => c.total_debt > 0)

  const hourlyData = Array.from({ length: 7 }, (_, i) => {
    const h = 7 + i * 2
    return sales.filter(s => new Date(s.created_at).getHours() >= h && new Date(s.created_at).getHours() < h + 2).reduce((sum, s) => sum + s.paid_amount, 0)
  })

  return (
    <SafeAreaView style={styles.safe} edges={[]}>

      {/* Hero vert */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <AvatarDisplay url={profile?.avatar_url ?? null} size={44} name={profile?.full_name} dark />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Bonjour, {profile?.full_name?.split(' ')[0] ?? '—'}</Text>
            <Text style={styles.heroSub}>{profile?.job_title ?? 'Terrain'}</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{DAYS[now.getDay()]}. {now.getDate()} {MONTHS[now.getMonth()]}</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Ventes</Text>
            <Text style={styles.heroStatValue}>{sales.length}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Encaissé</Text>
            <Text style={[styles.heroStatValue, { color: Colors.amber }]}>
              {totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(0) + 'k' : totalRevenue.toLocaleString()} F
            </Text>
          </View>
        </View>
        {pendingSync > 0 && (
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>⏳ {pendingSync} vente(s) en attente de sync réseau</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} showsVerticalScrollIndicator={false}>

        {/* ═══ BOUTON PRINCIPAL — NOUVELLE VENTE ═══ */}
        <TouchableOpacity
          style={[styles.mainSellBtn, products.length === 0 && styles.mainSellBtnDisabled]}
          onPress={products.length === 0 ? () => Alert.alert('Aucun produit', 'La patronne doit d\'abord créer des produits dans Gestion → Produits.') : openSaleModal}
          activeOpacity={0.85}
        >
          <View style={styles.mainSellIcon}>
            <Text style={{ fontSize: 32 }}>🧾</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainSellLabel}>Nouvelle vente</Text>
            <Text style={styles.mainSellSub}>
              {products.length === 0 ? '⚠️ Aucun produit disponible' : `${products.length} produit(s) · Tap pour vendre`}
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: '#fff' }}>→</Text>
        </TouchableOpacity>

        {/* Alertes stock critique */}
        {lowStock.map(p => (
          <View key={p.id} style={styles.alertStrip}>
            <Text style={styles.alertStripText}>🚨 {p.name} — stock critique : {p.stock_quantity} {p.unit}</Text>
          </View>
        ))}

        {/* 3 boutons secondaires */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: lowStock.length > 0 ? Colors.dangerLight : '#E8F5EE' }]}>
              <Text style={{ fontSize: 26 }}>📦</Text>
            </View>
            {lowStock.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{lowStock.length}</Text></View>}
            <Text style={styles.actionLabel}>Stock</Text>
            <Text style={[styles.actionSub, lowStock.length > 0 && { color: Colors.danger }]}>
              {lowStock.length > 0 ? `${lowStock.length} alerte(s)` : 'OK'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: '#EBF5FB' }]}>
              <Text style={{ fontSize: 26 }}>💰</Text>
            </View>
            {clientsWithDebt.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{clientsWithDebt.length}</Text></View>}
            <Text style={styles.actionLabel}>Dettes</Text>
            <Text style={[styles.actionSub, clientsWithDebt.length > 0 && { color: Colors.info }]}>
              {clientsWithDebt.length > 0 ? `${clientsWithDebt.length} client(s)` : 'Tout soldé ✅'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5EE' }]}>
              <Text style={{ fontSize: 26 }}>🧾</Text>
            </View>
            {sales.length > 0 && <View style={[styles.badge, { backgroundColor: Colors.mint }]}><Text style={styles.badgeText}>{sales.length}</Text></View>}
            <Text style={styles.actionLabel}>Historique</Text>
            <Text style={styles.actionSub}>Mes ventes</Text>
          </TouchableOpacity>
        </View>

        {/* Chart horaire */}
        {sales.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activité du jour</Text>
            <BarChart data={hourlyData} labels={['7h','9h','11h','13h','15h','17h','19h']} height={48} />
          </View>
        )}

        {/* Alerte saisonnière */}
        <View style={styles.seasonStrip}>
          <Text style={{ fontSize: 22 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.seasonTitle}>{season.message}</Text>
            <Text style={styles.seasonSub}>{season.detail}</Text>
          </View>
        </View>

        {/* Dernières ventes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dernières ventes</Text>
          {sales.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32 }}>🕐</Text>
              <Text style={styles.emptyText}>Aucune vente aujourd'hui</Text>
              <Text style={styles.emptySub}>Appuie sur "Nouvelle vente" pour commencer</Text>
            </View>
          ) : (
            sales.slice(0, 5).map(sale => {
              const item = sale.items?.[0]
              const { emoji, bg } = productEmoji(item?.product?.name)
              return (
                <View key={sale.id} style={styles.saleRow}>
                  <View style={[styles.saleEmoji, { backgroundColor: bg }]}>
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleName}>
                      {sale.items?.map(i => `${i.quantity} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ')}
                    </Text>
                    <Text style={styles.saleDetail}>
                      {sale.client?.name ?? 'Comptant'} · {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.saleAmount, sale.credit_amount > 0 && { color: Colors.amber }]}>
                      {sale.paid_amount.toLocaleString('fr-FR')} F
                    </Text>
                    <View style={[styles.payBadge, { backgroundColor: sale.credit_amount > 0 ? Colors.goldLight : Colors.successLight }]}>
                      <Text style={[styles.payBadgeText, { color: sale.credit_amount > 0 ? '#7A4A00' : Colors.forest }]}>
                        {sale.credit_amount > 0 ? 'Crédit' : 'Cash'}
                      </Text>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══ MODAL VENTE — 3 ÉTAPES ═══ */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>

          {/* Header modal */}
          <View style={styles.modalTop}>
            <TouchableOpacity onPress={() => step === 1 ? setModal(false) : setStep(s => (s - 1) as any)} style={styles.modalBackBtn}>
              <Text style={styles.modalBackText}>{step === 1 ? '✕' : '← Retour'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {step === 1 ? 'Quel produit ?' : step === 2 ? 'Quantité & paiement' : 'Vente enregistrée !'}
            </Text>
            <View style={styles.modalSteps}>
              {[1, 2, 3].map(s => (
                <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
              ))}
            </View>
          </View>

          {/* ── ÉTAPE 1 : Choisir le produit ── */}
          {step === 1 && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.stepLabel}>Sélectionne le produit vendu</Text>
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 40 }}>📦</Text>
                  <Text style={styles.emptyText}>Aucun produit disponible</Text>
                  <Text style={styles.emptySub}>La patronne doit créer des produits dans{'\n'}Gestion → Produits</Text>
                </View>
              ) : (
                products.map(p => {
                  const { emoji, bg } = productEmoji(p.name)
                  const isOut = p.stock_quantity <= 0
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.productCard, isOut && styles.productCardOut]}
                      onPress={() => !isOut && selectProduct(p)}
                      disabled={isOut}
                    >
                      <View style={[styles.productEmoji, { backgroundColor: bg }]}>
                        <Text style={{ fontSize: 26 }}>{emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productName}>{p.name}</Text>
                        <Text style={styles.productDetail}>
                          Prix: {p.current_price.toLocaleString('fr-FR')} F/{p.unit}
                        </Text>
                        <Text style={[styles.productStock, p.stock_quantity <= p.alert_threshold && { color: Colors.danger }]}>
                          Stock: {p.stock_quantity} {p.unit}{p.stock_quantity <= 0 ? ' — Rupture !' : p.stock_quantity <= p.alert_threshold ? ' ⚠️' : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 20, color: isOut ? Colors.textTertiary : Colors.forest }}>
                        {isOut ? '✕' : '›'}
                      </Text>
                    </TouchableOpacity>
                  )
                })
              )}
            </ScrollView>
          )}

          {/* ── ÉTAPE 2 : Quantité + Paiement ── */}
          {step === 2 && selectedProduct && (
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {/* Produit sélectionné */}
              <View style={styles.selectedProductBar}>
                <Text style={{ fontSize: 22 }}>{productEmoji(selectedProduct.name).emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                  <Text style={styles.selectedProductStock}>Stock dispo: {selectedProduct.stock_quantity} {selectedProduct.unit}</Text>
                </View>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={{ color: Colors.forest, fontWeight: '700', fontSize: 13 }}>Changer</Text>
                </TouchableOpacity>
              </View>

              {/* Quantité */}
              <Text style={styles.stepLabel}>Quantité vendue</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => Math.max(1, parseInt(q) - 1).toString())}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Input
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  style={styles.qtyInput}
                />
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => (parseInt(q) + 1).toString())}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Input
                label={`Prix unitaire (F/${selectedProduct.unit})`}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder={selectedProduct.current_price.toString()}
              />

              {qty && price && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{(parseFloat(qty) * parseFloat(price)).toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}

              {/* Client */}
              <Input
                label="Client (optionnel)"
                value={clientName}
                onChangeText={setClientName}
                placeholder="Nom du client"
              />

              {/* Mode paiement */}
              <Text style={styles.stepLabel}>Mode de paiement</Text>
              <View style={styles.payGrid}>
                {PAY_OPTIONS.map(o => (
                  <TouchableOpacity key={o.key} style={[styles.payOpt, payMode === o.key && styles.payOptActive]} onPress={() => setPayMode(o.key)}>
                    <Text style={styles.payIcon}>{o.icon}</Text>
                    <Text style={[styles.payLabel, payMode === o.key && { color: Colors.forest, fontWeight: '800' }]}>{o.label}</Text>
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

              <Button
                title="Confirmer la vente →"
                onPress={confirmSale}
                loading={saving}
                size="lg"
                style={{ marginTop: 8, backgroundColor: Colors.forest }}
              />
            </ScrollView>
          )}

          {/* ── ÉTAPE 3 : Reçu ── */}
          {step === 3 && lastReceipt && (
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <View style={styles.receiptSuccess}>
                <Text style={{ fontSize: 52 }}>✅</Text>
                <Text style={styles.receiptSuccessTitle}>Vente enregistrée !</Text>
                <Text style={styles.receiptSuccessNote}>
                  Stock {selectedProduct?.name} mis à jour automatiquement
                </Text>
              </View>

              <View style={styles.receipt}>
                <Text style={styles.receiptShop}>🌿 BiZ-Up Africa</Text>
                <Text style={styles.receiptDate}>
                  {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Produit</Text>
                  <Text style={styles.receiptVal}>{lastReceipt.productName} × {lastReceipt.qty} {lastReceipt.unit}</Text>
                </View>
                {lastReceipt.clientName && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Client</Text>
                    <Text style={styles.receiptVal}>{lastReceipt.clientName}</Text>
                  </View>
                )}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Paiement</Text>
                  <Text style={styles.receiptVal}>
                    {lastReceipt.payMode === 'cash' ? '💵 Cash' : lastReceipt.payMode === 'credit' ? '📋 Crédit' : '📱 Mobile'}
                  </Text>
                </View>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={{ fontWeight: '800', fontSize: 14 }}>TOTAL PAYÉ</Text>
                  <Text style={[styles.receiptVal, { fontSize: 22, color: Colors.forest, fontWeight: '900' }]}>
                    {lastReceipt.paid.toLocaleString('fr-FR')} F
                  </Text>
                </View>
                {lastReceipt.credit > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Reste dû (crédit)</Text>
                    <Text style={[styles.receiptVal, { color: Colors.danger }]}>{lastReceipt.credit.toLocaleString('fr-FR')} F</Text>
                  </View>
                )}
              </View>

              <Button
                title="← Nouvelle vente"
                onPress={() => { setStep(1); setSelectedProduct(null); setQty('1'); setPrice(''); setPaidAmount(''); setClientName(''); setPayMode('cash') }}
                variant="secondary"
                size="lg"
                style={{ marginTop: 12 }}
              />
              <Button
                title="Retour à l'accueil"
                onPress={() => setModal(false)}
                variant="ghost"
                size="lg"
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.heroBg },
  hero: { backgroundColor: Colors.heroBg, padding: 20, paddingBottom: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 11, color: Colors.heroMuted, marginTop: 1 },
  dateBadge: { backgroundColor: 'rgba(46,204,138,0.15)', borderWidth: 1, borderColor: 'rgba(46,204,138,0.3)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  dateBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.mint },
  heroStats: { flexDirection: 'row', gap: 10 },
  heroStat: { flex: 1, backgroundColor: Colors.heroCard, borderWidth: 1, borderColor: Colors.heroBorder, borderRadius: 12, padding: 12 },
  heroStatLabel: { fontSize: 10, color: Colors.heroMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatValue: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 26, marginTop: 3 },
  syncBadge: { marginTop: 10, backgroundColor: 'rgba(232,160,32,0.15)', borderRadius: 8, padding: 8, alignItems: 'center' },
  syncText: { fontSize: 12, color: Colors.amber, fontWeight: '600' },

  // Bouton principal vente
  mainSellBtn: {
    margin: 16, marginBottom: 8,
    backgroundColor: Colors.forest,
    borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: Colors.forest, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  mainSellBtnDisabled: { opacity: 0.6 },
  mainSellIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  mainSellLabel: { fontSize: 18, fontWeight: '800', color: '#fff' },
  mainSellSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  alertStrip: { marginHorizontal: 16, marginBottom: 4, backgroundColor: Colors.dangerLight, borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: Colors.danger },
  alertStripText: { fontSize: 13, fontWeight: '600', color: Colors.danger },

  // 3 boutons secondaires
  grid: { flexDirection: 'row', padding: 16, paddingTop: 8, gap: 10 },
  actionBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, position: 'relative' },
  actionIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: '800', color: Colors.text },
  actionSub: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.danger, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  card: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  seasonStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.goldLight, borderWidth: 1, borderColor: 'rgba(201,146,42,0.2)', borderRadius: 12, padding: 12 },
  seasonTitle: { fontSize: 12, fontWeight: '700', color: Colors.forest },
  seasonSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  saleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  saleEmoji: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saleName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  saleDetail: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saleAmount: { fontSize: 13, fontWeight: '800', color: Colors.success },
  payBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, marginTop: 3 },
  payBadgeText: { fontSize: 9, fontWeight: '700' },

  // Modal vente
  modalTop: { backgroundColor: Colors.forest, padding: 20, paddingBottom: 16 },
  modalBackBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 10 },
  modalBackText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  modalSteps: { flexDirection: 'row', gap: 6, marginTop: 10 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepDotActive: { backgroundColor: Colors.mint, width: 20, borderRadius: 4 },
  stepLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 4 },

  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 12 },
  productCardOut: { opacity: 0.4 },
  productEmoji: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  productDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  productStock: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },

  selectedProductBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, marginBottom: 16 },
  selectedProductName: { fontSize: 15, fontWeight: '700', color: Colors.forest },
  selectedProductStock: { fontSize: 11, color: Colors.textSecondary },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  qtyBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 22, fontWeight: '700', color: Colors.text },
  qtyInput: { textAlign: 'center', fontSize: 24, fontWeight: '900', height: 52 },

  totalRow: { backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: Colors.forest },
  totalValue: { fontSize: 22, fontWeight: '900', color: Colors.forest },

  payGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  payOpt: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: Colors.background },
  payOptActive: { borderColor: Colors.forest, backgroundColor: Colors.successLight },
  payIcon: { fontSize: 24, marginBottom: 4 },
  payLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  receiptSuccess: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  receiptSuccessTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  receiptSuccessNote: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },

  receipt: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderTopWidth: 3, borderTopColor: Colors.forest, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  receiptShop: { fontSize: 16, fontWeight: '700', color: Colors.forest, textAlign: 'center' },
  receiptDate: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 3 },
  receiptDivider: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border, marginVertical: 10 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  receiptLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  receiptVal: { fontWeight: '700', color: Colors.text, fontSize: 13 },
})
