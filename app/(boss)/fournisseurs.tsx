import { useCallback, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Card } from '../../components/Card'
import { ReliabilityDots } from '../../components/ReliabilityDots'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { PriceHistory, Supplier } from '../../lib/types'
import { getRecentSupplierPrices, getSuppliersByReliability } from '../../services/suppliers'

type SeasonFilter = 'dry' | 'rainy' | 'all_year' | 'all'

function AIInsightCard({ supplier, history }: { supplier: Supplier; history: PriceHistory[] }) {
  const [advice, setAdvice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (history.length < 2) return (
    <Card style={styles.aiCard} padding={14}>
      <Text style={styles.aiTitle}>💡 Négociation</Text>
      <Text style={styles.aiText}>Enregistre au moins 2 achats pour activer l'aide à la négociation.</Text>
    </Card>
  )

  function getNegotiationAdvice() {
    setLoading(true)
    // Analyse locale — pas besoin d'API externe
    const prices = history.map(h => h.price_per_unit)
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    const last = prices[0]
    const min = Math.min(...prices)
    const diff = last - avg
    const trend = prices.length >= 3
      ? prices[0] > prices[1] && prices[1] > prices[2] ? 'hausse' : prices[0] < prices[1] ? 'baisse' : 'stable'
      : 'stable'

    let result = ''
    if (diff > 200) {
      result = `⚠️ Dernier prix (${last.toLocaleString('fr-FR')} F) est ${diff.toLocaleString('fr-FR')} F au-dessus de la moyenne historique (${avg.toLocaleString('fr-FR')} F). ` +
        `Tu peux négocier entre ${Math.round(avg).toLocaleString('fr-FR')} F et ${Math.round(avg + diff * 0.3).toLocaleString('fr-FR')} F. ` +
        `Argument : "La dernière fois j'avais payé moins, je veux revenir à ${avg.toLocaleString('fr-FR')} F."`
    } else if (diff > 0) {
      result = `ℹ️ Prix légèrement au-dessus de la moyenne (${avg.toLocaleString('fr-FR')} F). Tendance ${trend}. ` +
        `Tu peux essayer de négocier ${Math.round(diff * 0.5).toLocaleString('fr-FR')}–${diff.toLocaleString('fr-FR')} F de moins. ` +
        `Le meilleur prix historique était ${min.toLocaleString('fr-FR')} F — utilise-le comme référence.`
    } else {
      result = `✅ Prix actuel (${last.toLocaleString('fr-FR')} F) est dans la moyenne ou en dessous (moy. ${avg.toLocaleString('fr-FR')} F). ` +
        `Tendance ${trend}. Ce fournisseur est fiable sur les prix. ` +
        `Concentre-toi sur la qualité et les délais plutôt que sur le prix.`
    }
    setAdvice(result)
    setLoading(false)
  }

  const prices = history.map(h => h.price_per_unit)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const last = prices[0]

  return (
    <Card style={styles.aiCard} padding={14}>
      <Text style={styles.aiTitle}>💡 Aide à la négociation</Text>
      <Text style={styles.aiText}>Dernier prix : <Text style={{ fontWeight: '700' }}>{last.toLocaleString('fr-FR')} F</Text></Text>
      <Text style={styles.aiText}>Moyenne historique : <Text style={{ fontWeight: '700' }}>{avg.toLocaleString('fr-FR')} F</Text></Text>
      {advice ? (
        <View style={styles.aiInsight}>
          <Text style={styles.aiInsightText}>{advice}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.aiInsight, { backgroundColor: Colors.forest, alignItems: 'center' }]}
          onPress={getNegotiationAdvice}
          disabled={loading}
        >
          <Text style={{ color: Colors.mint, fontWeight: '700', fontSize: 13 }}>
            {loading ? '⏳ Analyse en cours...' : '📊 Voir le conseil'}
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  )
}

export default function FournisseursScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistory[]>>({})
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const router = useRouter()

  useFocusEffect(useCallback(() => { loadData() }, [profile?.shop_id]))

  async function loadData() {
    if (!profile?.shop_id) return

    const { data: sup } = await getSuppliersByReliability(profile.shop_id)

    if (sup) {
      setSuppliers(sup)
      // Load price history for each supplier
      const histories: Record<string, PriceHistory[]> = {}
      await Promise.all(sup.map(async (s: Supplier) => {
        const { data } = await getRecentSupplierPrices(s.id)
        if (data) histories[s.id] = data
      }))
      setPriceHistory(histories)
    }
  }

  const filtered = suppliers.filter(s =>
    seasonFilter === 'all' || s.season === seasonFilter || s.season === 'all_year'
  )

  const SEASON_LABELS: Record<string, string> = {
    dry: 'Saison sèche',
    rainy: 'Saison pluies',
    all_year: 'Toute l\'année',
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Fournisseurs</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(boss)/fournisseur-form')}>
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Season filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {(['all', 'dry', 'rainy', 'all_year'] as SeasonFilter[]).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, seasonFilter === s && styles.filterChipActive]}
            onPress={() => setSeasonFilter(s)}
          >
            <Text style={[styles.filterText, seasonFilter === s && styles.filterTextActive]}>
              {s === 'all' ? 'Tous' : s === 'dry' ? '☀️ Sèche' : s === 'rainy' ? '🌧️ Pluies' : '📅 Toute l\'année'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false) }} />}
      >
        {filtered.length === 0 ? (
          <Card padding={24} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>🤝</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
              Aucun fournisseur pour cette saison.
            </Text>
          </Card>
        ) : (
          filtered.map(supplier => {
            const history = priceHistory[supplier.id] ?? []
            const lastPrice = history[0]?.price_per_unit
            const isSelected = selectedSupplier?.id === supplier.id

            return (
              <View key={supplier.id}>
                <TouchableOpacity onPress={() => setSelectedSupplier(isSelected ? null : supplier)}>
                  <Card style={styles.supplierCard} padding={16}>
                    <View style={styles.supplierRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.supplierName}>{supplier.name}</Text>
                        <View style={styles.supplierMeta}>
                          <Text style={styles.supplierMetaText}>
                            {supplier.zone ? `📍 ${supplier.zone}  ` : ''}
                            {SEASON_LABELS[supplier.season]}
                          </Text>
                        </View>
                        {supplier.phone && (
                          <Text style={styles.supplierPhone}>📞 {supplier.phone}</Text>
                        )}
                        {supplier.products && supplier.products.length > 0 && (
                          <Text style={styles.supplierPhone}>
                            🛒 {supplier.products.map(sp => sp.product?.name).filter(Boolean).join(' · ')}
                          </Text>
                        )}
                        {(supplier.delivery_days ?? 0) > 0 && (
                          <Text style={styles.supplierPhone}>🚚 Livraison: {supplier.delivery_days}j · Min: {supplier.min_quantity ?? '—'} unités</Text>
                        )}
                        <View style={{ marginTop: 8 }}>
                          <ReliabilityDots score={supplier.reliability} />
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {lastPrice && (
                          <>
                            <Text style={styles.priceLabel}>Dernier prix</Text>
                            <Text style={styles.priceValue}>{lastPrice.toLocaleString('fr-FR')} F</Text>
                          </>
                        )}
                        <Text style={styles.chevron}>{isSelected ? '▲' : '▼'}</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>

                {isSelected && (
                  <View style={styles.expandedSection}>
                    <AIInsightCard supplier={supplier} history={history} />

                    {/* Price history */}
                    {history.length > 0 && (
                      <Card style={styles.historyCard} padding={14}>
                        <Text style={styles.historyTitle}>Historique des prix</Text>
                        {history.slice(0, 5).map((h, i) => (
                          <View key={h.id} style={[styles.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: 8, paddingTop: 8 }]}>
                            <View>
                              <Text style={styles.historyProduct}>{h.product?.name ?? 'Produit'}</Text>
                              <Text style={styles.historyDate}>{new Date(h.date).toLocaleDateString('fr-FR')}</Text>
                            </View>
                            <Text style={styles.historyPrice}>{h.price_per_unit.toLocaleString('fr-FR')} F</Text>
                          </View>
                        ))}
                      </Card>
                    )}
                  </View>
                )}
              </View>
            )
          })
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
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterScroll: { maxHeight: 56 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  supplierCard: { marginBottom: 4 },
  supplierRow: { flexDirection: 'row' },
  supplierName: { fontSize: 17, fontWeight: '700', color: Colors.text },
  supplierMeta: { marginTop: 2 },
  supplierMetaText: { fontSize: 12, color: Colors.textSecondary },
  supplierPhone: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  priceLabel: { fontSize: 11, color: Colors.textSecondary },
  priceValue: { fontSize: 16, fontWeight: '800', color: Colors.text },
  chevron: { marginTop: 8, color: Colors.textTertiary },
  expandedSection: { marginBottom: 12 },
  aiCard: { borderWidth: 1.5, borderColor: Colors.primaryLight, backgroundColor: Colors.primaryLight },
  aiTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, marginBottom: 8 },
  aiText: { fontSize: 13, color: Colors.text, marginBottom: 4 },
  aiInsight: { backgroundColor: Colors.warningLight, borderRadius: 8, padding: 10, marginTop: 8 },
  aiInsightText: { fontSize: 13, color: Colors.primaryDark, fontWeight: '600' },
  historyCard: { marginTop: 8 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyProduct: { fontSize: 14, fontWeight: '600', color: Colors.text },
  historyDate: { fontSize: 11, color: Colors.textSecondary },
  historyPrice: { fontSize: 15, fontWeight: '700', color: Colors.primary },
})
