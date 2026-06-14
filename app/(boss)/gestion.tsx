import { useCallback, useState } from 'react'
import {
  Alert, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { AvatarDisplay } from '../../components/AvatarDisplay'
import { AvatarPicker } from '../../components/AvatarPicker'
import { Button } from '../../components/Button'
import { ProductImage } from '../../components/ProductImage'
import { ProductImagePicker } from '../../components/ProductImagePicker'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { Client, PaymentPref, Product, Profile } from '../../lib/types'
import { signUpEmployee } from '../../services/auth'
import { createClient, deleteClient, getClients, updateClient } from '../../services/clients'
import { createProduct, deleteProduct, getProducts, updateProduct } from '../../services/products'
import { getEmployees, updateProfile } from '../../services/profiles'

// ─────────────────────────────────────────────────────────────────────────────
// Types & constantes locaux
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'produits' | 'clients' | 'employes'

const LEVEL_CONFIG = {
  standard:     { label: 'Standard',     color: Colors.info  },
  vip:          { label: 'VIP',          color: Colors.primary },
  grand_compte: { label: 'Grand compte', color: Colors.boss  },
}

const PAYMENT_CONFIG: Record<PaymentPref, string> = {
  cash:   '💵 Cash',
  credit: '📒 Crédit',
  mixed:  '🔀 Mixte',
}

const JOB_TITLES = ['Vendeur/Vendeuse', 'Caissier/Caissière', 'Livreur/Livreuse', 'Gestionnaire stock', 'Superviseur']

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal — juste le sélecteur d'onglet
// ─────────────────────────────────────────────────────────────────────────────
export default function GestionScreen() {
  useHamburgerHeader()
  const { profile, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('produits')

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Gestion</Text></View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textSecondary }}>Chargement…</Text>
      </View>
    </SafeAreaView>
  )
  if (!profile?.shop_id) return null

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Gestion</Text>
      </View>
      <View style={s.tabRow}>
        {(['produits', 'clients', 'employes'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'produits' ? '📦' : t === 'clients' ? '👥' : '🏪'} {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'produits' && <ProduitsTab shopId={profile.shop_id} />}
      {tab === 'clients'  && <ClientsTab  shopId={profile.shop_id} router={router} />}
      {tab === 'employes' && <EmployeesTab shopId={profile.shop_id} profile={profile} />}
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Produits
// ─────────────────────────────────────────────────────────────────────────────
function ProduitsTab({ shopId }: { shopId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', unit: 'caisse', current_price: '', alert_threshold: '5', photo_url: '' })
  const [stockAdd, setStockAdd] = useState('')
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => { load() }, [shopId]))

  async function load() {
    const res = await getProducts(shopId)
    if (res.data) setProducts(res.data)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', unit: 'caisse', current_price: '', alert_threshold: '5', photo_url: '' })
    setStockAdd('')
    setModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, unit: p.unit, current_price: p.current_price.toString(), alert_threshold: p.alert_threshold.toString(), photo_url: p.photo_url ?? '' })
    setStockAdd('')
    setModal(true)
  }

  async function save() {
    if (!form.name.trim() || !form.current_price) return
    setSaving(true)
    const payload: Partial<Product> = {
      name: form.name.trim(), unit: form.unit,
      current_price: parseFloat(form.current_price),
      alert_threshold: parseFloat(form.alert_threshold) || 5,
      ...(form.photo_url ? { photo_url: form.photo_url } : {}),
    }
    if (editing) {
      const qty = parseFloat(stockAdd) || 0
      if (qty > 0) payload.stock_quantity = editing.stock_quantity + qty
      await updateProduct(editing.id, payload)
    } else {
      await createProduct(shopId, { ...payload, stock_quantity: parseFloat(stockAdd) || 0, alert_days_without_sale: 2 })
    }
    setSaving(false); setModal(false); setStockAdd(''); load()
  }

  async function remove(p: Product) {
    Alert.alert('Supprimer', `Supprimer "${p.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteProduct(p.id); setModal(false); load() } },
    ])
  }

  return (
    <>
      <ScrollView contentContainerStyle={s.list}>
        <Button title="+ Nouveau produit" onPress={openCreate} style={{ marginBottom: 12 }} />
        {products.map(p => (
          <TouchableOpacity key={p.id} activeOpacity={0.7} onPress={() => openEdit(p)}>
            <Card style={s.prodRow} padding={12}>
              <ProductImage name={p.name} photoUrl={p.photo_url} size={52} borderRadius={12} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.prodName}>{p.name}</Text>
                <Text style={s.rowSub}>{p.current_price.toLocaleString('fr-FR')} F/{p.unit} · Stock: {p.stock_quantity}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </Card>
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Modifier produit' : 'Nouveau produit'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Photo produit — uniquement en mode édition (l'id est nécessaire pour le chemin) */}
            {editing && (
              <ProductImagePicker
                productId={editing.id}
                shopId={shopId}
                currentUrl={form.photo_url || null}
                productName={form.name}
                onUploaded={url => setForm(f => ({ ...f, photo_url: url }))}
              />
            )}
            <Input label="Nom" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="ex: Tomates Roma" />
            <Input label="Unité" value={form.unit} onChangeText={t => setForm(f => ({ ...f, unit: t }))} placeholder="caisse / kg / sac" />
            <Input label="Prix de vente (FCFA)" value={form.current_price} onChangeText={t => setForm(f => ({ ...f, current_price: t }))} keyboardType="numeric" />
            <Input label="Seuil d'alerte stock" value={form.alert_threshold} onChangeText={t => setForm(f => ({ ...f, alert_threshold: t }))} keyboardType="numeric" hint="Alerte quand le stock descend sous ce seuil" />

            {/* Entrée de stock — visible en création ET modification */}
            <View style={s.stockSection}>
              <Text style={s.stockSectionTitle}>
                {editing ? `📦 Livraison reçue (stock actuel : ${editing.stock_quantity} ${editing.unit})` : '📦 Stock initial'}
              </Text>
              <Input
                label={editing ? `Quantité à ajouter (${form.unit || 'unité'})` : `Quantité en stock (${form.unit || 'unité'})`}
                value={stockAdd}
                onChangeText={setStockAdd}
                keyboardType="numeric"
                placeholder="0"
                hint={editing ? `Nouveau total : ${(editing.stock_quantity + (parseFloat(stockAdd) || 0)).toLocaleString('fr-FR')} ${editing.unit}` : undefined}
              />
            </View>

            <Button title={editing ? 'Enregistrer' : 'Créer le produit'} onPress={save} loading={saving} size="lg" style={{ marginTop: 8 }} />
            {editing && (
              <Button title="🗑  Supprimer ce produit" variant="ghost" onPress={() => remove(editing)} style={{ marginTop: 10 }} />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Clients
// ─────────────────────────────────────────────────────────────────────────────
function ClientsTab({ shopId, router }: { shopId: string; router: ReturnType<typeof useRouter> }) {
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [modal, setModal] = useState(false)
  const [debtModal, setDebtModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [debtClient, setDebtClient] = useState<Client | null>(null)
  const [newDebt, setNewDebt] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', level: 'standard' as Client['level'], address: '', notes: '', preferred_payment: 'cash' as PaymentPref, product_preferences: [] as string[] })
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => { load() }, [shopId]))

  async function load() {
    const [cRes, pRes] = await Promise.all([getClients(shopId), getProducts(shopId)])
    if (cRes.data) setClients(cRes.data)
    if (pRes.data) setProducts(pRes.data)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', phone: '', level: 'standard', address: '', notes: '', preferred_payment: 'cash', product_preferences: [] })
    setModal(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone ?? '', level: c.level, address: c.address ?? '', notes: c.notes ?? '', preferred_payment: c.preferred_payment ?? 'cash', product_preferences: c.product_preferences ?? [] })
    setModal(true)
  }

  function togglePref(name: string) {
    setForm(f => ({
      ...f,
      product_preferences: f.product_preferences.includes(name)
        ? f.product_preferences.filter(p => p !== name)
        : [...f.product_preferences, name],
    }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { name: form.name.trim(), phone: form.phone || null, level: form.level, address: form.address || null, notes: form.notes || null, preferred_payment: form.preferred_payment, product_preferences: form.product_preferences }
    if (editing) await updateClient(editing.id, payload)
    else         await createClient(shopId, payload)
    setSaving(false); setModal(false); load()
  }

  async function remove(c: Client) {
    if (c.total_debt > 0) { Alert.alert('Impossible', `${c.name} a encore ${c.total_debt.toLocaleString('fr-FR')} F de dette.`); return }
    Alert.alert('Supprimer', `Supprimer "${c.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteClient(c.id); load() } },
    ])
  }

  async function overrideDebt() {
    if (!debtClient) return
    const val = parseFloat(newDebt)
    if (isNaN(val) || val < 0) { Alert.alert('Erreur', 'Montant invalide.'); return }
    await updateClient(debtClient.id, { total_debt: val })
    setDebtModal(false); setDebtClient(null); setNewDebt(''); load()
  }

  return (
    <>
      <ScrollView contentContainerStyle={s.list}>
        <Button title="+ Nouveau client" onPress={openCreate} style={{ marginBottom: 12 }} />
        {clients.map(c => {
          const lvl = LEVEL_CONFIG[c.level]
          return (
            <Card key={c.id} style={s.row} padding={14}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push({ pathname: '/(boss)/fiche-client', params: { clientId: c.id } })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={s.rowName}>{c.name}</Text>
                  <View style={[s.badge, { backgroundColor: lvl.color + '20' }]}>
                    <Text style={[s.badgeText, { color: lvl.color }]}>{lvl.label}</Text>
                  </View>
                </View>
                {c.phone && <Text style={s.rowSub}>📞 {c.phone}</Text>}
                {c.address && <Text style={s.rowSub}>📍 {c.address}</Text>}
                {c.product_preferences?.length > 0 && <Text style={s.rowSub}>🛒 {c.product_preferences.join(' · ')}</Text>}
                {c.total_debt > 0 && (
                  <TouchableOpacity onPress={() => { setDebtClient(c); setNewDebt(c.total_debt.toString()); setDebtModal(true) }}>
                    <Text style={s.debtText}>💸 {c.total_debt.toLocaleString('fr-FR')} F de dette — <Text style={{ textDecorationLine: 'underline' }}>override</Text></Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <View style={s.actions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(c)}><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => remove(c)}><Text>🗑</Text></TouchableOpacity>
              </View>
            </Card>
          )
        })}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal client */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Modifier client' : 'Nouveau client'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Input label="Nom complet" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="ex: Fatou Diallo" />
            <Input label="Téléphone / WhatsApp" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />
            <Input label="Adresse / Localisation" value={form.address} onChangeText={t => setForm(f => ({ ...f, address: t }))} placeholder="ex: Marché Adidogomé, Stand 12" />

            <Text style={s.fieldLabel}>Niveau client</Text>
            <View style={s.chipRow}>
              {(['standard', 'vip', 'grand_compte'] as Client['level'][]).map(l => {
                const cfg = LEVEL_CONFIG[l]
                return (
                  <TouchableOpacity key={l} style={[s.chip, form.level === l && { backgroundColor: cfg.color, borderColor: cfg.color }]} onPress={() => setForm(f => ({ ...f, level: l }))}>
                    <Text style={[s.chipText, form.level === l && { color: '#fff' }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={s.fieldLabel}>Paiement habituel</Text>
            <View style={s.chipRow}>
              {(['cash', 'credit', 'mixed'] as PaymentPref[]).map(p => (
                <TouchableOpacity key={p} style={[s.chip, form.preferred_payment === p && s.chipActive]} onPress={() => setForm(f => ({ ...f, preferred_payment: p }))}>
                  <Text style={[s.chipText, form.preferred_payment === p && { color: '#fff' }]}>{PAYMENT_CONFIG[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Produits préférés</Text>
            <View style={s.chipRow}>
              {products.map(p => (
                <TouchableOpacity key={p.id} style={[s.chip, form.product_preferences.includes(p.name) && s.chipActive]} onPress={() => togglePref(p.name)}>
                  <Text style={[s.chipText, form.product_preferences.includes(p.name) && { color: '#fff' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {products.length === 0 && <Text style={s.hint}>Crée d'abord des produits dans l'onglet Produits.</Text>}

            <Input label="Notes / Observations" value={form.notes} onChangeText={t => setForm(f => ({ ...f, notes: t }))} placeholder="ex: commande les lundis…" multiline numberOfLines={3} style={{ height: 80, textAlignVertical: 'top', paddingTop: 10 }} />
            <Button title={editing ? 'Enregistrer' : 'Créer le client'} onPress={save} loading={saving} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal override dette */}
      <Modal visible={debtModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Override dette</Text>
            <TouchableOpacity onPress={() => setDebtModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 24 }}>
            <Card style={{ marginBottom: 20, backgroundColor: Colors.warningLight }} padding={14}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{debtClient?.name}</Text>
              <Text style={{ color: Colors.textSecondary, marginTop: 4 }}>Dette actuelle : {debtClient?.total_debt.toLocaleString('fr-FR')} F</Text>
            </Card>
            <Input label="Nouveau montant (FCFA)" value={newDebt} onChangeText={setNewDebt} keyboardType="numeric" hint="Mettre 0 pour effacer la dette" />
            <Button title="Confirmer l'override" onPress={overrideDebt} size="lg" variant="danger" style={{ marginTop: 8 }} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Employés
// ─────────────────────────────────────────────────────────────────────────────
function EmployeesTab({ shopId, profile }: { shopId: string; profile: Profile }) {
  const [employees, setEmployees] = useState<Profile[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', job_title: 'Vendeur/Vendeuse', salary: '', hire_date: '', avatar_url: null as string | null })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => { load() }, [shopId]))

  async function load() {
    const res = await getEmployees(shopId)
    if (res.data) setEmployees(res.data)
  }

  function openCreate() {
    setEditing(null)
    setForm({ full_name: '', email: '', password: '', phone: '', job_title: 'Vendeur/Vendeuse', salary: '', hire_date: '', avatar_url: null })
    setError('')
    setModal(true)
  }

  function openEdit(emp: Profile) {
    setEditing(emp)
    setForm({ full_name: emp.full_name, email: '', password: '', phone: emp.phone ?? '', job_title: emp.job_title ?? 'Vendeur/Vendeuse', salary: emp.salary?.toString() ?? '', hire_date: emp.hire_date ?? '', avatar_url: emp.avatar_url })
    setError('')
    setModal(true)
  }

  async function save() {
    setError('')
    if (!form.full_name.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateProfile(editing.id, { full_name: form.full_name.trim(), phone: form.phone || null, job_title: form.job_title, salary: form.salary ? parseFloat(form.salary) : null, hire_date: form.hire_date || null, avatar_url: form.avatar_url })
      } else {
        if (!form.email.trim() || !form.password.trim()) { setError('Email et mot de passe obligatoires.'); return }
        if (form.password.length < 6) { setError('Minimum 6 caractères pour le mot de passe.'); return }
        const { userId, error: authError } = await signUpEmployee(form.email.trim(), form.password, form.full_name.trim())
        if (authError || !userId) { setError(authError ?? 'Erreur création.'); return }
        await updateProfile(userId, { shop_id: shopId, role: 'terrain', full_name: form.full_name.trim(), phone: form.phone || null, job_title: form.job_title, salary: form.salary ? parseFloat(form.salary) : null, hire_date: form.hire_date || null, avatar_url: form.avatar_url })
        Alert.alert('Compte créé ✅', `Identifiants à donner :\nEmail : ${form.email}\nMot de passe : ${form.password}`)
      }
      setModal(false); load()
    } finally { setSaving(false) }
  }

  async function remove(emp: Profile) {
    Alert.alert('Retirer l\'accès', `Retirer ${emp.full_name} de ce commerce ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => { await updateProfile(emp.id, { shop_id: null }); load() } },
    ])
  }

  return (
    <>
      <ScrollView contentContainerStyle={s.list}>
        <Button title="+ Nouvel employé" onPress={openCreate} style={{ marginBottom: 12 }} />
        {employees.length === 0 && (
          <Card padding={20} style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.textSecondary }}>Aucun employé terrain enregistré.</Text>
          </Card>
        )}
        {employees.map(emp => (
          <Card key={emp.id} style={s.row} padding={14}>
            <AvatarDisplay url={emp.avatar_url} size={44} name={emp.full_name} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.rowName}>{emp.full_name}</Text>
              {emp.job_title && <Text style={s.rowSub}>🏷 {emp.job_title}</Text>}
              {emp.phone    && <Text style={s.rowSub}>📞 {emp.phone}</Text>}
              {emp.salary   && <Text style={s.rowSub}>💰 {emp.salary.toLocaleString('fr-FR')} F/mois</Text>}
              {emp.hire_date && <Text style={s.rowSub}>📅 Depuis le {new Date(emp.hire_date).toLocaleDateString('fr-FR')}</Text>}
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(emp)}><Text>✏️</Text></TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => remove(emp)}><Text>🚫</Text></TouchableOpacity>
            </View>
          </Card>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? 'Modifier employé' : 'Nouvel employé'}</Text>
            <TouchableOpacity onPress={() => setModal(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <AvatarPicker userId={editing?.id ?? 'new'} currentUrl={form.avatar_url} size={80} onUploaded={url => setForm(f => ({ ...f, avatar_url: url }))} />
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 8 }}>Photo de profil</Text>
            </View>

            <Input label="Nom complet *" value={form.full_name} onChangeText={t => setForm(f => ({ ...f, full_name: t }))} placeholder="ex: Adjoua Mensah" />
            <Input label="Téléphone" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />

            {!editing && (
              <>
                <Input label="Email (pour connexion) *" value={form.email} onChangeText={t => setForm(f => ({ ...f, email: t }))} keyboardType="email-address" autoCapitalize="none" placeholder="employe@email.com" />
                <Input label="Mot de passe *" value={form.password} onChangeText={t => setForm(f => ({ ...f, password: t }))} secureTextEntry placeholder="Minimum 6 caractères" hint="Note ce mot de passe pour le donner à l'employé" />
              </>
            )}

            <Text style={s.fieldLabel}>Poste / Rôle</Text>
            <View style={s.chipRow}>
              {JOB_TITLES.map(j => (
                <TouchableOpacity key={j} style={[s.chip, form.job_title === j && s.chipActive]} onPress={() => setForm(f => ({ ...f, job_title: j }))}>
                  <Text style={[s.chipText, form.job_title === j && { color: '#fff' }]}>{j}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Salaire mensuel (FCFA)" value={form.salary} onChangeText={t => setForm(f => ({ ...f, salary: t }))} keyboardType="numeric" placeholder="ex: 50000" />
            <Input label="Date d'embauche" value={form.hire_date} onChangeText={t => setForm(f => ({ ...f, hire_date: t }))} placeholder="AAAA-MM-JJ" hint="Format: 2026-01-15" />

            {error ? <Text style={s.error}>{error}</Text> : null}
            <Button title={editing ? 'Enregistrer les modifications' : 'Créer le compte'} onPress={save} loading={saving} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles partagés
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  header:      { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:       { fontSize: 20, fontWeight: '700', color: Colors.text },
  tabRow:      { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn:      { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.boss },
  tabText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.boss },
  list:        { padding: 16 },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  prodRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  prodName:    { fontSize: 17, fontWeight: '800', color: Colors.text },
  chevron:     { fontSize: 30, color: Colors.textTertiary, fontWeight: '300', marginLeft: 4 },
  rowName:     { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowSub:      { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  debtText:    { fontSize: 12, color: Colors.danger, marginTop: 4 },
  actions:     { flexDirection: 'row' as const, gap: 6 },
  editBtn:     { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  deleteBtn:   { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  stockSection:      { backgroundColor: Colors.successLight, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 4 },
  stockSectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.forest, marginBottom: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text },
  close:       { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  badge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 4 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:    { fontSize: 13, color: Colors.text },
  hint:        { fontSize: 12, color: Colors.textSecondary, marginBottom: 16 },
  error:       { fontSize: 13, color: Colors.danger, marginBottom: 12 },
})
