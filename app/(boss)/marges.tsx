import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { supabase } from '../../lib/supabase'

interface MargeRow {
  id: string
  name: string
  unit: string
  avg_sale_price: number
  avg_buy_price: number
  marge_fcfa: number
  marge_pct: number
  stock: number
  sales_count: number
}

function MargeBar({ pct }: { pct: number }) {
  const color = pct >= 25 ? Colors.mint : pct >= 10 ? Colors.amber : Colors.danger
  const w = Math.max(4, Math.min(100, pct))
  return (
    <View style={barStyles.bg}>
      <View style={[barStyles.fill, { width: `${w}%`, backgroundColor: color }]} />
    </View>
  )
}
const barStyles = StyleSheet.create({
  bg: { height: 7, borderRadius: 4, backgroundColor: Colors.surfaceSecondary, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 4 },
})

export default function MargesScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [rows, setRows] = useState<MargeRow[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    if (!profile?.shop_id) return
    const [prodRes, saleItemRes, priceHistRes] = await Promise.all([
      supabase.from('products').select('*').eq('shop_id', profile.shop_id),
      supabase.from('sale_items').select('product_id, unit_price, quantity').eq('products.shop_id', profile.shop_id),
      supabase.from('price_history').select('product_id, price_per_unit').eq('suppliers.shop_id', profile.shop_id),
    ])

    const products = prodRes.data ?? []

    // Avg sale price per product from sale_items
    const salePrices: Record<string, number[]> = {}
    ;(saleItemRes.data ?? []).forEach((si: any) => {
      if (!salePrices[si.product_id]) salePrices[si.product_id] = []
      salePrices[si.product_id].push(si.unit_price)
    })

    // Avg buy price from price_history
    const buyPrices: Record<string, number[]> = {}
    ;(priceHistRes.data ?? []).forEach((ph: any) => {
      if (!buyPrices[ph.product_id]) buyPrices[ph.product_id] = []
      buyPrices[ph.product_id].push(ph.price_per_unit)
    })

    // Also use stock_entries cost_per_unit as fallback
    const { data: stockEntries } = await supabase.from('stock_entries').select('product_id, cost_per_unit').eq('shop_id', profile.shop_id)
    ;(stockEntries ?? []).forEach((se: any) => {
      if (se.cost_per_unit > 0) {
        if (!buyPrices[se.product_id]) buyPrices[se.product_id] = []
        buyPrices[se.product_id].push(se.cost_per_unit)
      }
    })

    const result: MargeRow[] = products.map((p: any) => {
      const sales = salePrices[p.id] ?? []
      const buys = buyPrices[p.id] ?? []
      const avgSale = sales.length ? sales.reduce((a, b) => a + b, 0) / sales.length : p.current_price
      const avgBuy = buys.length ? buys.reduce((a, b) => a + b, 0) / buys.length : 0
      const margeFcfa = avgBuy > 0 ? avgSale - avgBuy : 0
      const margePct = avgBuy > 0 ? (margeFcfa / avgBuy) * 100 : 0
      return {
        id: p.id, name: p.name, unit: p.unit,
        avg_sale_price: Math.round(avgSale), avg_buy_price: Math.round(avgBuy),
        marge_fcfa: Math.round(margeFcfa), marge_pct: Math.round(margePct),
        stock: p.stock_quantity, sales_count: sales.length,
      }
    })

    setRows(result.sort((a, b) => b.marge_pct - a.marge_pct))
  }

  const avgMarge = rows.length ? rows.reduce((s, r) => s + r.marge_pct, 0) / rows.length : 0

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}>
      {/* Header marge globale */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Marge moyenne</Text>
        <Text style={[styles.heroValue, { color: avgMarge >= 20 ? Colors.mint : avgMarge >= 10 ? Colors.amber : '#FF7675' }]}>
          {Math.round(avgMarge)}%
        </Text>
        <Text style={styles.heroSub}>sur {rows.length} produit(s)</Text>
      </View>

      <View style={{ padding: 16 }}>
        {rows.map(row => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.productName}>{row.name}</Text>
              <View style={[styles.margeBadge, { backgroundColor: row.marge_pct >= 25 ? Colors.successLight : row.marge_pct >= 10 ? Colors.warningLight : Colors.dangerLight }]}>
                <Text style={[styles.margeBadgeText, { color: row.marge_pct >= 25 ? Colors.forest : row.marge_pct >= 10 ? '#7A4A00' : Colors.danger }]}>
                  {row.marge_pct >= 0 ? '+' : ''}{row.marge_pct}%
                </Text>
              </View>
            </View>
            <MargeBar pct={row.marge_pct} />
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Prix achat moy.</Text>
                <Text style={styles.statValue}>{row.avg_buy_price > 0 ? row.avg_buy_price.toLocaleString('fr-FR') + ' F' : '—'}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Prix vente moy.</Text>
                <Text style={styles.statValue}>{row.avg_sale_price.toLocaleString('fr-FR')} F</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Marge/{row.unit}</Text>
                <Text style={[styles.statValue, { color: row.marge_fcfa > 0 ? Colors.success : Colors.danger }]}>
                  {row.marge_fcfa > 0 ? '+' : ''}{row.marge_fcfa.toLocaleString('fr-FR')} F
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Ventes</Text>
                <Text style={styles.statValue}>{row.sales_count}</Text>
              </View>
            </View>
            {row.avg_buy_price === 0 && (
              <Text style={styles.hint}>💡 Ajoute l'historique fournisseur pour voir ta vraie marge</Text>
            )}
          </View>
        ))}
        {rows.length === 0 && (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>
              Crée des produits et enregistre des ventes pour voir tes marges.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  hero: { backgroundColor: Colors.forest, padding: 24, alignItems: 'center' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5 },
  heroValue: { fontSize: 48, fontWeight: '900', marginTop: 4 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  margeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  margeBadgeText: { fontSize: 13, fontWeight: '800' },
  stats: { flexDirection: 'row', marginTop: 14, gap: 8 },
  stat: { flex: 1 },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 2 },
  hint: { fontSize: 11, color: Colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
})
