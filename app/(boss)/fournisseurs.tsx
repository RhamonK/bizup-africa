import { useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { PriceHistory, Product, Supplier } from '../../lib/types'

type SeasonFilter = 'dry' | 'rainy' | 'all_year' | 'all'

function ReliabilityDots({ score }: { score: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: i <= score ? Colors.primary : Colors.border,
          }}
        />
      ))}
    </View>
  )
}

function AIInsightCard({ supplier, history }: { supplier: Supplier; history: PriceHistory[] }) {
  const [advice, setAdvice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (history.length < 2) return (
    <Card style={styles.aiCard} padding={14}>
      <Text style={styles.aiTitle}>💡 Conseil IA</Text>
      <Text style={styles.aiText}>Enregistre au moins 2 achats pour activer l'aide à la négociation.</Text>
    </Card>
  )

  function getAIAdvice() {
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
      <Text style={styles.aiTitle}>💡 Aide à la négociation — IA</Text>
      <Text style={styles.aiText}>Dernier prix : <Text style={{ fontWeight: '700' }}>{last.toLocaleString('fr-FR')} F</Text></Text>
      <Text style={styles.aiText}>Moyenne historique : <Text style={{ fontWeight: '700' }}>{avg.toLocaleString('fr-FR')} F</Text></Text>
      {advice ? (
        <View style={styles.aiInsight}>
          <Text style={styles.aiInsightText}>{advice}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.aiInsight, { backgroundColor: Colors.forest, alignItems: 'center' }]}
          onPress={getAIAdvice}
          disabled={loading}
        >
          <Text style={{ color: Colors.mint, fontWeight: '700', fontSize: 13 }}>
            {loading ? '⏳ Analyse en cours...' : '🤖 Demander conseil IA'}
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  )
}

export default function FournisseursScreen() {
  const { profile } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistory[]>>({})
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)

  // Add supplier form
  const [form, setForm] = useState({
    name: '', phone: '', whatsapp: '', zone: '',
    season: 'dry' as Supplier['season'], reliability: 4,
    delivery_days: '1', min_quantity: '', notes: '',
    selected_products: [] as string[],
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    if (!profile?.shop_id) return

    const { data: prods } = await supabase.from('products').select('*').eq('shop_id', profile.shop_id)
    if (prods) setProducts(prods)

    const { data: sup } = await supabase
      .from('suppliers')
      .select('*, products:supplier_products(*, product:products(*))')
      .eq('shop_id', profile.shop_id)
      .order('reliability', { ascending: false })

    if (sup) {
      setSuppliers(sup)
      // Load price history for each supplier
      const histories: Record<string, PriceHistory[]> = {}
      await Promise.all(sup.map(async (s: Supplier) => {
        const { data } = await supabase
          .from('price_history')
          .select('*, product:products(*)')
          .eq('supplier_id', s.id)
          .order('date', { ascending: false })
          .limit(10)
        if (data) histories[s.id] = data
      }))
      setPriceHistory(histories)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !profile?.shop_id) return
    setSaving(true)
    const { data: newSup } = await supabase.from('suppliers').insert({
      shop_id: profile.shop_id,
      name: form.name.trim(),
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      zone: form.zone || null,
      season: form.season,
      reliability: form.reliability,
      delivery_days: parseInt(form.delivery_days) || 1,
      min_quantity: form.min_quantity ? parseFloat(form.min_quantity) : null,
      notes: form.notes || null,
    }).select().single()

    // Link products
    if (newSup && form.selected_products.length > 0) {
      await supabase.from('supplier_products').insert(
        form.selected_products.map(pid => ({ supplier_id: newSup.id, product_id: pid }))
      )
    }

    setSaving(false)
    setModalVisible(false)
    setForm({ name: '', phone: '', whatsapp: '', zone: '', season: 'dry', reliability: 4, delivery_days: '1', min_quantity: '', notes: '', selected_products: [] })
    loadData()
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
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
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

      {/* Add supplier modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouveau fournisseur</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 20, color: Colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Input label="Nom du fournisseur" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="ex: Amadou Koné" />
            <Input label="Téléphone" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} placeholder="+228 90000000" keyboardType="phone-pad" />
            <Input label="WhatsApp" value={form.whatsapp} onChangeText={t => setForm(f => ({ ...f, whatsapp: t }))} placeholder="+228 90000000" keyboardType="phone-pad" />
            <Input label="Zone géographique" value={form.zone} onChangeText={t => setForm(f => ({ ...f, zone: t }))} placeholder="ex: Nord Togo, Burkina" />
            <Input label="Délai de livraison (jours)" value={form.delivery_days} onChangeText={t => setForm(f => ({ ...f, delivery_days: t }))} keyboardType="numeric" placeholder="ex: 2" />
            <Input label="Quantité minimale de commande" value={form.min_quantity} onChangeText={t => setForm(f => ({ ...f, min_quantity: t }))} keyboardType="numeric" placeholder="ex: 10 caisses" />
            <Input label="Notes" value={form.notes} onChangeText={t => setForm(f => ({ ...f, notes: t }))} placeholder="Observations importantes..." multiline numberOfLines={2} style={{ height: 70, textAlignVertical: 'top', paddingTop: 10 }} />

            <Text style={styles.fieldLabel}>Produits fournis</Text>
            <View style={styles.seasonRow}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.seasonChip, form.selected_products.includes(p.id) && styles.seasonChipActive]}
                  onPress={() => setForm(f => ({ ...f, selected_products: f.selected_products.includes(p.id) ? f.selected_products.filter(id => id !== p.id) : [...f.selected_products, p.id] }))}
                >
                  <Text style={[styles.seasonText, form.selected_products.includes(p.id) && styles.seasonTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {products.length === 0 && <Text style={{ fontSize: 12, color: Colors.textTertiary, marginBottom: 12 }}>Crée d'abord des produits dans Gestion → Produits.</Text>}

            <Text style={styles.fieldLabel}>Saison active</Text>
            <View style={styles.seasonRow}>
              {(['dry', 'rainy', 'all_year'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.seasonChip, form.season === s && styles.seasonChipActive]}
                  onPress={() => setForm(f => ({ ...f, season: s }))}
                >
                  <Text style={[styles.seasonText, form.season === s && styles.seasonTextActive]}>
                    {s === 'dry' ? '☀️ Sèche' : s === 'rainy' ? '🌧️ Pluies' : '📅 Toute l\'année'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Fiabilité ({form.reliability}/5)</Text>
            <View style={styles.reliabilityRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setForm(f => ({ ...f, reliability: n }))}>
                  <View style={[styles.reliabilityDot, { backgroundColor: n <= form.reliability ? Colors.primary : Colors.border }]} />
                </TouchableOpacity>
              ))}
            </View>

            <Button title="Enregistrer le fournisseur" onPress={handleSave} loading={saving} size="lg" style={{ marginTop: 16 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  seasonRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  seasonChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  seasonChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  seasonText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  seasonTextActive: { color: '#fff' },
  reliabilityRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  reliabilityDot: { width: 28, height: 28, borderRadius: 14 },
})
