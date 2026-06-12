import { useEffect, useState } from 'react'
import {
  Alert, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { isOnline } from '../../lib/network'
import { addStockEntryToQueue, flushStockQueue, getStockQueue } from '../../lib/offlineQueue'
import { supabase } from '../../lib/supabase'
import { Product, Supplier } from '../../lib/types'
import { fmtQty } from '../../utils/helpers'
import { ProductImage } from '../../components/ProductImage'

function stockStatus(p: Product) {
  if (p.stock_quantity <= 0) return { label: 'Rupture ⚠', style: 'crit' as const, color: Colors.danger, bg: Colors.dangerLight }
  if (p.stock_quantity <= p.alert_threshold) return { label: `${p.stock_quantity} ${p.unit} ⚠`, style: 'crit' as const, color: Colors.danger, bg: Colors.dangerLight }
  if (p.stock_quantity <= p.alert_threshold * 2) return { label: `${p.stock_quantity} ${p.unit}`, style: 'warn' as const, color: '#7A4A00', bg: Colors.warningLight }
  return { label: `${p.stock_quantity} ${p.unit}`, style: 'ok' as const, color: Colors.forest, bg: Colors.successLight }
}


export default function StockScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingStock, setPendingStock] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [addQty, setAddQty] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [isNewProduct, setIsNewProduct] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('caisse')
  const [suppliers, setSuppliers] = useState<Pick<Supplier, 'id' | 'name' | 'phone'>[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  useEffect(() => { load() }, [profile?.shop_id])

  async function load() {
    if (!profile?.shop_id) return
    await flushStockQueue(profile.shop_id)
    const remaining = await getStockQueue()
    setPendingStock(remaining.length)
    const [prodRes, supRes] = await Promise.all([
      supabase.from('products').select('*').eq('shop_id', profile.shop_id).order('name'),
      supabase.from('suppliers').select('id, name, phone').eq('shop_id', profile.shop_id),
    ])
    if (prodRes.data) setProducts(prodRes.data)
    if (supRes.data) setSuppliers(supRes.data)
  }

  const criticals = products.filter(p => p.stock_quantity <= p.alert_threshold)

  async function handleAddStock() {
    if (!profile?.shop_id) return
    setSaving(true)
    try {
      if (isNewProduct) {
        if (!newName.trim()) { Alert.alert('Erreur', 'Donne un nom au produit.'); return }
        const { data: p, error: prodErr } = await supabase.from('products').insert({
          shop_id: profile.shop_id, name: newName.trim(), unit: newUnit,
          current_price: costPerUnit ? parseFloat(costPerUnit) * 1.3 : 0,
          stock_quantity: parseFloat(addQty) || 0, alert_threshold: 5, alert_days_without_sale: 2,
        }).select().single()
        if (prodErr || !p) { Alert.alert('Erreur', 'Le produit n\'a pas pu être créé. Vérifie ta connexion et réessaie.'); return }
        if (addQty) {
          const { error: entryErr } = await supabase.from('stock_entries').insert({
            shop_id: profile.shop_id, product_id: p.id,
            quantity: parseFloat(addQty), cost_per_unit: parseFloat(costPerUnit) || 0,
            date: new Date().toISOString().split('T')[0],
            supplier_id: selectedSupplier || null,
            driver_name: driverName || null, driver_phone: driverPhone || null, notes: deliveryNotes || null,
          })
          if (entryErr) { Alert.alert('Erreur', 'Produit créé mais l\'arrivage n\'a pas été enregistré. Réessaie depuis la liste.'); return }
        }
      } else {
        if (!selectedProduct || !addQty) { Alert.alert('Erreur', 'Sélectionne un produit et la quantité.'); return }
        if (!(await isOnline())) {
          await addStockEntryToQueue({
            shop_id: profile.shop_id,
            product_id: selectedProduct.id,
            quantity: parseFloat(addQty),
            cost_per_unit: parseFloat(costPerUnit) || 0,
            date: new Date().toISOString().split('T')[0],
            supplier_id: selectedSupplier || null,
          })
          setPendingStock(p => p + 1)
          Alert.alert('⏳ Livraison enregistrée hors-ligne', 'Elle sera synchronisée au retour du réseau.')
          setModal(false); resetForm()
          return
        }
        // RPC atomique : pas de lecture → addition → écriture (perte d'arrivage si 2 agents simultanés)
        const [stockRes, entryRes] = await Promise.all([
          supabase.rpc('increment_stock', { p_id: selectedProduct.id, qty: parseFloat(addQty) }),
          supabase.from('stock_entries').insert({
            shop_id: profile.shop_id, product_id: selectedProduct.id,
            quantity: parseFloat(addQty), cost_per_unit: parseFloat(costPerUnit) || 0,
            date: new Date().toISOString().split('T')[0],
            supplier_id: selectedSupplier || null,
            driver_name: driverName || null, driver_phone: driverPhone || null, notes: deliveryNotes || null,
          }),
        ])
        if (stockRes.error || entryRes.error) {
          Alert.alert('Erreur', 'L\'arrivage n\'a pas pu être enregistré. Vérifie ta connexion et réessaie.')
          return
        }
      }
      Alert.alert('✅ Arrivage enregistré', `Stock mis à jour.`)
      setModal(false); resetForm(); load()
    } finally { setSaving(false) }
  }

  function resetForm() {
    setSelectedProduct(null); setAddQty(''); setCostPerUnit('')
    setIsNewProduct(false); setNewName(''); setNewUnit('caisse')
    setSelectedSupplier(null); setDriverName(''); setDriverPhone(''); setDeliveryNotes('')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.forest }} edges={[]}>
      <ScreenHeader title="Stock actuel" />

      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {pendingStock > 0 && (
          <View style={styles.syncBadge}>
            <Text style={styles.syncText}>⏳ {pendingStock} livraison(s) en attente de sync réseau</Text>
          </View>
        )}

        {/* Alertes critiques */}
        {criticals.map(p => (
          <View key={p.id} style={styles.alertRow}>
            <Text style={styles.alertIcon}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertText}>{p.name} — stock critique : {p.stock_quantity} {p.unit}</Text>
              <Text style={styles.alertSub}>Seuil : {p.alert_threshold} · Commander maintenant</Text>
            </View>
          </View>
        ))}

        {/* Liste produits */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tous les produits</Text>
          {products.length === 0 ? (
            <Text style={{ color: Colors.textSecondary, textAlign: 'center', padding: 16 }}>
              Aucun produit. Appuie sur "Enregistrer une livraison" pour commencer.
            </Text>
          ) : (
            products.map(p => {
              const status = stockStatus(p)
              return (
                <View key={p.id} style={styles.prodRow}>
                  <ProductImage name={p.name} photoUrl={p.photo_url} size={44} borderRadius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>{p.name}</Text>
                    <Text style={styles.prodSub}>Seuil : {p.alert_threshold} {p.unit}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: status.bg }]}>
                    <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
              )
            })
          )}
        </View>

        <TouchableOpacity style={styles.goldBtn} onPress={() => setModal(true)}>
          <Text style={styles.goldBtnText}>+ Enregistrer une livraison</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal livraison */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enregistrer une livraison</Text>
            <TouchableOpacity onPress={() => { setModal(false); resetForm() }}>
              <Text style={{ fontSize: 20, color: Colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={styles.toggleRow}>
              {['Produit existant', 'Nouveau produit'].map((t, i) => (
                <TouchableOpacity key={t} style={[styles.toggle, isNewProduct === (i === 1) && styles.toggleActive]} onPress={() => setIsNewProduct(i === 1)}>
                  <Text style={[styles.toggleText, isNewProduct === (i === 1) && styles.toggleTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {isNewProduct ? (
              <>
                <Input label="Nom du produit" value={newName} onChangeText={setNewName} placeholder="ex: Ignames" />
                <Input label="Unité" value={newUnit} onChangeText={setNewUnit} placeholder="caisse / kg / sac" />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Sélectionne le produit</Text>
                <View style={styles.prodGrid}>
                  {products.map(p => (
                    <TouchableOpacity key={p.id} style={[styles.prodChip, selectedProduct?.id === p.id && styles.prodChipActive]} onPress={() => setSelectedProduct(p)}>
                      <Text style={[styles.prodChipText, selectedProduct?.id === p.id && { color: '#fff' }]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Input label="Quantité reçue" value={addQty} onChangeText={setAddQty} keyboardType="numeric" placeholder="ex: 20" />
            <Input label="Prix d'achat / unité (FCFA)" value={costPerUnit} onChangeText={setCostPerUnit} keyboardType="numeric" placeholder="ex: 2900" hint="Utilisé pour calculer ta marge" />

            {/* Fournisseur */}
            {suppliers.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Fournisseur (optionnel)</Text>
                <View style={styles.prodGrid}>
                  {suppliers.map((s: any) => (
                    <TouchableOpacity key={s.id} style={[styles.prodChip, selectedSupplier === s.id && styles.prodChipActive]} onPress={() => setSelectedSupplier(selectedSupplier === s.id ? null : s.id)}>
                      <Text style={[styles.prodChipText, selectedSupplier === s.id && { color: '#fff' }]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Chauffeur — lié à la marchandise */}
            <Text style={styles.sectionHeader}>🚚 Chauffeur / Livreur</Text>
            <Input label="Nom du chauffeur" value={driverName} onChangeText={setDriverName} placeholder="ex: Kofi Mensah" />
            <Input label="Téléphone chauffeur" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" placeholder="+228 90000000" />
            <Input label="Notes (optionnel)" value={deliveryNotes} onChangeText={setDeliveryNotes} placeholder="ex: Qualité bonne, 5 caisses abîmées" multiline numberOfLines={2} style={{ height: 70, textAlignVertical: 'top', paddingTop: 10 }} />

            <Button title="Enregistrer l'arrivage ✓" onPress={handleAddStock} loading={saving} size="lg" style={{ marginTop: 8, backgroundColor: Colors.forest }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  alertRow: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: Colors.dangerLight, borderRadius: 10, marginBottom: 8, alignItems: 'flex-start' },
  alertIcon: { fontSize: 18 },
  alertText: { fontSize: 13, fontWeight: '600', color: Colors.danger },
  alertSub: { fontSize: 10, color: Colors.danger, opacity: 0.7, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: Colors.forest, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 12 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 14 },
  prodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  prodEmoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  prodName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  prodSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '700' },
  goldBtn: { backgroundColor: Colors.amber, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  goldBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggle: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  toggleActive: { borderColor: Colors.forest, backgroundColor: Colors.successLight },
  toggleText: { fontWeight: '600', color: Colors.textSecondary, fontSize: 13 },
  toggleTextActive: { color: Colors.forest },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  prodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  prodChip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 10, minWidth: '45%', flex: 1 },
  prodChipActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  prodChipText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 8, marginBottom: 8 },
  syncBadge: { backgroundColor: Colors.warningLight, borderRadius: 8, padding: 10, marginBottom: 8, alignItems: 'center' },
  syncText: { fontSize: 12, color: Colors.amber, fontWeight: '600' },
})
