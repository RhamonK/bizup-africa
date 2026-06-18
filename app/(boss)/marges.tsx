import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { getProducts, getStockEntriesByShop, StockEntryCostRow } from '../../services/products'
import { getSaleItemsByShop, SaleItemByShopRow } from '../../services/sales'
import { getPriceHistoryByShop, ShopPriceRow } from '../../services/suppliers'
import { computeMargins, MargeRow } from '../../utils/helpers'

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
  const [avgMarge, setAvgMarge] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [profile?.shop_id])

  async function load() {
    if (!profile?.shop_id) return
    const [prodRes, saleItemRes, priceHistRes, stockEntriesRes] = await Promise.all([
      getProducts(profile.shop_id),
      getSaleItemsByShop(profile.shop_id),
      getPriceHistoryByShop(profile.shop_id),
      getStockEntriesByShop(profile.shop_id),
    ])

    const buyRows = [
      ...(priceHistRes.data ?? []).map((ph: ShopPriceRow) => ({ product_id: ph.product_id, price: ph.price_per_unit })),
      ...(stockEntriesRes.data ?? []).map((se: StockEntryCostRow) => ({ product_id: se.product_id, price: se.cost_per_unit })),
    ]
    const saleItems = (saleItemRes.data ?? []).map((si: SaleItemByShopRow) => ({ product_id: si.product_id, unit_price: si.unit_price }))

    const { rows: result, avgPct } = computeMargins(prodRes.data ?? [], saleItems, buyRows)
    setRows([...result].sort((a, b) => b.marge_pct - a.marge_pct))
    setAvgMarge(avgPct)
  }

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}>
      {/* Header marge globale */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Marge moyenne</Text>
        <Text style={[styles.heroValue, { color: avgMarge >= 20 ? Colors.mint : avgMarge >= 10 ? Colors.amber : '#FF7675' }]}>
          {avgMarge}%
        </Text>
        <Text style={styles.heroSub}>sur {rows.filter(r => r.avg_buy_price > 0).length} produit(s) avec prix d'achat</Text>
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
