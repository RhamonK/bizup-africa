import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { ReliabilityDots } from '../../components/ReliabilityDots'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { Product, Season } from '../../lib/types'
import { getProducts } from '../../services/products'
import { addPriceHistory, createSupplier, linkProducts } from '../../services/suppliers'

const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: 'dry', label: '☀️ Sèche' },
  { value: 'rainy', label: '🌧️ Pluies' },
  { value: 'all_year', label: "📅 Toute l'année" },
]

export default function FournisseurForm() {
  const router = useRouter()
  const { profile } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true)
  const [zone, setZone] = useState('')
  const [season, setSeason] = useState<Season>('dry')
  const [reliability, setReliability] = useState(4)
  const [deliveryDays, setDeliveryDays] = useState('1')
  const [minQuantity, setMinQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [firstPriceProductId, setFirstPriceProductId] = useState<string | null>(null)
  const [firstPricePerUnit, setFirstPricePerUnit] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile?.shop_id) loadProducts()
  }, [profile?.shop_id])

  async function loadProducts() {
    const { data } = await getProducts(profile!.shop_id!)
    if (data) setProducts(data)
  }

  function toggleProduct(id: string) {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
    if (!selectedProducts.includes(id) === false) {
      if (firstPriceProductId === id) setFirstPriceProductId(null)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Champ requis', 'Le nom est obligatoire.')
      return
    }
    if (!profile?.shop_id) return
    setSaving(true)

    const { data: supplier, error: supplierErr } = await createSupplier(profile.shop_id, {
      name: name.trim(),
      phone: phone || null,
      whatsapp: whatsappSameAsPhone ? (phone || null) : (whatsapp || null),
      zone: zone || null,
      season,
      reliability,
      delivery_days: parseInt(deliveryDays) || 1,
      min_quantity: minQuantity ? parseFloat(minQuantity) : null,
      notes: notes || null,
    })

    if (supplierErr || !supplier) {
      Alert.alert('Erreur', 'Impossible de créer le fournisseur.')
      setSaving(false)
      return
    }

    if (selectedProducts.length > 0) {
      const { error: linkErr } = await linkProducts(supplier.id, selectedProducts)
      if (linkErr) {
        Alert.alert('Erreur', 'Fournisseur créé mais produits non liés. Vérifie la fiche.')
      }
    }

    if (firstPriceProductId && firstPricePerUnit) {
      await addPriceHistory(supplier.id, {
        product_id: firstPriceProductId,
        price_per_unit: parseFloat(firstPricePerUnit),
        season: season === 'all_year' ? 'dry' : season,
        date: new Date().toISOString().split('T')[0],
        quality: 3,
      })
    }

    setSaving(false)
    router.back()
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Identité */}
        <Text style={styles.sectionLabel}>Identité</Text>
        <Input label="Nom du fournisseur *" value={name} onChangeText={setName} placeholder="ex: Amadou Koné" />
        <Input label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+228 90000000" keyboardType="phone-pad" />

        <TouchableOpacity style={styles.toggleRow} onPress={() => setWhatsappSameAsPhone(v => !v)}>
          <View style={[styles.toggleDot, whatsappSameAsPhone && styles.toggleDotActive]} />
          <Text style={styles.toggleLabel}>Même numéro que le téléphone (WhatsApp)</Text>
        </TouchableOpacity>
        {!whatsappSameAsPhone && (
          <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} placeholder="+228 90000000" keyboardType="phone-pad" />
        )}

        {/* Localisation */}
        <Text style={styles.sectionLabel}>Localisation</Text>
        <Input label="Zone géographique" value={zone} onChangeText={setZone} placeholder="ex: Nord Togo, Bénin" />

        {/* Saison */}
        <Text style={styles.sectionLabel}>Saison active</Text>
        <View style={styles.chipRow}>
          {SEASON_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, season === o.value && styles.chipActive]}
              onPress={() => setSeason(o.value)}
            >
              <Text style={[styles.chipText, season === o.value && styles.chipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logistique */}
        <Text style={styles.sectionLabel}>Logistique</Text>
        <Input label="Délai de livraison (jours)" value={deliveryDays} onChangeText={setDeliveryDays} keyboardType="numeric" placeholder="ex: 2" />
        <Input label="Quantité minimale de commande" value={minQuantity} onChangeText={setMinQuantity} keyboardType="numeric" placeholder="ex: 10" />

        {/* Fiabilité */}
        <Text style={styles.sectionLabel}>Fiabilité ({reliability}/5)</Text>
        <View style={styles.reliabilityRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setReliability(n)}>
              <View style={[styles.reliabilityDot, { backgroundColor: n <= reliability ? Colors.primary : Colors.border }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Produits fournis */}
        <Text style={styles.sectionLabel}>Produits fournis</Text>
        {products.length === 0 ? (
          <Text style={styles.emptyHint}>Crée d'abord des produits dans Gestion → Produits.</Text>
        ) : (
          <View style={styles.chipRow}>
            {products.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, selectedProducts.includes(p.id) && styles.chipActive]}
                onPress={() => toggleProduct(p.id)}
              >
                <Text style={[styles.chipText, selectedProducts.includes(p.id) && styles.chipTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Premier prix — only if products selected */}
        {selectedProducts.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Premier prix d'achat (optionnel)</Text>
            <Text style={styles.sectionHint}>Sélectionne le produit pour démarrer l'historique des prix.</Text>
            <View style={styles.chipRow}>
              {products.filter(p => selectedProducts.includes(p.id)).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, firstPriceProductId === p.id && styles.chipActive]}
                  onPress={() => setFirstPriceProductId(prev => prev === p.id ? null : p.id)}
                >
                  <Text style={[styles.chipText, firstPriceProductId === p.id && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {firstPriceProductId && (
              <Input
                label="Prix d'achat / unité (F)"
                value={firstPricePerUnit}
                onChangeText={setFirstPricePerUnit}
                keyboardType="numeric"
                placeholder="ex: 3500"
              />
            )}
          </>
        )}

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes</Text>
        <Input
          label="Observations"
          value={notes}
          onChangeText={setNotes}
          placeholder="Observations importantes..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top', paddingTop: 10 }}
        />

        <Button title="Enregistrer le fournisseur" onPress={handleSave} loading={saving} size="lg" style={{ marginTop: 8 }} />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10,
  },
  sectionHint: { fontSize: 12, color: Colors.textTertiary, marginBottom: 8, marginTop: -6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  toggleDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface },
  toggleDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  reliabilityRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  reliabilityDot: { width: 28, height: 28, borderRadius: 14 },
  emptyHint: { fontSize: 12, color: Colors.textTertiary, marginBottom: 12 },
})
