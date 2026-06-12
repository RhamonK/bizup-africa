import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { fmtQty } from '../../utils/helpers'
import { Product, Profile, Sale } from '../../lib/types'
import { getProducts } from '../../services/products'
import { getSalesWithCreator } from '../../services/sales'
import { getEmployees } from '../../services/profiles'

export default function BossHistoriqueScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [filterProduct, setFilterProduct] = useState('all')
  const [filterEmp, setFilterEmp] = useState('all')
  const [filterPay, setFilterPay] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadData() }, [profile?.shop_id])

  async function loadData() {
    if (!profile?.shop_id) return
    const [salesRes, prodsRes, empsRes] = await Promise.all([
      getSalesWithCreator(profile.shop_id, 100),
      getProducts(profile.shop_id),
      getEmployees(profile.shop_id),
    ])
    if (salesRes.data) setSales(salesRes.data)
    if (prodsRes.data) setProducts(prodsRes.data)
    if (empsRes.data) setEmployees(empsRes.data)
  }

  const filtered = sales.filter(s => {
    if (filterProduct !== 'all' && !s.items?.some(i => i.product_id === filterProduct)) return false
    if (filterEmp !== 'all' && s.created_by !== filterEmp) return false
    if (filterPay !== 'all') {
      // Payment filter based on credit_amount
      if (filterPay === 'cash' && s.credit_amount > 0) return false
      if (filterPay === 'credit' && s.credit_amount === 0) return false
    }
    return true
  })

  const totalFiltered = filtered.reduce((s, v) => s + v.paid_amount, 0)
  const totalCredit = filtered.reduce((s, v) => s + v.credit_amount, 0)

  const grouped: Record<string, Sale[]> = {}
  filtered.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = []
    grouped[s.date].push(s)
  })

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false) }} />}>
      {/* Totaux */}
      <View style={styles.totalBar}>
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: Colors.mint }]}>{totalFiltered >= 1000 ? (totalFiltered / 1000).toFixed(0) + 'k' : totalFiltered.toLocaleString()} F</Text>
          <Text style={styles.totalLabel}>Encaissé</Text>
        </View>
        <View style={[styles.totalItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={[styles.totalValue, { color: Colors.amber }]}>{totalCredit >= 1000 ? (totalCredit / 1000).toFixed(0) + 'k' : totalCredit.toLocaleString()} F</Text>
          <Text style={styles.totalLabel}>En crédit</Text>
        </View>
        <View style={[styles.totalItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}>
          <Text style={styles.totalValue}>{filtered.length}</Text>
          <Text style={styles.totalLabel}>Ventes</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          <TouchableOpacity style={[styles.chip, filterProduct === 'all' && styles.chipOn]} onPress={() => setFilterProduct('all')}>
            <Text style={[styles.chipT, filterProduct === 'all' && styles.chipTOn]}>Tout</Text>
          </TouchableOpacity>
          {products.map(p => (
            <TouchableOpacity key={p.id} style={[styles.chip, filterProduct === p.id && styles.chipOn]} onPress={() => setFilterProduct(filterProduct === p.id ? 'all' : p.id)}>
              <Text style={[styles.chipT, filterProduct === p.id && styles.chipTOn]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {[{ k: 'all', l: 'Tous employés' }, ...employees.map(e => ({ k: e.id, l: e.full_name }))].map(o => (
            <TouchableOpacity key={o.k} style={[styles.chip, filterEmp === o.k && styles.chipOn]} onPress={() => setFilterEmp(o.k)}>
              <Text style={[styles.chipT, filterEmp === o.k && styles.chipTOn]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {[{ k: 'all', l: 'Tout' }, { k: 'cash', l: '💵 Cash' }, { k: 'credit', l: '📋 Crédit' }].map(o => (
            <TouchableOpacity key={o.k} style={[styles.chip, filterPay === o.k && styles.chipOn]} onPress={() => setFilterPay(o.k)}>
              <Text style={[styles.chipT, filterPay === o.k && styles.chipTOn]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Liste par date */}
      <View style={{ padding: 16 }}>
        {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => (
          <View key={date} style={{ marginBottom: 16 }}>
            <Text style={styles.dateHdr}>
              {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              <Text style={{ color: Colors.textTertiary }}> · {grouped[date].length} vente(s)</Text>
            </Text>
            {grouped[date].map(sale => (
              <View key={sale.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>
                    {sale.items?.map(i => `${fmtQty(i.quantity)} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ') || '—'}
                  </Text>
                  <Text style={styles.cardSub}>
                    {sale.client?.name ?? 'Comptant'} · {(sale.creator as any)?.full_name ?? '—'} · {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.cardAmount, sale.credit_amount > 0 && { color: Colors.amber }]}>
                    {sale.paid_amount.toLocaleString('fr-FR')} F
                  </Text>
                  {sale.credit_amount > 0 && (
                    <View style={styles.creditBadge}><Text style={styles.creditBadgeText}>Crédit</Text></View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ color: Colors.textSecondary }}>Aucune vente pour ces filtres</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  totalBar: { flexDirection: 'row', backgroundColor: Colors.forest, paddingVertical: 16 },
  totalItem: { flex: 1, alignItems: 'center' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
  totalLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 3, textTransform: 'uppercase', fontWeight: '600' },
  filtersSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff' },
  chipOn: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  chipT: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTOn: { color: '#fff' },
  dateHdr: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  cardAmount: { fontSize: 14, fontWeight: '800', color: Colors.success },
  creditBadge: { backgroundColor: Colors.goldLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  creditBadgeText: { fontSize: 9, fontWeight: '700', color: '#7A4A00' },
})
