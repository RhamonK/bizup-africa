import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BarChart } from '../../components/BarChart'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { getSeasonAlert } from '../../lib/season'
import { supabase } from '../../lib/supabase'
import { fmt, fmtQty } from '../../utils/helpers'
import { ProductImage } from '../../components/ProductImage'

interface Stats {
  revenueToday: number
  revenueWeek: number
  salesCount: number
  debtTotal: number
  trend30: number[]
  trend30Labels: string[]
  topProducts: { name: string; revenue: number; qty: number }[]
  lowStockProducts: { name: string; qty: number; unit: string; threshold: number }[]
  overdueCreditsCount: number
  shopName: string
}

export default function DiasporaHome() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [profile?.shop_id])

  async function load() {
    if (!profile?.shop_id) return
    const shopId = profile.shop_id
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(now.getTime() - 29 * 86400000).toISOString().split('T')[0]

    const [shopRes, dayRes, trend30Res, debtRes, productsRes, overdueRes] = await Promise.all([
      supabase.from('shops').select('name').eq('id', shopId).single(),
      supabase.from('sales').select('paid_amount, items:sale_items(quantity, total, product:products(name))').eq('shop_id', shopId).gte('date', today),
      supabase.from('sales').select('total_amount, date').eq('shop_id', shopId).gte('date', thirtyDaysAgo).order('date'),
      supabase.from('clients').select('total_debt').eq('shop_id', shopId).gt('total_debt', 0),
      supabase.from('products').select('name, stock_quantity, alert_threshold, unit').eq('shop_id', shopId),
      supabase.from('sales').select('id').eq('shop_id', shopId).gt('credit_amount', 0).lt('date', sevenDaysAgo),
    ])

    // 30-day trend
    const days30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getTime() - (29 - i) * 86400000)
      return d.toISOString().split('T')[0]
    })
    const trend30 = Array(30).fill(0)
    ;(trend30Res.data ?? []).forEach((s: any) => {
      const idx = days30.indexOf(s.date)
      if (idx >= 0) trend30[idx] += s.total_amount
    })
    const trend30Labels = days30.map(d => new Date(d).getDate().toString())

    // Week KPI from 30-day data
    const revenueWeek = (trend30Res.data ?? [])
      .filter((s: any) => s.date >= sevenDaysAgo)
      .reduce((sum: number, s: any) => sum + s.total_amount, 0)

    // Top 3 products today
    const prodMap: Record<string, { name: string; revenue: number; qty: number }> = {}
    ;(dayRes.data ?? []).forEach((sale: any) => {
      ;(sale.items ?? []).forEach((item: any) => {
        const name = item.product?.name ?? 'Inconnu'
        if (!prodMap[name]) prodMap[name] = { name, revenue: 0, qty: 0 }
        prodMap[name].revenue += item.total
        prodMap[name].qty += item.quantity
      })
    })
    const topProducts = Object.values(prodMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)

    // Low stock
    const lowStockProducts = (productsRes.data ?? [])
      .filter((p: any) => p.stock_quantity <= p.alert_threshold)
      .map((p: any) => ({ name: p.name, qty: p.stock_quantity, unit: p.unit, threshold: p.alert_threshold }))

    setLastUpdated(new Date())
    setStats({
      revenueToday: (dayRes.data ?? []).reduce((s: number, r: any) => s + r.paid_amount, 0),
      revenueWeek,
      salesCount: dayRes.data?.length ?? 0,
      debtTotal: (debtRes.data ?? []).reduce((s: number, r: any) => s + r.total_debt, 0),
      trend30,
      trend30Labels,
      topProducts,
      lowStockProducts,
      overdueCreditsCount: overdueRes.data?.length ?? 0,
      shopName: shopRes.data?.name ?? 'Commerce',
    })
  }

  const season = getSeasonAlert()

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} tintColor={Colors.mint} />}
      >
        {/* Hero diaspora */}
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Text style={styles.shopName}>{stats?.shopName ?? '—'}</Text>
            <Text style={styles.heroSub}>Lomé · 🟢 En direct</Text>
            <Text style={styles.revenueDay}>{fmt(stats?.revenueToday ?? 0)}</Text>
            <Text style={styles.revenueLabel}>encaissé aujourd'hui</Text>
          </View>
        </View>

        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: Colors.mint }]}>{fmt(stats?.revenueWeek ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Cette semaine</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{stats?.salesCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Ventes aujourd'hui</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: stats?.debtTotal ? Colors.amber : Colors.mint }]}>
              {fmt(stats?.debtTotal ?? 0)}
            </Text>
            <Text style={styles.kpiLabel}>Impayés</Text>
          </View>
        </View>

        {/* Tendance 30 jours */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tendance — 30 jours</Text>
          {stats && <BarChart data={stats.trend30} labels={stats.trend30Labels} height={64} />}
        </View>

        {/* Top produits aujourd'hui */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top produits aujourd'hui</Text>
          {(stats?.topProducts.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>Aucune vente enregistrée aujourd'hui.</Text>
          ) : (
            stats?.topProducts.map((p, i) => (
              <View key={i} style={styles.prodRow}>
                <ProductImage name={p.name} size={44} borderRadius={12} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.prodName}>{p.name}</Text>
                  <Text style={styles.prodSub}>{fmtQty(p.qty)} vendu(s)</Text>
                </View>
                <Text style={styles.prodRevenue}>{fmt(p.revenue)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Alertes actives */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alertes actives</Text>

          {stats?.lowStockProducts.map((p, i) => (
            <View key={i} style={[styles.alertRow, styles.alertRed]}>
              <Text style={{ fontSize: 18 }}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertText}>{p.name} — stock critique : {p.qty} {p.unit}</Text>
                <Text style={styles.alertSub}>Seuil : {p.threshold}</Text>
              </View>
            </View>
          ))}

          {(stats?.overdueCreditsCount ?? 0) > 0 && (
            <View style={[styles.alertRow, styles.alertAmber]}>
              <Text style={{ fontSize: 18 }}>💰</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertText}>{stats!.overdueCreditsCount} vente(s) avec crédit de plus de 7 jours</Text>
                <Text style={styles.alertSub}>Vérifier les crédits en cours</Text>
              </View>
            </View>
          )}

          {(stats?.lowStockProducts.length ?? 0) === 0 && (stats?.overdueCreditsCount ?? 0) === 0 && (
            <View style={styles.allGood}>
              <Text style={{ fontSize: 32 }}>✅</Text>
              <Text style={styles.allGoodText}>Tout va bien — aucune alerte</Text>
            </View>
          )}

          {/* Alerte saisonnière — toujours visible */}
          <View style={[styles.alertRow, styles.alertGreen, { marginBottom: 0 }]}>
            <Text style={{ fontSize: 18 }}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertText}>{season.message}</Text>
              <Text style={styles.alertSub}>{season.detail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {lastUpdated && (
            <Text style={styles.footerUpdated}>
              Mis à jour à {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <Text style={styles.footerText}>Vue en lecture seule · Famille MamaShop</Text>
          <Text style={styles.footerSub}>Données en temps réel depuis {stats?.shopName}</Text>
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0A1E' },
  hero: {
    backgroundColor: '#2C1654',
    padding: 24,
    paddingBottom: 28,
  },
  heroInner: { alignItems: 'center' },
  shopName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 20 },
  revenueDay: { fontSize: 48, fontWeight: '900', color: '#fff', lineHeight: 52 },
  revenueLabel: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 4 },
  kpiCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, alignItems: 'center',
  },
  kpiValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: 'center', fontWeight: '600', textTransform: 'uppercase' },
  card: {
    margin: 16, marginBottom: 0, backgroundColor: '#fff',
    borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  emptyText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 8 },
  prodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  prodEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  prodName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  prodSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  prodRevenue: { fontSize: 14, fontWeight: '800', color: Colors.forestMid },
  allGood: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  allGoodText: { fontSize: 14, color: Colors.textSecondary },
  alertRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' },
  alertRed: { backgroundColor: Colors.dangerLight },
  alertAmber: { backgroundColor: Colors.warningLight },
  alertGreen: { backgroundColor: Colors.successLight },
  alertText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  alertSub: { fontSize: 10, color: Colors.textSecondary, marginTop: 3 },
  footer: { alignItems: 'center', marginTop: 24, paddingHorizontal: 16 },
  footerUpdated: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  footerSub: { fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 3 },
})
