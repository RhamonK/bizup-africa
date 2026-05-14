import { useEffect, useState } from 'react'
import {
  Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AvatarDisplay } from '../../components/AvatarDisplay'
import { BarChart } from '../../components/BarChart'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { getSeasonAlert } from '../../lib/season'
import { supabase } from '../../lib/supabase'
import { Client, Product, Sale } from '../../lib/types'

type PayMode = 'cash' | 'credit' | 'mobile_money'
const PAY_OPTIONS: { key: PayMode; icon: string; label: string }[] = [
  { key: 'cash', icon: '💵', label: 'Cash' },
  { key: 'credit', icon: '📋', label: 'Crédit' },
  { key: 'mobile_money', icon: '📱', label: 'Mobile' },
]

function productEmoji(name = '') {
  const n = name.toLowerCase()
  if (n.includes('tomate')) return { emoji: '🍅', bg: '#FFF3E0' }
  if (n.includes('piment')) return { emoji: '🌶️', bg: '#FDF0EE' }
  if (n.includes('oignon')) return { emoji: '🧅', bg: '#F5F0E8' }
  return { emoji: '🌿', bg: '#E8F5EE' }
}

const MONTHS = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc']
const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M F'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k F'
  return n.toLocaleString('fr-FR') + ' F'
}

export default function BossDashboard() {
  const { profile } = useAuth()
  const [todaySales, setTodaySales] = useState<Sale[]>([])
  const [alertProducts, setAlertProducts] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [debtTotal, setDebtTotal] = useState(0)
  const [trend, setTrend] = useState<number[]>(Array(7).fill(0))
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; qty: number }[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [recentAlerts, setRecentAlerts] = useState<any[]>([])

  // Modal vente boss
  const [saleModal, setSaleModal] = useState(false)
  const [saleStep, setSaleStep] = useState<1|2|3>(1)
  const [selProduct, setSelProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [payMode, setPayMode] = useState<PayMode>('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [clientName, setClientName] = useState('')
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)

  const season = getSeasonAlert()
  const now = new Date()
  const dateLabel = `${DAYS[now.getDay()]}. ${now.getDate()} ${MONTHS[now.getMonth()]}`

  useEffect(() => {
    loadAll()
    if (!profile?.shop_id) return
    const channel = supabase
      .channel('boss-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales', filter: `shop_id=eq.${profile.shop_id}` }, () => loadAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.shop_id])

  async function loadAll() {
    if (!profile?.shop_id) return
    const shopId = profile.shop_id
    const today = now.toISOString().split('T')[0]

    // 7 jours de dates
    const days7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000)
      return d.toISOString().split('T')[0]
    })
    const weekAgo = days7[0]

    const [todayRes, weekRes, productRes, debtRes, alertRes, clientRes] = await Promise.all([
      supabase.from('sales').select('*, items:sale_items(*, product:products(*)), client:clients(*)').eq('shop_id', shopId).gte('date', today).order('created_at', { ascending: false }),
      supabase.from('sales').select('paid_amount, date').eq('shop_id', shopId).gte('date', weekAgo),
      supabase.from('products').select('*').eq('shop_id', shopId),
      supabase.from('clients').select('total_debt').eq('shop_id', shopId).gt('total_debt', 0),
      supabase.from('alerts').select('*').eq('shop_id', shopId).eq('lu', false).order('created_at', { ascending: false }).limit(5),
      supabase.from('clients').select('*').eq('shop_id', shopId),
    ])

    if (todayRes.data) setTodaySales(todayRes.data)
    if (productRes.data) {
      setProducts(productRes.data)
      setAlertProducts(productRes.data.filter((p: Product) => p.stock_quantity <= p.alert_threshold))
    }
    setDebtTotal((debtRes.data ?? []).reduce((s: number, r: any) => s + r.total_debt, 0))
    if (alertRes.data) setRecentAlerts(alertRes.data)
    if (clientRes.data) setClients(clientRes.data)

    // Trend 7j
    const t = Array(7).fill(0)
    ;(weekRes.data ?? []).forEach((s: any) => {
      const idx = days7.indexOf(s.date)
      if (idx >= 0) t[idx] += s.paid_amount
    })
    setTrend(t)

    // Top produits
    const prodMap: Record<string, { name: string; revenue: number; qty: number }> = {}
    ;(todayRes.data ?? []).forEach((sale: any) => {
      ;(sale.items ?? []).forEach((item: any) => {
        const name = item.product?.name ?? 'Inconnu'
        if (!prodMap[name]) prodMap[name] = { name, revenue: 0, qty: 0 }
        prodMap[name].revenue += item.total
        prodMap[name].qty += item.quantity
      })
    })
    setTopProducts(Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 3))
  }

  async function confirmSale() {
    if (!selProduct || !qty || !price || !profile?.shop_id) return
    const total = parseFloat(qty) * parseFloat(price)
    const paid = payMode === 'credit' && paidAmount ? Math.min(parseFloat(paidAmount), total) : total
    const credit = total - paid
    setSaving(true)
    const { data: sale, error } = await supabase.from('sales').insert({
      shop_id: profile.shop_id, created_by: profile.id,
      total_amount: total, paid_amount: paid, credit_amount: credit,
      date: now.toISOString().split('T')[0],
    }).select().single()
    if (!error && sale) {
      await Promise.all([
        supabase.from('sale_items').insert({ sale_id: sale.id, product_id: selProduct.id, quantity: parseFloat(qty), unit_price: parseFloat(price), total }),
        supabase.from('products').update({ stock_quantity: Math.max(0, selProduct.stock_quantity - parseFloat(qty)) }).eq('id', selProduct.id),
      ])
      setReceipt({ productName: selProduct.name, unit: selProduct.unit, qty: parseFloat(qty), total, paid, credit, payMode, clientName })
      setSaleStep(3)
      loadAll()
    }
    setSaving(false)
  }

  function resetSaleForm() {
    setSaleStep(1); setSelProduct(null); setQty('1'); setPrice('')
    setPayMode('cash'); setPaidAmount(''); setClientName(''); setReceipt(null)
  }

  const todayRevenue = todaySales.reduce((s, v) => s + v.paid_amount, 0)
  const todayCredit = todaySales.reduce((s, v) => s + v.credit_amount, 0)
  const avgMargin = 23 // placeholder — calculé dans l'écran Marges

  const dynamicAlerts = [
    ...alertProducts.map(p => ({
      type: 'stock_faible' as const,
      icon: '!',
      style: 'red',
      text: `${p.name} — stock critique : ${p.stock_quantity} ${p.unit}`,
      sub: `Seuil : ${p.alert_threshold} · Commander maintenant`,
    })),
    ...(debtTotal > 0 ? [{
      type: 'impaye' as const,
      icon: '$',
      style: 'amber',
      text: `${debtTotal.toLocaleString('fr-FR')} F d'impayés en cours`,
      sub: 'Vérifier les clients avec dettes',
    }] : []),
    {
      type: 'saison' as const,
      icon: '↻',
      style: 'green',
      text: season.message,
      sub: season.detail,
    },
  ]

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAll(); setRefreshing(false) }} tintColor={Colors.mint} />}
    >
      {/* Hero sombre — KPIs */}
      <View style={styles.heroDash}>
        {/* Ligne nom + date */}
        <View style={styles.heroTop}>
          <AvatarDisplay url={profile?.avatar_url ?? null} size={44} name={profile?.full_name} dark />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{profile?.full_name ?? '—'}</Text>
            <Text style={styles.heroSub}>Gérant(e) · En direct</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{dateLabel}</Text>
          </View>
        </View>

        {/* 4 KPIs */}
        <View style={styles.kpis}>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: Colors.mint }]}>{todayRevenue >= 1000 ? (todayRevenue/1000).toFixed(0) + 'k' : todayRevenue.toLocaleString()}</Text>
            <Text style={styles.kpiLbl}>Ventes F</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: Colors.amber }]}>{todayCredit >= 1000 ? (todayCredit/1000).toFixed(0) + 'k' : todayCredit.toLocaleString()}</Text>
            <Text style={styles.kpiLbl}>Crédit F</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: alertProducts.length > 0 ? '#FF7675' : Colors.mint }]}>{alertProducts.length}</Text>
            <Text style={styles.kpiLbl}>Critique</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: Colors.mint }]}>{avgMargin}%</Text>
            <Text style={styles.kpiLbl}>Marge</Text>
          </View>
        </View>
      </View>

      <View style={styles.scroll}>
        {/* Chart 7 jours */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ventes — 7 jours</Text>
          <BarChart data={trend} height={64} />
        </View>

        {/* Alertes */}
        {dynamicAlerts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Alertes actives</Text>
            {dynamicAlerts.map((a, i) => (
              <View key={i} style={[styles.alertRow,
                a.style === 'red' ? styles.alertRed :
                a.style === 'amber' ? styles.alertAmber : styles.alertGreen
              ]}>
                <Text style={styles.alertIcon}>{a.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertText}>{a.text}</Text>
                  {a.sub && <Text style={styles.alertSub}>{a.sub}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Top produits */}
        {topProducts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top produits aujourd'hui</Text>
            {topProducts.map((p, i) => {
              const { emoji, bg } = productEmoji(p.name)
              return (
                <View key={i} style={styles.prodRow}>
                  <View style={[styles.prodEmoji, { backgroundColor: bg }]}>
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>{p.name}</Text>
                    <Text style={styles.prodDetail}>{p.qty} unités vendues</Text>
                  </View>
                  <Text style={styles.prodAmount}>{p.revenue.toLocaleString('fr-FR')} F</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Dernières ventes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dernières ventes du jour</Text>
          {todaySales.length === 0 ? (
            <Text style={{ color: Colors.textSecondary, textAlign: 'center', padding: 16 }}>Aucune vente aujourd'hui</Text>
          ) : (
            todaySales.slice(0, 5).map(sale => {
              const firstItem = sale.items?.[0]
              const { emoji, bg } = productEmoji(firstItem?.product?.name)
              return (
                <View key={sale.id} style={styles.prodRow}>
                  <View style={[styles.prodEmoji, { backgroundColor: bg }]}>
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>
                      {sale.items?.map(i => `${i.quantity} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ') || '—'}
                    </Text>
                    <Text style={styles.prodDetail}>
                      {sale.client?.name ?? 'Comptant'} · {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.prodAmount, sale.credit_amount > 0 && { color: Colors.amber }]}>
                      {sale.paid_amount.toLocaleString('fr-FR')} F
                    </Text>
                    {sale.credit_amount > 0 && (
                      <View style={styles.creditBadge}><Text style={styles.creditBadgeText}>Crédit</Text></View>
                    )}
                  </View>
                </View>
              )
            })
          )}
        </View>
      </View>
    </ScrollView>

    {/* FAB — Nouvelle vente */}
    <TouchableOpacity style={styles.fab} onPress={() => { resetSaleForm(); setSaleModal(true) }}>
      <Text style={styles.fabText}>+ Vente</Text>
    </TouchableOpacity>

    {/* Modal vente boss */}
    <Modal visible={saleModal} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={styles.modalTop}>
          <TouchableOpacity onPress={() => saleStep === 1 ? setSaleModal(false) : setSaleStep(s => (s - 1) as any)} style={styles.modalBackBtn}>
            <Text style={styles.modalBackText}>{saleStep === 1 ? '✕ Fermer' : '← Retour'}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {saleStep === 1 ? 'Quel produit ?' : saleStep === 2 ? 'Quantité & paiement' : 'Vente enregistrée !'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {[1,2,3].map(s => <View key={s} style={[styles.stepDot, saleStep >= s && styles.stepDotActive]} />)}
          </View>
        </View>

        {/* Étape 1 — produit */}
        {saleStep === 1 && (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {products.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
                <Text style={{ fontSize: 40 }}>📦</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.text }}>Aucun produit</Text>
                <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>Crée d'abord des produits dans Gestion → Produits</Text>
              </View>
            ) : products.map(p => {
              const { emoji, bg } = productEmoji(p.name)
              const isOut = p.stock_quantity <= 0
              return (
                <TouchableOpacity key={p.id} disabled={isOut}
                  onPress={() => { setSelProduct(p); setPrice(p.current_price.toString()); setSaleStep(2) }}
                  style={[styles.productCard, isOut && { opacity: 0.4 }]}>
                  <View style={[styles.productEmoji, { backgroundColor: bg }]}><Text style={{ fontSize: 26 }}>{emoji}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{p.name}</Text>
                    <Text style={styles.productDetail}>{p.current_price.toLocaleString('fr-FR')} F/{p.unit} · Stock: {p.stock_quantity} {p.unit}{isOut ? ' — RUPTURE' : ''}</Text>
                  </View>
                  <Text style={{ fontSize: 20, color: isOut ? Colors.textTertiary : Colors.forest }}>{isOut ? '✕' : '›'}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Étape 2 — quantité & paiement */}
        {saleStep === 2 && selProduct && (
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={styles.selectedBar}>
              <Text style={{ fontSize: 22 }}>{productEmoji(selProduct.name).emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.forest }}>{selProduct.name}</Text>
                <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Stock: {selProduct.stock_quantity} {selProduct.unit}</Text>
              </View>
              <TouchableOpacity onPress={() => setSaleStep(1)}><Text style={{ color: Colors.forest, fontWeight: '700' }}>Changer</Text></TouchableOpacity>
            </View>

            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => Math.max(1, parseInt(q || '1') - 1).toString())}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Input value={qty} onChangeText={setQty} keyboardType="numeric" style={styles.qtyInput} />
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => (parseInt(q || '1') + 1).toString())}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Input label={`Prix / ${selProduct.unit} (F)`} value={price} onChangeText={setPrice} keyboardType="numeric" />

            {qty && price && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{(parseFloat(qty) * parseFloat(price)).toLocaleString('fr-FR')} F</Text>
              </View>
            )}

            <Input label="Client (optionnel)" value={clientName} onChangeText={setClientName} placeholder="Nom du client" />

            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>Paiement</Text>
            <View style={styles.payGrid}>
              {PAY_OPTIONS.map(o => (
                <TouchableOpacity key={o.key} style={[styles.payOpt, payMode === o.key && styles.payOptActive]} onPress={() => setPayMode(o.key)}>
                  <Text style={{ fontSize: 22, marginBottom: 3 }}>{o.icon}</Text>
                  <Text style={[{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary }, payMode === o.key && { color: Colors.forest, fontWeight: '800' }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {payMode === 'credit' && (
              <Input label="Montant payé maintenant (F)" value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" placeholder="ex: 5000" hint="Le reste → crédit client automatique" />
            )}

            <Button title="Confirmer →" onPress={confirmSale} loading={saving} size="lg" style={{ marginTop: 8, backgroundColor: Colors.forest }} />
          </ScrollView>
        )}

        {/* Étape 3 — reçu */}
        {saleStep === 3 && receipt && (
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
              <Text style={{ fontSize: 52 }}>✅</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.text }}>Vente enregistrée !</Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Stock mis à jour automatiquement</Text>
            </View>
            <View style={styles.receipt}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.forest, textAlign: 'center' }}>🌿 BiZ-Up Africa</Text>
              <View style={{ height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.border, marginVertical: 10 }} />
              {[
                ['Produit', `${receipt.productName} × ${receipt.qty} ${receipt.unit}`],
                receipt.clientName ? ['Client', receipt.clientName] : null,
                ['Paiement', receipt.payMode === 'cash' ? '💵 Cash' : receipt.payMode === 'credit' ? '📋 Crédit' : '📱 Mobile'],
                ['Total payé', `${receipt.paid.toLocaleString('fr-FR')} F`],
                receipt.credit > 0 ? ['Reste dû', `${receipt.credit.toLocaleString('fr-FR')} F`] : null,
              ].filter(Boolean).map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
                  <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>{(row as string[])[0]}</Text>
                  <Text style={{ fontWeight: '700', color: Colors.text }}>{(row as string[])[1]}</Text>
                </View>
              ))}
            </View>
            <Button title="+ Nouvelle vente" onPress={() => { setSaleStep(1); setSelProduct(null); setQty('1'); setPrice(''); setPaidAmount(''); setClientName(''); setPayMode('cash') }} variant="secondary" size="lg" style={{ marginTop: 12 }} />
            <Button title="Fermer" onPress={() => setSaleModal(false)} variant="ghost" size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  heroDash: {
    backgroundColor: Colors.forest,
    padding: 20,
    paddingTop: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroAvatar: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden' },
  heroName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  dateBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  dateBadgeText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, alignItems: 'center' },
  kpiVal: { fontSize: 15, fontWeight: '800', color: '#fff' },
  kpiLbl: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  scroll: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  alertRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' },
  alertRed: { backgroundColor: Colors.dangerLight, borderLeftWidth: 3, borderLeftColor: Colors.danger },
  alertAmber: { backgroundColor: Colors.warningLight, borderLeftWidth: 3, borderLeftColor: Colors.amber },
  alertGreen: { backgroundColor: Colors.successLight, borderLeftWidth: 3, borderLeftColor: Colors.mint },
  alertIcon: { fontSize: 18, lineHeight: 22 },
  alertText: { fontSize: 13, fontWeight: '600', color: Colors.text, lineHeight: 18 },
  alertSub: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  prodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  prodEmoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  prodName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  prodDetail: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  prodAmount: { fontSize: 15, fontWeight: '900', color: Colors.forestMid },
  creditBadge: { backgroundColor: Colors.goldLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginTop: 3 },
  creditBadgeText: { fontSize: 9, fontWeight: '700', color: '#7A4A00' },

  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    backgroundColor: Colors.forest, borderRadius: 28,
    paddingHorizontal: 22, paddingVertical: 14,
    shadowColor: Colors.forest, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Modal vente
  modalTop: { backgroundColor: Colors.forest, padding: 20, paddingBottom: 16 },
  modalBackBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 10 },
  modalBackText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepDotActive: { backgroundColor: Colors.mint, width: 20, borderRadius: 4 },
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, gap: 12 },
  productEmoji: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  productDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  selectedBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, marginBottom: 16 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  qtyBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 22, fontWeight: '700', color: Colors.text },
  qtyInput: { textAlign: 'center', fontSize: 24, fontWeight: '900', height: 52, flex: 1 },
  totalRow: { backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: Colors.forest },
  totalValue: { fontSize: 22, fontWeight: '900', color: Colors.forest },
  payGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  payOpt: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: Colors.background },
  payOptActive: { borderColor: Colors.forest, backgroundColor: Colors.successLight },
  receipt: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderTopWidth: 3, borderTopColor: Colors.forest },
})
