import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { Sale } from '../../lib/types'
import { fmt, fmtQty } from '../../utils/helpers'
import { getSalesWithCreator } from '../../services/sales'
import { ProductImage } from '../../components/ProductImage'

const PAY_LABEL: Record<string, string> = {
  cash: '💵 Cash',
  credit: '📋 Crédit',
  mobile_money: '📱 Mobile',
}

export default function DiasporaHistoriqueScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [profile?.shop_id])

  async function load() {
    if (!profile?.shop_id) return
    const { data } = await getSalesWithCreator(profile.shop_id, 150)
    if (data) setSales(data)
  }

  const totalRevenue = sales.reduce((s, v) => s + v.paid_amount, 0)
  const totalCredit  = sales.reduce((s, v) => s + v.credit_amount, 0)

  // Grouper par date
  const grouped: Record<string, Sale[]> = {}
  sales.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = []
    grouped[s.date].push(s)
  })
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.root}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} tintColor={Colors.diaspora} />}
      >
        {/* Totaux */}
        <View style={styles.totalBar}>
          <View style={styles.totalItem}>
            <Text style={styles.totalVal}>{fmt(totalRevenue)}</Text>
            <Text style={styles.totalLbl}>Total encaissé</Text>
          </View>
          <View style={[styles.totalItem, styles.totalSep]}>
            <Text style={[styles.totalVal, { color: Colors.warm }]}>{fmt(totalCredit)}</Text>
            <Text style={styles.totalLbl}>En crédit</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalVal}>{sales.length}</Text>
            <Text style={styles.totalLbl}>Ventes</Text>
          </View>
        </View>

        {/* Liste par date */}
        <View style={{ padding: 16, gap: 16 }}>
          {dates.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>📊</Text>
              <Text style={styles.emptyText}>Aucune vente enregistrée</Text>
            </View>
          )}
          {dates.map(date => {
            const daySales = grouped[date]
            const dayTotal = daySales.reduce((s, v) => s + v.paid_amount, 0)
            return (
              <View key={date}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate}>
                    {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                  <Text style={styles.dayTotal}>{fmt(dayTotal)}</Text>
                </View>
                <View style={styles.card}>
                  {daySales.map((sale, i) => {
                    const firstItem = sale.items?.[0]
                    return (
                      <View key={sale.id} style={[styles.saleRow, i > 0 && styles.saleRowBorder]}>
                        <ProductImage name={firstItem?.product?.name ?? ''} size={40} borderRadius={12} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.saleProducts} numberOfLines={1}>
                            {sale.items?.map(i => `${fmtQty(i.quantity)} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ') || '—'}
                          </Text>
                          <Text style={styles.saleMeta}>
                            {sale.creator?.full_name ?? 'Agent'} · {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}{PAY_LABEL[sale.pay_mode ?? 'cash'] ?? 'Cash'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.saleAmount}>{sale.paid_amount.toLocaleString('fr-FR')} F</Text>
                          {sale.credit_amount > 0 && (
                            <Text style={styles.saleCredit}>+{sale.credit_amount.toLocaleString('fr-FR')} F crédit</Text>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  root:      { flex: 1 },
  totalBar:  { flexDirection: 'row', backgroundColor: Colors.diaspora, padding: 20 },
  totalItem: { flex: 1, alignItems: 'center' },
  totalSep:  { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  totalVal:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  totalLbl:  { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayDate:   { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'capitalize' },
  dayTotal:  { fontSize: 13, fontWeight: '800', color: Colors.diaspora },
  card:      { backgroundColor: Colors.surface, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  saleRow:   { flexDirection: 'row', alignItems: 'center', padding: 14 },
  saleRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  saleProducts: { fontSize: 13, fontWeight: '700', color: Colors.text },
  saleMeta:     { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saleAmount:   { fontSize: 14, fontWeight: '800', color: Colors.diaspora },
  saleCredit:   { fontSize: 10, color: Colors.warm, marginTop: 2 },
  empty:     { alignItems: 'center', padding: 48, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
})
