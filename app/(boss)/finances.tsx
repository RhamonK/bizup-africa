import { useEffect, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card } from '../../components/Card'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface FinanceData {
  revenue30: number
  revenue90: number
  revenueTotal: number
  totalDebt: number
  totalSales: number
  avgDailySales: number
  topProduct: string
  debtRatio: number
  shopName: string
  startDate: string
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={statStyles.row}>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={[statStyles.value, color ? { color } : {}]}>{value}</Text>
    </View>
  )
}
const statStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  label: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  value: { fontSize: 14, fontWeight: '700', color: Colors.text },
})

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? Colors.success : score >= 40 ? Colors.warning : Colors.danger
  const label = score >= 70 ? 'Éligible microfinance' : score >= 40 ? 'En cours de constitution' : 'Historique insuffisant'
  return (
    <View style={[badgeStyles.container, { backgroundColor: color + '15', borderColor: color }]}>
      <Text style={[badgeStyles.score, { color }]}>{score}/100</Text>
      <Text style={[badgeStyles.label, { color }]}>{label}</Text>
    </View>
  )
}
const badgeStyles = StyleSheet.create({
  container: { borderWidth: 2, borderRadius: 16, padding: 20, alignItems: 'center', marginVertical: 16 },
  score: { fontSize: 48, fontWeight: '900' },
  label: { fontSize: 14, fontWeight: '700', marginTop: 4 },
})

export default function FinancesScreen() {
  const { profile } = useAuth()
  const [data, setData] = useState<FinanceData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    if (!profile?.shop_id) return
    const shopId = profile.shop_id
    const now = new Date()
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const d90 = new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0]

    const [shop, sales30, sales90, allSales, debtRes, saleItems] = await Promise.all([
      supabase.from('shops').select('name, created_at').eq('id', shopId).single(),
      supabase.from('sales').select('paid_amount').eq('shop_id', shopId).gte('date', d30),
      supabase.from('sales').select('paid_amount').eq('shop_id', shopId).gte('date', d90),
      supabase.from('sales').select('paid_amount, date').eq('shop_id', shopId).order('date'),
      supabase.from('clients').select('total_debt').eq('shop_id', shopId).gt('total_debt', 0),
      supabase.from('sale_items').select('product_id, quantity, products(name)').eq('products.shop_id', shopId),
    ])

    const rev30 = (sales30.data ?? []).reduce((s: number, r: any) => s + r.paid_amount, 0)
    const rev90 = (sales90.data ?? []).reduce((s: number, r: any) => s + r.paid_amount, 0)
    const revTotal = (allSales.data ?? []).reduce((s: number, r: any) => s + r.paid_amount, 0)
    const totalDebt = (debtRes.data ?? []).reduce((s: number, r: any) => s + r.total_debt, 0)

    // Days since first sale
    const firstSale = allSales.data?.[0]?.date
    const daysSince = firstSale ? Math.max(1, Math.floor((now.getTime() - new Date(firstSale).getTime()) / 86400000)) : 1
    const avgDaily = revTotal / daysSince

    // Top product by quantity
    const productQty: Record<string, { name: string; qty: number }> = {}
    ;(saleItems.data ?? []).forEach((si: any) => {
      if (!si.product_id) return
      const name = si.products?.name ?? 'Inconnu'
      if (!productQty[si.product_id]) productQty[si.product_id] = { name, qty: 0 }
      productQty[si.product_id].qty += si.quantity
    })
    const topProduct = Object.values(productQty).sort((a, b) => b.qty - a.qty)[0]?.name ?? '—'

    // Debt ratio (debt / 30-day revenue)
    const debtRatio = rev30 > 0 ? Math.min(100, (totalDebt / rev30) * 100) : 100

    setData({
      revenue30: rev30,
      revenue90: rev90,
      revenueTotal: revTotal,
      totalDebt,
      totalSales: allSales.data?.length ?? 0,
      avgDailySales: avgDaily,
      topProduct,
      debtRatio,
      shopName: shop.data?.name ?? 'Mon Commerce',
      startDate: firstSale ?? now.toISOString().split('T')[0],
    })
  }

  // Score de bankabilité sur 100
  function computeScore(d: FinanceData): number {
    let score = 0
    if (d.totalSales >= 100) score += 30
    else if (d.totalSales >= 30) score += 20
    else if (d.totalSales >= 10) score += 10
    if (d.avgDailySales >= 50000) score += 25
    else if (d.avgDailySales >= 20000) score += 15
    else if (d.avgDailySales >= 5000) score += 8
    if (d.debtRatio < 20) score += 25
    else if (d.debtRatio < 50) score += 15
    else if (d.debtRatio < 80) score += 5
    const months = Math.floor((new Date().getTime() - new Date(d.startDate).getTime()) / (30 * 86400000))
    if (months >= 6) score += 20
    else if (months >= 3) score += 12
    else if (months >= 1) score += 6
    return Math.min(100, score)
  }

  async function shareReport() {
    if (!data) return
    const score = computeScore(data)
    const report = `
DOSSIER FINANCIER — ${data.shopName}
Généré par MamaShop · ${new Date().toLocaleDateString('fr-FR')}
${'─'.repeat(40)}

SCORE DE BANKABILITÉ : ${score}/100

REVENUS
  30 derniers jours : ${data.revenue30.toLocaleString('fr-FR')} FCFA
  90 derniers jours : ${data.revenue90.toLocaleString('fr-FR')} FCFA
  Total historique  : ${data.revenueTotal.toLocaleString('fr-FR')} FCFA
  Moyenne journalière : ${Math.round(data.avgDailySales).toLocaleString('fr-FR')} FCFA/jour

ACTIVITÉ
  Nombre de ventes enregistrées : ${data.totalSales}
  Produit principal : ${data.topProduct}
  En activité depuis : ${new Date(data.startDate).toLocaleDateString('fr-FR')}

CRÉDITS CLIENTS
  Total impayés : ${data.totalDebt.toLocaleString('fr-FR')} FCFA
  Ratio dettes/revenus mensuels : ${Math.round(data.debtRatio)}%

${'─'.repeat(40)}
Ce dossier est généré automatiquement par MamaShop.
Toutes les données proviennent des ventes enregistrées dans le système.
    `.trim()

    await Share.share({ message: report, title: `Dossier financier — ${data.shopName}` })
  }

  const score = data ? computeScore(data) : 0

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Dossier Financier</Text>
        {data && (
          <TouchableOpacity style={styles.shareBtn} onPress={shareReport}>
            <Text style={styles.shareBtnText}>📤 Exporter</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false) }} />}
      >
        {!data ? (
          <Card padding={24} style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary }}>Enregistre des ventes pour générer ton dossier.</Text>
          </Card>
        ) : (
          <>
            {/* Score */}
            <Card padding={20} style={{ alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Score de bankabilité</Text>
              <ScoreBadge score={score} />
              <Text style={styles.scoreHint}>
                Ce score est calculé à partir de ton historique de ventes, tes revenus réguliers et la gestion de tes crédits clients.
              </Text>
            </Card>

            {/* Revenus */}
            <Card padding={16} style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Revenus</Text>
              <Stat label="30 derniers jours" value={`${data.revenue30.toLocaleString('fr-FR')} F`} color={Colors.success} />
              <Stat label="90 derniers jours" value={`${data.revenue90.toLocaleString('fr-FR')} F`} />
              <Stat label="Total historique" value={`${data.revenueTotal.toLocaleString('fr-FR')} F`} />
              <Stat label="Moyenne journalière" value={`${Math.round(data.avgDailySales).toLocaleString('fr-FR')} F/jour`} />
            </Card>

            {/* Activité */}
            <Card padding={16} style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Activité commerciale</Text>
              <Stat label="Ventes enregistrées" value={`${data.totalSales}`} />
              <Stat label="Produit principal" value={data.topProduct} />
              <Stat label="En activité depuis" value={new Date(data.startDate).toLocaleDateString('fr-FR')} />
            </Card>

            {/* Crédits */}
            <Card padding={16} style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>Gestion des crédits</Text>
              <Stat
                label="Total impayés"
                value={`${data.totalDebt.toLocaleString('fr-FR')} F`}
                color={data.totalDebt > 0 ? Colors.danger : Colors.success}
              />
              <Stat
                label="Ratio dettes/revenus"
                value={`${Math.round(data.debtRatio)}%`}
                color={data.debtRatio < 30 ? Colors.success : data.debtRatio < 60 ? Colors.warning : Colors.danger}
              />
            </Card>

            {/* Conseils */}
            <Card padding={16} style={{ backgroundColor: Colors.infoLight, borderWidth: 1, borderColor: Colors.info + '40' }}>
              <Text style={[styles.sectionTitle, { color: Colors.info }]}>💡 Pour améliorer ton score</Text>
              {data.totalSales < 30 && <Text style={styles.tip}>• Continue à enregistrer chaque vente — l'historique compte beaucoup.</Text>}
              {data.debtRatio > 50 && <Text style={styles.tip}>• Récupère tes impayés clients — un ratio dettes/revenus élevé pénalise le score.</Text>}
              {score < 70 && <Text style={styles.tip}>• 3 mois d'historique régulier suffisent pour la plupart des microfinances.</Text>}
              {score >= 70 && <Text style={[styles.tip, { color: Colors.success }]}>• Tu peux présenter ce dossier à ta microfinance locale dès maintenant !</Text>}
            </Card>
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  shareBtn: { backgroundColor: Colors.boss, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  scoreHint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  tip: { fontSize: 13, color: Colors.info, marginBottom: 6, lineHeight: 18 },
})
