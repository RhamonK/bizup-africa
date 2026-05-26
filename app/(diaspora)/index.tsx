import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface Stats {
  revenueToday: number
  revenueWeek: number
  salesCount: number
  debtTotal: number
  alerts: { id: string; message: string; type: string; created_at: string }[]
  trend: number[] // 7 derniers jours
  shopName: string
}

function MiniBar({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48 }}>
      {values.map((v, i) => {
        const isToday = i === values.length - 1
        const h = Math.max(4, (v / max) * 48)
        return (
          <View key={i} style={{ flex: 1, height: h, borderRadius: 3,
            backgroundColor: isToday ? Colors.mint : 'rgba(46,204,138,0.25)' }} />
        )
      })}
    </View>
  )
}

export default function DiasporaHome() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!profile?.shop_id) return
    const shopId = profile.shop_id
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

    const [shopRes, dayRes, weekRes, debtRes, alertRes] = await Promise.all([
      supabase.from('shops').select('name').eq('id', shopId).single(),
      supabase.from('sales').select('paid_amount').eq('shop_id', shopId).gte('date', today),
      supabase.from('sales').select('paid_amount, date').eq('shop_id', shopId).gte('date', weekAgo).order('date'),
      supabase.from('clients').select('total_debt').eq('shop_id', shopId).gt('total_debt', 0),
      supabase.from('alerts').select('*').eq('shop_id', shopId).eq('lu', false).order('created_at', { ascending: false }).limit(5),
    ])

    // Trend 7 jours
    const trend = Array(7).fill(0)
    ;(weekRes.data ?? []).forEach((s: any) => {
      const d = new Date(s.date)
      const idx = 6 - Math.floor((now.getTime() - d.getTime()) / 86400000)
      if (idx >= 0 && idx < 7) trend[idx] += s.paid_amount
    })

    setStats({
      revenueToday: (dayRes.data ?? []).reduce((s: number, r: any) => s + r.paid_amount, 0),
      revenueWeek: (weekRes.data ?? []).reduce((s: number, r: any) => s + r.paid_amount, 0),
      salesCount: dayRes.data?.length ?? 0,
      debtTotal: (debtRes.data ?? []).reduce((s: number, r: any) => s + r.total_debt, 0),
      alerts: alertRes.data ?? [],
      trend,
      shopName: shopRes.data?.name ?? 'Commerce',
    })
  }

  const fmt = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M F'
    if (n >= 1000) return (n / 1000).toFixed(0) + 'k F'
    return n.toLocaleString('fr-FR') + ' F'
  }

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

        {/* Tendance 7j */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tendance — 7 jours</Text>
          {stats && <MiniBar values={stats.trend} />}
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {['J-6','J-5','J-4','J-3','J-2','Hier','Auj.'].map((l, i) => (
              <Text key={i} style={[styles.barLabel, i === 6 && { color: Colors.mint, fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Alertes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alertes actives</Text>
          {(stats?.alerts.length ?? 0) === 0 ? (
            <View style={styles.allGood}>
              <Text style={{ fontSize: 32 }}>✅</Text>
              <Text style={styles.allGoodText}>Tout va bien — aucune alerte</Text>
            </View>
          ) : (
            stats?.alerts.map(a => (
              <View key={a.id} style={[styles.alertRow,
                a.type === 'stock_faible' ? styles.alertRed :
                a.type === 'impaye' ? styles.alertAmber : styles.alertGreen
              ]}>
                <Text style={{ fontSize: 18 }}>
                  {a.type === 'stock_faible' ? '🚨' : a.type === 'impaye' ? '💰' : '📅'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertText}>{a.message}</Text>
                  <Text style={styles.alertTime}>
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
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
  barLabel: { flex: 1, fontSize: 8, color: Colors.textTertiary, textAlign: 'center' },
  allGood: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  allGoodText: { fontSize: 14, color: Colors.textSecondary },
  alertRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' },
  alertRed: { backgroundColor: Colors.dangerLight },
  alertAmber: { backgroundColor: Colors.warningLight },
  alertGreen: { backgroundColor: Colors.successLight },
  alertText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  alertTime: { fontSize: 10, color: Colors.textSecondary, marginTop: 3 },
  footer: { alignItems: 'center', marginTop: 24, paddingHorizontal: 16 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  footerSub: { fontSize: 11, color: 'rgba(255,255,255,0.15)', marginTop: 3 },
})
