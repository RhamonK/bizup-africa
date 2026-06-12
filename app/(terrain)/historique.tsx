import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { Product, Sale } from '../../lib/types'
import { fmtQty } from '../../utils/helpers'
import { getProducts } from '../../services/products'
import { getSalesWithCreator } from '../../services/sales'
import { ProductImage } from '../../components/ProductImage'

const PAY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  cash: { label: 'Cash', color: Colors.forest, bg: Colors.successLight },
  credit: { label: 'Crédit', color: '#7A4A00', bg: Colors.goldLight },
  mobile_money: { label: 'Mobile', color: Colors.info, bg: Colors.infoLight },
}

export default function HistoriqueScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadData() }, [profile?.shop_id])

  async function loadData() {
    if (!profile?.shop_id) return
    const [salesRes, prodsRes] = await Promise.all([
      getSalesWithCreator(profile.shop_id, 100),
      getProducts(profile.shop_id),
    ])
    if (salesRes.data) setSales(salesRes.data)
    if (prodsRes.data) setProducts(prodsRes.data)
  }

  const filtered = filterProduct === 'all'
    ? sales
    : sales.filter(s => s.items?.some(i => i.product_id === filterProduct))

  const totalToday = filtered.filter(s => s.date === new Date().toISOString().split('T')[0]).reduce((sum, s) => sum + s.paid_amount, 0)
  const totalAll = filtered.reduce((sum, s) => sum + s.paid_amount, 0)

  // Grouper par date
  const grouped: Record<string, Sale[]> = {}
  filtered.forEach(s => {
    const d = s.date
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(s)
  })

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Mini stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{filtered.filter(s => s.date === new Date().toISOString().split('T')[0]).length}</Text>
          <Text style={styles.statLabel}>Aujourd'hui</Text>
        </View>
        <View style={[styles.statItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
          <Text style={[styles.statValue, { color: Colors.amber }]}>{totalToday >= 1000 ? (totalToday / 1000).toFixed(0) + 'k' : totalToday.toLocaleString()} F</Text>
          <Text style={styles.statLabel}>Encaissé auj.</Text>
        </View>
        <View style={[styles.statItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
          <Text style={styles.statValue}>{filtered.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Filtres produits */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
        <TouchableOpacity style={[styles.chip, filterProduct === 'all' && styles.chipActive]} onPress={() => setFilterProduct('all')}>
          <Text style={[styles.chipText, filterProduct === 'all' && styles.chipTextActive]}>Tout</Text>
        </TouchableOpacity>
        {products.map(p => (
          <TouchableOpacity key={p.id} style={[styles.chip, filterProduct === p.id && styles.chipActive]} onPress={() => setFilterProduct(p.id)}>
            <Text style={[styles.chipText, filterProduct === p.id && styles.chipTextActive]}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false) }} />}
      >
        {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => (
          <View key={date} style={{ marginBottom: 16 }}>
            <Text style={styles.dateHeader}>
              {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            {grouped[date].map(sale => {
              const badge = PAY_BADGE[sale.pay_mode ?? 'cash'] ?? PAY_BADGE.cash
              const firstItem = sale.items?.[0]
              return (
                <View key={sale.id} style={styles.saleCard}>
                  <ProductImage name={firstItem?.product?.name ?? ''} photoUrl={(firstItem?.product as any)?.photo_url} size={44} borderRadius={12} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.saleName}>
                      {sale.items?.map(i => `${fmtQty(i.quantity)} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ')}
                    </Text>
                    <Text style={styles.saleDetail}>
                      {sale.client?.name ?? 'Comptant'} · {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[styles.saleAmount, sale.credit_amount > 0 && { color: Colors.amber }]}>
                      {sale.paid_amount.toLocaleString('fr-FR')} F
                    </Text>
                    <View style={[styles.modeBadge, { backgroundColor: PAY_BADGE.cash.bg }]}>
                      <Text style={[styles.modeBadgeText, { color: PAY_BADGE.cash.color }]}>Cash</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        ))}
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ color: Colors.textSecondary }}>Aucune vente enregistrée</Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  statsBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  dateHeader: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  saleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  saleEmoji: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saleName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  saleDetail: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saleAmount: { fontSize: 13, fontWeight: '800', color: Colors.success },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  modeBadgeText: { fontSize: 10, fontWeight: '700' },
})
