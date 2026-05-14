import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AvatarPicker } from '../../components/AvatarPicker'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function BossProfilScreen() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [shop, setShop] = useState<{ name: string; city: string; country: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    avatar_url: null as string | null,
  })
  const [shopForm, setShopForm] = useState({ name: '', city: '', country: '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name, phone: profile.phone ?? '', avatar_url: profile.avatar_url })
      loadShop()
    }
  }, [profile])

  async function loadShop() {
    if (!profile?.shop_id) return
    const { data } = await supabase.from('shops').select('name, city, country').eq('id', profile.shop_id).single()
    if (data) {
      setShop(data)
      setShopForm({ name: data.name, city: data.city, country: data.country })
    }
  }

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    await Promise.all([
      supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        avatar_url: form.avatar_url,
      }).eq('id', profile.id),
      profile.shop_id ? supabase.from('shops').update({
        name: shopForm.name.trim(),
        city: shopForm.city.trim(),
        country: shopForm.country.trim(),
      }).eq('id', profile.shop_id) : Promise.resolve(),
    ])
    await refreshProfile()
    setSaving(false)
    Alert.alert('Enregistré ✅', 'Ton profil a été mis à jour.')
  }

  async function changePassword() {
    setPwError('')
    if (!pwForm.next || !pwForm.confirm) { setPwError('Remplis tous les champs.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('Les mots de passe ne correspondent pas.'); return }
    if (pwForm.next.length < 6) { setPwError('Minimum 6 caractères.'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setSavingPw(false)
    if (error) { setPwError(error.message); return }
    setPwForm({ current: '', next: '', confirm: '' })
    Alert.alert('Mot de passe modifié ✅')
  }

  return (
    <SafeAreaView style={styles.safe}>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Avatar + rôle */}
          <Card padding={24} style={styles.heroCard}>
            <View style={styles.heroRow}>
              {profile && (
                <AvatarPicker
                  userId={profile.id}
                  currentUrl={form.avatar_url}
                  size={90}
                  onUploaded={url => setForm(f => ({ ...f, avatar_url: url }))}
                />
              )}
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.heroName}>{profile?.full_name}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>Gérant(e)</Text>
                </View>
                {shop && <Text style={styles.heroShop}>{shop.name} · {shop.city}</Text>}
              </View>
            </View>
          </Card>

          {/* Infos personnelles */}
          <Card padding={20} style={styles.section}>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>
            <Input label="Nom complet" value={form.full_name} onChangeText={t => setForm(f => ({ ...f, full_name: t }))} placeholder="Ton nom" />
            <Input label="Téléphone" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} placeholder="+228 90000000" keyboardType="phone-pad" />
          </Card>

          {/* Commerce */}
          <Card padding={20} style={styles.section}>
            <Text style={styles.sectionTitle}>Mon commerce</Text>
            <Input label="Nom du commerce" value={shopForm.name} onChangeText={t => setShopForm(f => ({ ...f, name: t }))} placeholder="ex: Marché Mama Adjoua" />
            <Input label="Ville" value={shopForm.city} onChangeText={t => setShopForm(f => ({ ...f, city: t }))} placeholder="ex: Lomé" />
            <Input label="Pays" value={shopForm.country} onChangeText={t => setShopForm(f => ({ ...f, country: t }))} placeholder="ex: Togo" />
          </Card>

          <Button title="Enregistrer les modifications" onPress={saveProfile} loading={saving} size="lg" style={{ marginHorizontal: 16 }} />

          {/* Changer mot de passe */}
          <Card padding={20} style={styles.section}>
            <Text style={styles.sectionTitle}>Changer le mot de passe</Text>
            <Input label="Nouveau mot de passe" value={pwForm.next} onChangeText={t => setPwForm(f => ({ ...f, next: t }))} secureTextEntry placeholder="Minimum 6 caractères" />
            <Input label="Confirmer" value={pwForm.confirm} onChangeText={t => setPwForm(f => ({ ...f, confirm: t }))} secureTextEntry placeholder="Répète le mot de passe" />
            {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
            <Button title="Changer le mot de passe" onPress={changePassword} loading={savingPw} variant="ghost" />
          </Card>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.danger },
  logoutText: { fontSize: 13, color: Colors.danger, fontWeight: '600' },
  scroll: { padding: 16, gap: 12 },
  heroCard: { alignItems: 'flex-start' },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  roleBadge: { marginTop: 4, backgroundColor: Colors.bossLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  roleText: { fontSize: 12, fontWeight: '700', color: Colors.boss },
  heroShop: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  section: {},
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 8 },
})
