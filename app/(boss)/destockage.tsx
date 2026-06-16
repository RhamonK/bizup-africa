import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { DestockLot } from '../../lib/types'
import { useCapturePosition } from '../../hooks/useCapturePosition'
import { closeLot, createLot, getActiveLots, recordLotSale } from '../../services/destocking'
import { getClientsNearPoint, NearbyClient } from '../../services/geo'
import { currentLotPrice, nextLotPrice } from '../../utils/destocking'

const EMPTY = { product_name: '', unit: 'caisse', location_label: '', quantity: '', base_price: '', floor_price: '', window_hours: '24' }

export default function DestockageScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [lots, setLots] = useState<DestockLot[]>([])
  const [now, setNow] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [sellLot, setSellLot] = useState<DestockLot | null>(null)
  const [sellQty, setSellQty] = useState('')
  const { capture, capturing } = useCapturePosition()
  const [lotCoords, setLotCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [nearbyLot, setNearbyLot] = useState<DestockLot | null>(null)
  const [nearby, setNearby] = useState<NearbyClient[] | null>(null)
  const [loadingNearby, setLoadingNearby] = useState(false)

  useFocusEffect(useCallback(() => { load() }, [profile?.shop_id]))

  // Rafraîchit le prix affiché chaque minute (la décote est horaire)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    if (!profile?.shop_id) return
    const { data } = await getActiveLots(profile.shop_id)
    if (data) setLots(data)
  }

  async function save() {
    setError('')
    const qty = parseFloat(form.quantity)
    const base = parseFloat(form.base_price)
    const floor = parseFloat(form.floor_price)
    const win = parseInt(form.window_hours, 10)
    if (!form.product_name.trim()) { setError('Donne un nom au produit.'); return }
    if (!(qty > 0)) { setError('Quantité invalide.'); return }
    if (!(base > 0) || !(floor > 0)) { setError('Prix invalides.'); return }
    if (floor >= base) { setError('Le prix plancher doit être en dessous du prix de base.'); return }
    if (!(win > 0)) { setError('Durée invalide.'); return }

    if (!profile?.shop_id || !profile.id) return
    setSaving(true)
    const { error: err } = await createLot(profile.shop_id, profile.id, {
      product_name: form.product_name.trim(),
      unit: form.unit.trim() || 'caisse',
      location_label: form.location_label.trim() || null,
      quantity: qty, base_price: base, floor_price: floor, window_hours: win,
      latitude: lotCoords?.latitude ?? null,
      longitude: lotCoords?.longitude ?? null,
    })
    setSaving(false)
    if (err) { setError('Enregistrement impossible. Réessaie.'); return }
    setModal(false); setForm(EMPTY); load()
  }

  async function confirmSell() {
    if (!sellLot) return
    const q = parseFloat(sellQty)
    if (!(q > 0) || q > sellLot.quantity_remaining) {
      Alert.alert('Erreur', `Quantité invalide (max ${sellLot.quantity_remaining} ${sellLot.unit}).`)
      return
    }
    const { error: err } = await recordLotSale(sellLot, q)
    if (err) { Alert.alert('Erreur', 'Réessaie.'); return }
    setSellLot(null); setSellQty(''); load()
  }

  async function openNearby(lot: DestockLot) {
    if (lot.latitude == null || lot.longitude == null) return
    setNearbyLot(lot); setNearby(null); setLoadingNearby(true)
    const { data } = await getClientsNearPoint(lot.latitude, lot.longitude)
    setNearby((data as NearbyClient[]) ?? [])
    setLoadingNearby(false)
  }

  function askClose(lot: DestockLot) {
    Alert.alert('Clôturer', `Terminer le déstockage de ${lot.product_name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Clôturer', style: 'destructive', onPress: async () => { await closeLot(lot.id); load() } },
    ])
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} />}
      >
        <Button title="+ Nouvel arrivage" onPress={() => { setForm(EMPTY); setLotCoords(null); setError(''); setModal(true) }} style={{ marginBottom: 14 }} />

        {lots.length === 0 && (
          <Card padding={24} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 34 }}>📦</Text>
            <Text style={s.emptyText}>Aucun arrivage en déstockage</Text>
            <Text style={s.emptySub}>Crée un arrivage pour lancer la baisse de prix automatique.</Text>
          </Card>
        )}

        {lots.map(lot => {
          const price = currentLotPrice(lot, now)
          const next = nextLotPrice(lot, now)
          const elapsedH = Math.floor((now.getTime() - new Date(lot.started_at).getTime()) / 3_600_000)
          const atFloor = price <= lot.floor_price
          const soldPct = lot.quantity > 0 ? Math.round((1 - lot.quantity_remaining / lot.quantity) * 100) : 0
          return (
            <Card key={lot.id} style={s.lot} padding={16}>
              <View style={s.lotHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lotName}>{lot.product_name}</Text>
                  <Text style={s.lotMeta}>
                    {lot.location_label ? `📍 ${lot.location_label} · ` : ''}il y a {elapsedH}h
                  </Text>
                </View>
                <TouchableOpacity onPress={() => askClose(lot)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.close}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={s.priceBox}>
                <Text style={s.priceNow}>{price.toLocaleString('fr-FR')} F</Text>
                <Text style={s.priceUnit}>/ {lot.unit}</Text>
              </View>
              {atFloor
                ? <Text style={s.floorTag}>⬇ Prix plancher atteint ({lot.floor_price.toLocaleString('fr-FR')} F)</Text>
                : next != null && <Text style={s.nextTag}>⬇ Tombe à {next.toLocaleString('fr-FR')} F dans 1h</Text>}

              <View style={s.stockRow}>
                <View style={s.barBg}><View style={[s.barFill, { width: `${soldPct}%` }]} /></View>
                <Text style={s.stockText}>{lot.quantity_remaining} / {lot.quantity} {lot.unit}</Text>
              </View>

              <View style={s.actions}>
                {lot.latitude != null && (
                  <TouchableOpacity style={[s.btn, s.btnNear]} onPress={() => openNearby(lot)} activeOpacity={0.85}>
                    <Text style={s.btnNearText}>📢 Proches</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.btn, s.btnSell]} onPress={() => { setSellLot(lot); setSellQty('') }} activeOpacity={0.85}>
                  <Text style={s.btnSellText}>J'ai vendu</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )
        })}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Nouvel arrivage */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nouvel arrivage</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Input label="Produit" value={form.product_name} onChangeText={t => setForm(f => ({ ...f, product_name: t }))} placeholder="ex: Tomate" />
            <Input label="Unité" value={form.unit} onChangeText={t => setForm(f => ({ ...f, unit: t }))} placeholder="caisse / sac" />
            <Input label="Lieu (optionnel)" value={form.location_label} onChangeText={t => setForm(f => ({ ...f, location_label: t }))} placeholder="ex: Agoè" />
            <Button
              title={lotCoords ? '📍 Position enregistrée ✓' : '📍 Utiliser ma position'}
              variant={lotCoords ? 'secondary' : 'ghost'}
              loading={capturing}
              onPress={async () => { const c = await capture(); if (c) setLotCoords(c) }}
              style={{ marginBottom: 12 }}
            />
            <Input label="Quantité arrivée" value={form.quantity} onChangeText={t => setForm(f => ({ ...f, quantity: t }))} keyboardType="numeric" placeholder="ex: 50" />
            <Input label="Prix de base (F)" value={form.base_price} onChangeText={t => setForm(f => ({ ...f, base_price: t }))} keyboardType="numeric" placeholder="ex: 15000" />
            <Input label="Prix plancher (F)" value={form.floor_price} onChangeText={t => setForm(f => ({ ...f, floor_price: t }))} keyboardType="numeric" placeholder="ex: 11000" hint="Le prix ne descendra jamais en dessous." />
            <Input label="Durée avant le plancher (heures)" value={form.window_hours} onChangeText={t => setForm(f => ({ ...f, window_hours: t }))} keyboardType="numeric" hint="24h conseillé pour les tomates." />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Button title="Lancer le déstockage" onPress={save} loading={saving} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* J'ai vendu */}
      <Modal visible={!!sellLot} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Vente — {sellLot?.product_name}</Text>
            <TouchableOpacity onPress={() => setSellLot(null)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            {sellLot && (
              <Text style={s.sellHint}>
                Prix actuel : {currentLotPrice(sellLot, now).toLocaleString('fr-FR')} F · Restant : {sellLot.quantity_remaining} {sellLot.unit}
              </Text>
            )}
            <Input label={`Quantité vendue (${sellLot?.unit ?? ''})`} value={sellQty} onChangeText={setSellQty} keyboardType="numeric" placeholder="ex: 5" />
            <Button title="Enregistrer la vente" onPress={confirmSell} size="lg" style={{ marginTop: 8 }} />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Acheteuses à proximité */}
      <Modal visible={!!nearbyLot} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Acheteuses à 3km</Text>
            <TouchableOpacity onPress={() => setNearbyLot(null)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            {loadingNearby && <Text style={s.sellHint}>Recherche en cours…</Text>}
            {!loadingNearby && nearby && nearby.length === 0 && (
              <Text style={s.sellHint}>Aucune acheteuse géolocalisée à moins de 3km. Enregistre la position de tes clientes (Gestion → Clients) pour les voir apparaître ici.</Text>
            )}
            {!loadingNearby && nearby && nearby.length > 0 && (
              <Text style={s.sellHint}>{nearby.length} acheteuse(s) à moins de 3km :</Text>
            )}
            {nearby?.map(c => (
              <View key={c.id} style={s.nearRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nearName}>{c.name}</Text>
                  {c.phone && <Text style={s.nearMeta}>📞 {c.phone}</Text>}
                </View>
                <Text style={s.nearDist}>{(c.distance_m / 1000).toFixed(1)} km</Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  emptyText:   { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 8 },
  emptySub:    { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  lot:         { marginBottom: 12 },
  lotHead:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  lotName:     { fontSize: 18, fontWeight: '800', color: Colors.text },
  lotMeta:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  close:       { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  priceBox:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  priceNow:    { fontSize: 36, fontWeight: '900', color: Colors.forest, lineHeight: 38 },
  priceUnit:   { fontSize: 14, color: Colors.textSecondary, marginBottom: 5 },
  nextTag:     { fontSize: 13, fontWeight: '700', color: Colors.warm, marginTop: 4 },
  floorTag:    { fontSize: 13, fontWeight: '700', color: Colors.danger, marginTop: 4 },
  stockRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  barBg:       { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceSecondary, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 4, backgroundColor: Colors.mint },
  stockText:   { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  actions:     { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn:         { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnSell:     { backgroundColor: Colors.forest },
  btnSellText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  btnNear:     { backgroundColor: Colors.infoLight },
  btnNearText: { fontSize: 15, fontWeight: '800', color: Colors.info },
  nearRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  nearName:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  nearMeta:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  nearDist:    { fontSize: 14, fontWeight: '800', color: Colors.forest },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text },
  sellHint:    { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  error:       { fontSize: 13, color: Colors.danger, marginBottom: 12 },
})
