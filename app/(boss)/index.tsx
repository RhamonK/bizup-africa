import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { AvatarDisplay } from '../../components/AvatarDisplay'
import { BarChart } from '../../components/BarChart'
import { PriceApprovalModal } from '../../components/PriceApprovalModal'
import { SaleModal } from '../../components/SaleModal'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { getSeasonAlert } from '../../lib/season'
import { Client, PriceRequest, Product, Sale, SaleItem } from '../../lib/types'
import { formatDate, fmtQty } from '../../utils/helpers'
import { ProductImage } from '../../components/ProductImage'
import { getClients } from '../../services/clients'
import { getPendingPriceRequests, subscribeToPendingPriceRequests } from '../../services/priceRequests'
import { getProducts } from '../../services/products'
import { subscribeToShopSales } from '../../services/realtime'
import { getSalesByDate, getSalesTrend, SaleAmountRow } from '../../services/sales'

export default function BossDashboard() {
  const { profile } = useAuth()
  useHamburgerHeader()

  const [todaySales, setTodaySales] = useState<Sale[]>([])
  const [alertProducts, setAlertProducts] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [debtTotal, setDebtTotal] = useState(0)
  const [trend, setTrend] = useState<number[]>(Array(7).fill(0))
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; qty: number }[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [saleModal, setSaleModal] = useState(false)
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([])
  const [approvalOpen, setApprovalOpen] = useState(false)

  const season = getSeasonAlert()
  const now = new Date()

  useEffect(() => {
    loadAll()
    if (!profile?.shop_id) return
    loadPriceRequests()

    const unsubSales = subscribeToShopSales(profile.shop_id, loadAll)
    const unsubPrices = subscribeToPendingPriceRequests(profile.shop_id, loadPriceRequests)
    return () => { unsubSales(); unsubPrices() }
  }, [profile?.shop_id])

  async function loadPriceRequests() {
    if (!profile?.shop_id) return
    const { data } = await getPendingPriceRequests(profile.shop_id)
    if (data) setPriceRequests(data as unknown as PriceRequest[])
  }

  async function loadAll() {
    if (!profile?.shop_id) return
    const shopId = profile.shop_id
    const today = now.toISOString().split('T')[0]
    const days7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000)
      return d.toISOString().split('T')[0]
    })

    const [todayRes, weekRes, productRes, clientRes] = await Promise.all([
      getSalesByDate(shopId, today),
      getSalesTrend(shopId, days7[0]),
      getProducts(shopId),
      getClients(shopId),
    ])

    if (todayRes.data) setTodaySales(todayRes.data)
    if (productRes.data) {
      setProducts(productRes.data)
      setAlertProducts(productRes.data.filter((p: Product) => p.stock_quantity <= p.alert_threshold))
    }
    if (clientRes.data) {
      setDebtTotal(clientRes.data.reduce((s: number, c: Client) => s + Math.max(0, c.total_debt), 0))
    }

    const t = Array(7).fill(0)
    ;(weekRes.data ?? []).forEach((s: SaleAmountRow) => {
      const idx = days7.indexOf(s.date)
      if (idx >= 0) t[idx] += s.paid_amount
    })
    setTrend(t)

    const prodMap: Record<string, { name: string; revenue: number; qty: number }> = {}
    ;(todayRes.data ?? []).forEach((sale: Sale) => {
      ;(sale.items ?? []).forEach((item: SaleItem) => {
        const name = item.product?.name ?? 'Inconnu'
        if (!prodMap[name]) prodMap[name] = { name, revenue: 0, qty: 0 }
        prodMap[name].revenue += item.total
        prodMap[name].qty += item.quantity
      })
    })
    setTopProducts(Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 3))
  }

  const todayRevenue = todaySales.reduce((s, v) => s + v.paid_amount, 0)
  const todayCredit  = todaySales.reduce((s, v) => s + v.credit_amount, 0)

  const alerts = [
    ...alertProducts.map(p => ({ style: 'red',   icon: '!', text: `${p.name} — stock critique : ${p.stock_quantity} ${p.unit}`, sub: `Seuil : ${p.alert_threshold} · Commander maintenant` })),
    ...(debtTotal > 0 ? [{ style: 'amber', icon: '$', text: `${debtTotal.toLocaleString('fr-FR')} F d'impayés en cours`,           sub: 'Vérifier les clients avec dettes' }] : []),
    { style: 'green', icon: '↻', text: season.message, sub: season.detail },
  ]

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.root}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAll(); setRefreshing(false) }} tintColor={Colors.mint} />}
      >
        {/* Hero KPIs — fond crème, texte sombre */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <AvatarDisplay url={profile?.avatar_url ?? null} size={44} name={profile?.full_name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{profile?.full_name ?? '—'}</Text>
              <Text style={styles.heroSub}>Gérant(e) · En direct</Text>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{formatDate(now)}</Text>
            </View>
          </View>
          <View style={styles.kpis}>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: Colors.forest }]}>{todayRevenue >= 1000 ? (todayRevenue / 1000).toFixed(0) + 'k' : todayRevenue.toLocaleString()}</Text>
              <Text style={styles.kpiLbl}>Ventes F</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: Colors.warm }]}>{todayCredit >= 1000 ? (todayCredit / 1000).toFixed(0) + 'k' : todayCredit.toLocaleString()}</Text>
              <Text style={styles.kpiLbl}>Crédit F</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: alertProducts.length > 0 ? Colors.accent : Colors.forest }]}>{alertProducts.length}</Text>
              <Text style={styles.kpiLbl}>Critique</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: Colors.forest }]}>23%</Text>
              <Text style={styles.kpiLbl}>Marge</Text>
            </View>
          </View>
        </View>

        <View style={styles.scroll}>
          {/* Demandes de prix en attente — temps réel */}
          {priceRequests.length > 0 && (
            <TouchableOpacity style={styles.priceReqBanner} activeOpacity={0.85} onPress={() => setApprovalOpen(true)}>
              <Text style={{ fontSize: 26 }}>🙋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.priceReqTitle}>{priceRequests.length} demande(s) de prix</Text>
                <Text style={styles.priceReqSub}>Un agent attend ta réponse · Tap pour répondre</Text>
              </View>
              <Text style={{ fontSize: 22, color: Colors.forest }}>→</Text>
            </TouchableOpacity>
          )}

          {/* Chart 7 jours */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ventes — 7 jours</Text>
            <BarChart data={trend} height={64} />
          </View>

          {/* Alertes */}
          {alerts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Alertes actives</Text>
              {alerts.map((a, i) => (
                <View key={i} style={[styles.alertRow, a.style === 'red' ? styles.alertRed : a.style === 'amber' ? styles.alertAmber : styles.alertGreen]}>
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
              {topProducts.map((p, i) => (
                <View key={i} style={styles.prodRow}>
                  <ProductImage name={p.name} photoUrl={products.find(pr => pr.name === p.name)?.photo_url} size={44} borderRadius={14} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.prodName}>{p.name}</Text>
                    <Text style={styles.prodDetail}>{fmtQty(p.qty)} unités vendues</Text>
                  </View>
                  <Text style={styles.prodAmount}>{p.revenue.toLocaleString('fr-FR')} F</Text>
                </View>
              ))}
            </View>
          )}

          {/* Dernières ventes */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dernières ventes du jour</Text>
            {todaySales.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, textAlign: 'center', padding: 16 }}>Aucune vente aujourd'hui</Text>
            ) : todaySales.slice(0, 5).map(sale => {
              const firstItem = sale.items?.[0]
              return (
                <View key={sale.id} style={styles.prodRow}>
                  <ProductImage name={firstItem?.product?.name ?? ''} photoUrl={firstItem?.product?.photo_url} size={44} borderRadius={14} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.prodName}>
                      {sale.items?.map(i => `${fmtQty(i.quantity)} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ') || '—'}
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
            })}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setSaleModal(true)}>
        <Text style={styles.fabText}>+ Vente</Text>
      </TouchableOpacity>

      <SaleModal
        visible={saleModal}
        onClose={() => setSaleModal(false)}
        products={products}
        shopId={profile?.shop_id ?? ''}
        agentId={profile?.id ?? ''}
        onSaleCreated={loadAll}
      />

      <PriceApprovalModal
        visible={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        bossId={profile?.id ?? ''}
        requests={priceRequests}
        onResolved={loadPriceRequests}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.background },
  hero:          { backgroundColor: Colors.background, padding: 20, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  heroTop:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroName:      { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroSub:       { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  dateBadge:     { backgroundColor: Colors.successLight, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  dateBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.forest },
  kpis:          { flexDirection: 'row', gap: 8 },
  kpi:           { flex: 1, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.borderLight, borderRadius: 12, padding: 10, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  kpiVal:        { fontSize: 15, fontWeight: '800', color: Colors.text },
  kpiLbl:        { fontSize: 9, color: Colors.textTertiary, marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  scroll:        { padding: 16, gap: 12 },
  priceReqBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.goldLight, borderWidth: 1, borderColor: Colors.gold, borderRadius: 14, padding: 14 },
  priceReqTitle:  { fontSize: 15, fontWeight: '800', color: Colors.text },
  priceReqSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  card:          { backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle:     { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  alertRow:      { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' },
  alertRed:      { backgroundColor: Colors.dangerLight },
  alertAmber:    { backgroundColor: Colors.warningLight },
  alertGreen:    { backgroundColor: Colors.successLight },
  alertIcon:     { fontSize: 18, lineHeight: 22 },
  alertText:     { fontSize: 13, fontWeight: '600', color: Colors.text, lineHeight: 18 },
  alertSub:      { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  prodRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  prodEmoji:     { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  prodName:      { fontSize: 14, fontWeight: '700', color: Colors.text },
  prodDetail:    { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  prodAmount:    { fontSize: 15, fontWeight: '900', color: Colors.forestMid },
  creditBadge:   { backgroundColor: Colors.goldLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginTop: 3 },
  creditBadgeText: { fontSize: 9, fontWeight: '700', color: '#7A4A00' },
  fab:           { position: 'absolute', bottom: 20, right: 20, backgroundColor: Colors.accent, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 14, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  fabText:       { color: '#fff', fontSize: 15, fontWeight: '800' },
})
