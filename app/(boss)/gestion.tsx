import { useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AvatarDisplay, AvatarPicker } from '../../components/AvatarPicker'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Client, PaymentPref, Product, Profile } from '../../lib/types'

type Tab = 'produits' | 'clients' | 'employes'

const LEVEL_CONFIG = {
  standard: { label: 'Standard', color: Colors.info },
  vip: { label: 'VIP', color: Colors.primary },
  grand_compte: { label: 'Grand compte', color: Colors.boss },
}

const PAYMENT_CONFIG: Record<PaymentPref, string> = {
  cash: '💵 Cash',
  credit: '📒 Crédit',
  mixed: '🔀 Mixte',
}

const JOB_TITLES = ['Vendeur/Vendeuse', 'Caissier/Caissière', 'Livreur/Livreuse', 'Gestionnaire stock', 'Superviseur']

export default function GestionScreen() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('produits')
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])

  // ── Product modal ──
  const [productModal, setProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [pForm, setPForm] = useState({ name: '', unit: 'caisse', current_price: '', alert_threshold: '5' })
  const [savingP, setSavingP] = useState(false)

  // ── Client modal ──
  const [clientModal, setClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [cForm, setCForm] = useState({
    name: '', phone: '', level: 'standard' as Client['level'],
    address: '', notes: '', preferred_payment: 'cash' as PaymentPref,
    product_preferences: [] as string[],
  })
  const [savingC, setSavingC] = useState(false)

  // ── Employee modal ──
  const [empModal, setEmpModal] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Profile | null>(null)
  const [eForm, setEForm] = useState({
    full_name: '', email: '', password: '', phone: '',
    job_title: 'Vendeur/Vendeuse', salary: '', hire_date: '',
    avatar_url: null as string | null,
  })
  const [empError, setEmpError] = useState('')
  const [savingE, setSavingE] = useState(false)

  // ── Debt override ──
  const [debtModal, setDebtModal] = useState(false)
  const [debtClient, setDebtClient] = useState<Client | null>(null)
  const [newDebt, setNewDebt] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    if (!profile?.shop_id) return
    const [pRes, cRes, eRes] = await Promise.all([
      supabase.from('products').select('*').eq('shop_id', profile.shop_id).order('name'),
      supabase.from('clients').select('*').eq('shop_id', profile.shop_id).order('name'),
      supabase.from('profiles').select('*').eq('shop_id', profile.shop_id).eq('role', 'terrain').order('full_name'),
    ])
    if (pRes.data) setProducts(pRes.data)
    if (cRes.data) setClients(cRes.data)
    if (eRes.data) setEmployees(eRes.data)
  }

  // ── PRODUITS ─────────────────────────────────────────────────────────────
  async function saveProduct() {
    if (!pForm.name.trim() || !pForm.current_price || !profile?.shop_id) return
    setSavingP(true)
    const payload = { name: pForm.name.trim(), unit: pForm.unit, current_price: parseFloat(pForm.current_price), alert_threshold: parseFloat(pForm.alert_threshold) || 5 }
    if (editingProduct) {
      await supabase.from('products').update(payload).eq('id', editingProduct.id)
    } else {
      await supabase.from('products').insert({ ...payload, shop_id: profile.shop_id, stock_quantity: 0, alert_days_without_sale: 2 })
    }
    setSavingP(false); setProductModal(false); loadAll()
  }

  async function deleteProduct(p: Product) {
    Alert.alert('Supprimer', `Supprimer "${p.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await supabase.from('products').delete().eq('id', p.id); loadAll() } },
    ])
  }

  // ── CLIENTS ──────────────────────────────────────────────────────────────
  function toggleProductPref(name: string) {
    setCForm(f => ({
      ...f,
      product_preferences: f.product_preferences.includes(name)
        ? f.product_preferences.filter(p => p !== name)
        : [...f.product_preferences, name],
    }))
  }

  async function saveClient() {
    if (!cForm.name.trim() || !profile?.shop_id) return
    setSavingC(true)
    const payload = {
      name: cForm.name.trim(), phone: cForm.phone || null, level: cForm.level,
      address: cForm.address || null, notes: cForm.notes || null,
      preferred_payment: cForm.preferred_payment, product_preferences: cForm.product_preferences,
    }
    if (editingClient) {
      await supabase.from('clients').update(payload).eq('id', editingClient.id)
    } else {
      await supabase.from('clients').insert({ ...payload, shop_id: profile.shop_id, total_debt: 0 })
    }
    setSavingC(false); setClientModal(false); loadAll()
  }

  async function deleteClient(c: Client) {
    if (c.total_debt > 0) { Alert.alert('Impossible', `${c.name} a encore ${c.total_debt.toLocaleString('fr-FR')} F de dette.`); return }
    Alert.alert('Supprimer', `Supprimer "${c.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await supabase.from('clients').delete().eq('id', c.id); loadAll() } },
    ])
  }

  async function overrideDebt() {
    if (!debtClient) return
    const val = parseFloat(newDebt)
    if (isNaN(val) || val < 0) { Alert.alert('Erreur', 'Montant invalide.'); return }
    await supabase.from('clients').update({ total_debt: val }).eq('id', debtClient.id)
    setDebtModal(false); setDebtClient(null); setNewDebt(''); loadAll()
  }

  // ── EMPLOYÉS ─────────────────────────────────────────────────────────────
  async function saveEmployee() {
    setEmpError('')
    if (!eForm.full_name.trim() || !profile?.shop_id) { setEmpError('Le nom est obligatoire.'); return }

    setSavingE(true)
    try {
      if (editingEmp) {
        // Modifier un employé existant
        await supabase.from('profiles').update({
          full_name: eForm.full_name.trim(),
          phone: eForm.phone || null,
          job_title: eForm.job_title,
          salary: eForm.salary ? parseFloat(eForm.salary) : null,
          hire_date: eForm.hire_date || null,
          avatar_url: eForm.avatar_url,
        }).eq('id', editingEmp.id)
      } else {
        // Créer un nouveau compte
        if (!eForm.email.trim() || !eForm.password.trim()) { setEmpError('Email et mot de passe obligatoires.'); return }
        if (eForm.password.length < 6) { setEmpError('Minimum 6 caractères pour le mot de passe.'); return }

        const { data, error } = await supabase.auth.signUp({
          email: eForm.email.trim(), password: eForm.password,
          options: { data: { full_name: eForm.full_name.trim() } },
        })
        if (error) { setEmpError(error.message); return }
        if (!data.user) { setEmpError('Erreur lors de la création.'); return }

        await supabase.from('profiles').update({
          shop_id: profile.shop_id,
          role: 'terrain',
          full_name: eForm.full_name.trim(),
          phone: eForm.phone || null,
          job_title: eForm.job_title,
          salary: eForm.salary ? parseFloat(eForm.salary) : null,
          hire_date: eForm.hire_date || null,
          avatar_url: eForm.avatar_url,
        }).eq('id', data.user.id)

        Alert.alert('Compte créé ✅', `Identifiants à donner à ${eForm.full_name} :\nEmail : ${eForm.email}\nMot de passe : ${eForm.password}`)
      }
      setEmpModal(false)
      resetEmpForm()
      loadAll()
    } finally {
      setSavingE(false)
    }
  }

  async function removeEmployee(emp: Profile) {
    Alert.alert('Retirer l\'accès', `Retirer ${emp.full_name} de ce commerce ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => { await supabase.from('profiles').update({ shop_id: null }).eq('id', emp.id); loadAll() } },
    ])
  }

  function openEditEmp(emp: Profile) {
    setEditingEmp(emp)
    setEForm({ full_name: emp.full_name, email: '', password: '', phone: emp.phone ?? '', job_title: emp.job_title ?? 'Vendeur/Vendeuse', salary: emp.salary?.toString() ?? '', hire_date: emp.hire_date ?? '', avatar_url: emp.avatar_url })
    setEmpModal(true)
  }

  function resetEmpForm() {
    setEditingEmp(null)
    setEForm({ full_name: '', email: '', password: '', phone: '', job_title: 'Vendeur/Vendeuse', salary: '', hire_date: '', avatar_url: null })
    setEmpError('')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion</Text>
      </View>

      <View style={styles.tabRow}>
        {(['produits', 'clients', 'employes'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'produits' ? '📦' : t === 'clients' ? '👥' : '🏪'} {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PRODUITS ── */}
      {tab === 'produits' && (
        <ScrollView contentContainerStyle={styles.list}>
          <Button title="+ Nouveau produit" onPress={() => { setEditingProduct(null); setPForm({ name: '', unit: 'caisse', current_price: '', alert_threshold: '5' }); setProductModal(true) }} style={{ marginBottom: 12 }} />
          {products.map(p => (
            <Card key={p.id} style={styles.row} padding={14}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{p.name}</Text>
                <Text style={styles.rowSub}>{p.current_price.toLocaleString('fr-FR')} F/{p.unit} · Stock: {p.stock_quantity}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingProduct(p); setPForm({ name: p.name, unit: p.unit, current_price: p.current_price.toString(), alert_threshold: p.alert_threshold.toString() }); setProductModal(true) }}>
                  <Text>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProduct(p)}>
                  <Text>🗑</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── CLIENTS ── */}
      {tab === 'clients' && (
        <ScrollView contentContainerStyle={styles.list}>
          <Button title="+ Nouveau client" onPress={() => { setEditingClient(null); setCForm({ name: '', phone: '', level: 'standard', address: '', notes: '', preferred_payment: 'cash', product_preferences: [] }); setClientModal(true) }} style={{ marginBottom: 12 }} />
          {clients.map(c => {
            const lvl = LEVEL_CONFIG[c.level]
            return (
              <Card key={c.id} style={styles.row} padding={14}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.rowName}>{c.name}</Text>
                    <View style={[styles.badge, { backgroundColor: lvl.color + '20' }]}>
                      <Text style={[styles.badgeText, { color: lvl.color }]}>{lvl.label}</Text>
                    </View>
                  </View>
                  {c.phone && <Text style={styles.rowSub}>📞 {c.phone}</Text>}
                  {c.address && <Text style={styles.rowSub}>📍 {c.address}</Text>}
                  {c.product_preferences?.length > 0 && (
                    <Text style={styles.rowSub}>🛒 {c.product_preferences.join(' · ')}</Text>
                  )}
                  {c.total_debt > 0 && (
                    <TouchableOpacity onPress={() => { setDebtClient(c); setNewDebt(c.total_debt.toString()); setDebtModal(true) }}>
                      <Text style={styles.debtText}>💸 {c.total_debt.toLocaleString('fr-FR')} F de dette — <Text style={{ textDecorationLine: 'underline' }}>override</Text></Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingClient(c); setCForm({ name: c.name, phone: c.phone ?? '', level: c.level, address: c.address ?? '', notes: c.notes ?? '', preferred_payment: c.preferred_payment ?? 'cash', product_preferences: c.product_preferences ?? [] }); setClientModal(true) }}>
                    <Text>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteClient(c)}>
                    <Text>🗑</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── EMPLOYÉS ── */}
      {tab === 'employes' && (
        <ScrollView contentContainerStyle={styles.list}>
          <Button title="+ Nouvel employé" onPress={() => { resetEmpForm(); setEmpModal(true) }} style={{ marginBottom: 12 }} />
          {employees.length === 0 && (
            <Card padding={20} style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary }}>Aucun employé terrain enregistré.</Text>
            </Card>
          )}
          {employees.map(emp => (
            <Card key={emp.id} style={styles.row} padding={14}>
              <AvatarDisplay url={emp.avatar_url} size={44} name={emp.full_name} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowName}>{emp.full_name}</Text>
                {emp.job_title && <Text style={styles.rowSub}>🏷 {emp.job_title}</Text>}
                {emp.phone && <Text style={styles.rowSub}>📞 {emp.phone}</Text>}
                {emp.salary && <Text style={styles.rowSub}>💰 {emp.salary.toLocaleString('fr-FR')} F/mois</Text>}
                {emp.hire_date && <Text style={styles.rowSub}>📅 Depuis le {new Date(emp.hire_date).toLocaleDateString('fr-FR')}</Text>}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEditEmp(emp)}>
                  <Text>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeEmployee(emp)}>
                  <Text>🚫</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── PRODUCT MODAL ── */}
      <Modal visible={productModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingProduct ? 'Modifier produit' : 'Nouveau produit'}</Text>
            <TouchableOpacity onPress={() => setProductModal(false)}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Input label="Nom" value={pForm.name} onChangeText={t => setPForm(f => ({ ...f, name: t }))} placeholder="ex: Tomates Roma" />
            <Input label="Unité" value={pForm.unit} onChangeText={t => setPForm(f => ({ ...f, unit: t }))} placeholder="caisse / kg / sac" />
            <Input label="Prix de vente (FCFA)" value={pForm.current_price} onChangeText={t => setPForm(f => ({ ...f, current_price: t }))} keyboardType="numeric" />
            <Input label="Seuil d'alerte stock" value={pForm.alert_threshold} onChangeText={t => setPForm(f => ({ ...f, alert_threshold: t }))} keyboardType="numeric" hint="Alerte quand le stock descend sous ce seuil" />
            <Button title={editingProduct ? 'Enregistrer' : 'Créer'} onPress={saveProduct} loading={savingP} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── CLIENT MODAL ── */}
      <Modal visible={clientModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingClient ? 'Modifier client' : 'Nouveau client'}</Text>
            <TouchableOpacity onPress={() => setClientModal(false)}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Input label="Nom complet" value={cForm.name} onChangeText={t => setCForm(f => ({ ...f, name: t }))} placeholder="ex: Fatou Diallo" />
            <Input label="Téléphone / WhatsApp" value={cForm.phone} onChangeText={t => setCForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />
            <Input label="Adresse / Localisation" value={cForm.address} onChangeText={t => setCForm(f => ({ ...f, address: t }))} placeholder="ex: Marché Adidogomé, Stand 12" />

            <Text style={styles.fieldLabel}>Niveau client</Text>
            <View style={styles.chipRow}>
              {(['standard', 'vip', 'grand_compte'] as Client['level'][]).map(l => {
                const cfg = LEVEL_CONFIG[l]
                return (
                  <TouchableOpacity key={l} style={[styles.chip, cForm.level === l && { backgroundColor: cfg.color, borderColor: cfg.color }]} onPress={() => setCForm(f => ({ ...f, level: l }))}>
                    <Text style={[styles.chipText, cForm.level === l && { color: '#fff' }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={styles.fieldLabel}>Paiement habituel</Text>
            <View style={styles.chipRow}>
              {(['cash', 'credit', 'mixed'] as PaymentPref[]).map(p => (
                <TouchableOpacity key={p} style={[styles.chip, cForm.preferred_payment === p && styles.chipActive]} onPress={() => setCForm(f => ({ ...f, preferred_payment: p }))}>
                  <Text style={[styles.chipText, cForm.preferred_payment === p && { color: '#fff' }]}>{PAYMENT_CONFIG[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Produits préférés</Text>
            <View style={styles.chipRow}>
              {products.map(p => (
                <TouchableOpacity key={p.id} style={[styles.chip, cForm.product_preferences.includes(p.name) && styles.chipActive]} onPress={() => toggleProductPref(p.name)}>
                  <Text style={[styles.chipText, cForm.product_preferences.includes(p.name) && { color: '#fff' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {products.length === 0 && <Text style={styles.hint}>Crée d'abord des produits dans l'onglet Produits.</Text>}

            <Input label="Notes / Observations" value={cForm.notes} onChangeText={t => setCForm(f => ({ ...f, notes: t }))} placeholder="ex: commande les lundis, préfère les grosses caisses" multiline numberOfLines={3} style={{ height: 80, textAlignVertical: 'top', paddingTop: 10 }} />
            <Button title={editingClient ? 'Enregistrer' : 'Créer le client'} onPress={saveClient} loading={savingC} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── EMPLOYEE MODAL ── */}
      <Modal visible={empModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingEmp ? 'Modifier employé' : 'Nouvel employé'}</Text>
            <TouchableOpacity onPress={() => { setEmpModal(false); resetEmpForm() }}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">

            {/* Avatar */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {(editingEmp || true) && (
                <AvatarPicker
                  userId={editingEmp?.id ?? 'new'}
                  currentUrl={eForm.avatar_url}
                  size={80}
                  onUploaded={url => setEForm(f => ({ ...f, avatar_url: url }))}
                />
              )}
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 8 }}>Photo de profil</Text>
            </View>

            <Input label="Nom complet *" value={eForm.full_name} onChangeText={t => setEForm(f => ({ ...f, full_name: t }))} placeholder="ex: Adjoua Mensah" />
            <Input label="Téléphone" value={eForm.phone} onChangeText={t => setEForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />

            {!editingEmp && (
              <>
                <Input label="Email (pour connexion) *" value={eForm.email} onChangeText={t => setEForm(f => ({ ...f, email: t }))} keyboardType="email-address" autoCapitalize="none" placeholder="employe@email.com" />
                <Input label="Mot de passe *" value={eForm.password} onChangeText={t => setEForm(f => ({ ...f, password: t }))} secureTextEntry placeholder="Minimum 6 caractères" hint="Note ce mot de passe pour le donner à l'employé" />
              </>
            )}

            <Text style={styles.fieldLabel}>Poste / Rôle</Text>
            <View style={styles.chipRow}>
              {JOB_TITLES.map(j => (
                <TouchableOpacity key={j} style={[styles.chip, eForm.job_title === j && styles.chipActive]} onPress={() => setEForm(f => ({ ...f, job_title: j }))}>
                  <Text style={[styles.chipText, eForm.job_title === j && { color: '#fff' }]}>{j}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Salaire mensuel (FCFA)" value={eForm.salary} onChangeText={t => setEForm(f => ({ ...f, salary: t }))} keyboardType="numeric" placeholder="ex: 50000" />
            <Input label="Date d'embauche" value={eForm.hire_date} onChangeText={t => setEForm(f => ({ ...f, hire_date: t }))} placeholder="AAAA-MM-JJ ex: 2026-01-15" hint="Format: 2026-01-15" />

            {empError ? <Text style={styles.error}>{empError}</Text> : null}
            <Button title={editingEmp ? 'Enregistrer les modifications' : 'Créer le compte'} onPress={saveEmployee} loading={savingE} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── DEBT OVERRIDE MODAL ── */}
      <Modal visible={debtModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Override dette</Text>
            <TouchableOpacity onPress={() => setDebtModal(false)}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ padding: 24 }}>
            <Card style={{ borderLeftWidth: 4, borderLeftColor: Colors.warning, marginBottom: 20 }} padding={14}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{debtClient?.name}</Text>
              <Text style={{ color: Colors.textSecondary, marginTop: 4 }}>Dette actuelle : {debtClient?.total_debt.toLocaleString('fr-FR')} F</Text>
            </Card>
            <Input label="Nouveau montant (FCFA)" value={newDebt} onChangeText={setNewDebt} keyboardType="numeric" hint="Mettre 0 pour effacer la dette" />
            <Button title="Confirmer l'override" onPress={overrideDebt} size="lg" variant="danger" style={{ marginTop: 8 }} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Colors.boss },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.boss },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  debtText: { fontSize: 12, color: Colors.danger, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 6 },
  editBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  close: { fontSize: 20, color: Colors.textSecondary },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.boss, borderColor: Colors.boss },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  hint: { fontSize: 12, color: Colors.textTertiary, marginBottom: 12 },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 8 },
})
