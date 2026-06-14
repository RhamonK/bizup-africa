import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AvatarDisplay } from '../../components/AvatarDisplay'
import { BarChart } from '../../components/BarChart'
import { SaleModal } from '../../components/SaleModal'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { flushQueue } from '../../lib/offlineQueue'
import { getSeasonAlert } from '../../lib/season'
import { Client, Product, Sale } from '../../lib/types'
import { formatDate, fmtQty } from '../../utils/helpers'
import { ProductImage } from '../../components/ProductImage'
import { getClients } from '../../services/clients'
import { getProducts } from '../../services/products'
import { getSalesByDate } from '../../services/sales'

export default function TerrainHome() {
  const { profile } = useAuth()
  const router = useRouter()
  useHamburgerHeader()

  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [pendingSync, setPendingSync] = useState(0)
  const [saleModal, setSaleModal] = useState(false)

  const season = getSeasonAlert()
  const now = new Date()

  useEffect(() => {
    loadData()
    checkSync()
  }, [profile?.shop_id])

  async function loadData() {
    if (!profile?.shop_id) return
    const today = now.toISOString().split('T')[0]
    const [salesRes, prodRes, clientRes] = await Promise.all([
      getSalesByDate(profile.shop_id, today),
      getProducts(profile.shop_id),
      getClients(profile.shop_id),
    ])
    if (salesRes.data) setSales(salesRes.data)
    if (prodRes.data) {
      setProducts(prodRes.data)
      setLowStock(prodRes.data.filter((p: Product) => p.stock_quantity <= p.alert_threshold))
    }
    if (clientRes.data) setClients(clientRes.data)
  }

  async function checkSync() {
    const flushed = await flushQueue(profile?.shop_id ?? '')
    if (flushed > 0) { loadData(); setPendingSync(0) }
  }

  const totalRevenue = sales.reduce((s, v) => s + v.paid_amount, 0)
  const clientsWithDebt = clients.filter(c => c.total_debt > 0)
  const hourlyData = Array.from({ length: 7 }, (_, i) => {
    const h = 7 + i * 2
    return sales.filter(s => new Date(s.created_at).getHours() >= h && new Date(s.created_at).getHours() < h + 2).reduce((sum, s) => sum + s.paid_amount, 0)
  })

  return (
    <SafeAreaView style={styles.safe} edges={[]}>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <AvatarDisplay url={profile?.avatar_url ?? null} size={44} name={profile?.full_name} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Bonjour, {profile?.full_name?.split(' ')[0] ?? '—'}</Text>
            <Text style={styles.heroSub}>{profile?.job_title ?? 'Terrain'}</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{formatDate(now)}</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Ventes</Text>
            <Text style={styles.heroStatValue}>{sales.length}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Encaissé</Text>
            <Text style={[styles.heroStatValue, { color: Colors.amber }]}>
              {totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(0) + 'k' : totalRevenue.toLocaleString()} F
            </Text>
          </View>
        </View>
        {pendingSync > 0 && (
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>⏳ {pendingSync} vente(s) en attente de sync réseau</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} showsVerticalScrollIndicator={false}>

        {/* Bouton principale — Nouvelle vente */}
        <TouchableOpacity
          style={[styles.mainSellBtn, products.length === 0 && styles.mainSellBtnDisabled]}
          onPress={products.length === 0
            ? () => Alert.alert('Aucun produit', 'La patronne doit d\'abord créer des produits dans Gestion → Produits.')
            : () => setSaleModal(true)
          }
          activeOpacity={0.85}
        >
          <View style={styles.mainSellIcon}><Text style={{ fontSize: 32 }}>🧾</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainSellLabel}>Nouvelle vente</Text>
            <Text style={styles.mainSellSub}>
              {products.length === 0 ? '⚠️ Aucun produit disponible' : `${products.length} produit(s) · Tap pour vendre`}
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: '#fff' }}>→</Text>
        </TouchableOpacity>

        {/* Alertes stock critique */}
        {lowStock.map(p => (
          <View key={p.id} style={styles.alertStrip}>
            <Text style={styles.alertStripText}>🚨 {p.name} — stock critique : {p.stock_quantity} {p.unit}</Text>
          </View>
        ))}

        {/* 3 boutons secondaires */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => router.push('/(terrain)/stock')}>
            <View style={[styles.actionIcon, { backgroundColor: lowStock.length > 0 ? Colors.dangerLight : '#E8F5EE' }]}>
              <Text style={{ fontSize: 26 }}>📦</Text>
            </View>
            {lowStock.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{lowStock.length}</Text></View>}
            <Text style={styles.actionLabel}>Stock</Text>
            <Text style={[styles.actionSub, lowStock.length > 0 && { color: Colors.danger }]}>
              {lowStock.length > 0 ? `${lowStock.length} alerte(s)` : 'OK'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => router.push('/(terrain)/credits')}>
            <View style={[styles.actionIcon, { backgroundColor: '#EBF5FB' }]}>
              <Text style={{ fontSize: 26 }}>💰</Text>
            </View>
            {clientsWithDebt.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{clientsWithDebt.length}</Text></View>}
            <Text style={styles.actionLabel}>Dettes</Text>
            <Text style={[styles.actionSub, clientsWithDebt.length > 0 && { color: Colors.info }]}>
              {clientsWithDebt.length > 0 ? `${clientsWithDebt.length} client(s)` : 'Tout soldé ✅'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => router.push('/(terrain)/historique')}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5EE' }]}>
              <Text style={{ fontSize: 26 }}>🧾</Text>
            </View>
            {sales.length > 0 && <View style={[styles.badge, { backgroundColor: Colors.mint }]}><Text style={styles.badgeText}>{sales.length}</Text></View>}
            <Text style={styles.actionLabel}>Historique</Text>
            <Text style={styles.actionSub}>Mes ventes</Text>
          </TouchableOpacity>
        </View>

        {/* Chart horaire */}
        {sales.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activité du jour</Text>
            <BarChart data={hourlyData} labels={['7h', '9h', '11h', '13h', '15h', '17h', '19h']} height={48} />
          </View>
        )}

        {/* Alerte saisonnière */}
        <View style={styles.seasonStrip}>
          <Text style={{ fontSize: 22 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.seasonTitle}>{season.message}</Text>
            <Text style={styles.seasonSub}>{season.detail}</Text>
          </View>
        </View>

        {/* Dernières ventes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dernières ventes</Text>
          {sales.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 32 }}>🕐</Text>
              <Text style={styles.emptyText}>Aucune vente aujourd'hui</Text>
              <Text style={styles.emptySub}>Appuie sur "Nouvelle vente" pour commencer</Text>
            </View>
          ) : sales.slice(0, 5).map(sale => {
            const item = sale.items?.[0]
            return (
              <View key={sale.id} style={styles.saleRow}>
                <ProductImage name={item?.product?.name ?? ''} photoUrl={item?.product?.photo_url} size={38} borderRadius={12} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.saleName}>
                    {sale.items?.map(i => `${fmtQty(i.quantity)} ${i.product?.unit ?? ''} ${i.product?.name ?? ''}`).join(', ')}
                  </Text>
                  <Text style={styles.saleDetail}>
                    {sale.client?.name ?? 'Comptant'} · {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.saleAmount, sale.credit_amount > 0 && { color: Colors.amber }]}>
                    {sale.paid_amount.toLocaleString('fr-FR')} F
                  </Text>
                  <View style={[styles.payBadge, { backgroundColor: sale.credit_amount > 0 ? Colors.goldLight : Colors.successLight }]}>
                    <Text style={[styles.payBadgeText, { color: sale.credit_amount > 0 ? '#7A4A00' : Colors.forest }]}>
                      {sale.credit_amount > 0 ? 'Crédit' : 'Cash'}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <SaleModal
        visible={saleModal}
        onClose={() => setSaleModal(false)}
        products={products}
        shopId={profile?.shop_id ?? ''}
        agentId={profile?.id ?? ''}
        onSaleCreated={loadData}
        offline
        onOfflineQueued={() => setPendingSync(p => p + 1)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.heroBg },
  hero:          { backgroundColor: Colors.heroBg, padding: 20, paddingBottom: 20 },
  heroRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  heroName:      { fontSize: 20, fontWeight: '800', color: Colors.heroText },
  heroSub:       { fontSize: 12, color: Colors.heroMuted, marginTop: 1 },
  dateBadge:     { backgroundColor: 'rgba(45,106,79,0.10)', borderWidth: 1, borderColor: 'rgba(45,106,79,0.20)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  dateBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.forest },
  heroStats:     { flexDirection: 'row', gap: 10 },
  heroStat:      { flex: 1, backgroundColor: Colors.heroCard, borderWidth: 1, borderColor: Colors.heroBorder, borderRadius: 12, padding: 12 },
  heroStatLabel: { fontSize: 10, color: Colors.heroMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatValue: { fontSize: 22, fontWeight: '800', color: Colors.heroText, lineHeight: 26, marginTop: 3 },
  syncBadge:     { marginTop: 10, backgroundColor: 'rgba(232,160,32,0.15)', borderRadius: 8, padding: 8, alignItems: 'center' },
  syncText:      { fontSize: 12, color: Colors.amber, fontWeight: '600' },
  mainSellBtn:   { margin: 16, marginBottom: 8, backgroundColor: Colors.forest, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  mainSellBtnDisabled: { opacity: 0.6 },
  mainSellIcon:  { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  mainSellLabel: { fontSize: 18, fontWeight: '800', color: '#fff' },
  mainSellSub:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  alertStrip:    { marginHorizontal: 16, marginBottom: 4, backgroundColor: Colors.dangerLight, borderRadius: 10, padding: 10 },
  alertStripText: { fontSize: 13, fontWeight: '600', color: Colors.danger },
  grid:          { flexDirection: 'row', padding: 16, paddingTop: 8, gap: 10 },
  actionBtn:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, position: 'relative' },
  actionIcon:    { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionLabel:   { fontSize: 13, fontWeight: '800', color: Colors.text },
  actionSub:     { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  badge:         { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.danger, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:     { color: '#fff', fontSize: 9, fontWeight: '800' },
  card:          { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle:     { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  seasonStrip:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.goldLight, borderWidth: 1, borderColor: 'rgba(201,146,42,0.2)', borderRadius: 12, padding: 12 },
  seasonTitle:   { fontSize: 12, fontWeight: '700', color: Colors.forest },
  seasonSub:     { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  emptyState:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText:     { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptySub:      { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  saleRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  saleEmoji:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  saleName:      { fontSize: 13, fontWeight: '600', color: Colors.text },
  saleDetail:    { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  saleAmount:    { fontSize: 13, fontWeight: '800', color: Colors.success },
  payBadge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, marginTop: 3 },
  payBadgeText:  { fontSize: 9, fontWeight: '700' },
})
