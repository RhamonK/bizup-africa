import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AvatarPicker } from '../../components/AvatarPicker'
import { Banner } from '../../components/Banner'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { changePassword as changePasswordRequest } from '../../services/auth'
import { updateProfile } from '../../services/profiles'
import { getShop, updateShop } from '../../services/shops'

export default function BossProfilScreen() {
  useHamburgerHeader()
  const { profile, refreshProfile } = useAuth()
  const [shop, setShop] = useState<{ name: string; city: string; country: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ full_name: '', phone: '', avatar_url: null as string | null })
  const [shopForm, setShopForm] = useState({ name: '', city: '', country: '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function flash(type: 'success' | 'error', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name, phone: profile.phone ?? '', avatar_url: profile.avatar_url })
      loadShop()
    }
  }, [profile])

  async function loadShop() {
    if (!profile?.shop_id) return
    const { data } = await getShop(profile.shop_id)
    if (data) { setShop(data); setShopForm({ name: data.name, city: data.city, country: data.country }) }
  }

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    const [profileRes, shopRes] = await Promise.all([
      updateProfile(profile.id, {
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        avatar_url: form.avatar_url,
      }),
      profile.shop_id
        ? updateShop(profile.shop_id, {
            name: shopForm.name.trim(),
            city: shopForm.city.trim(),
            country: shopForm.country.trim(),
          })
        : Promise.resolve({ error: null }),
    ])
    await refreshProfile()
    setSaving(false)
    if (profileRes.error || shopRes.error) {
      flash('error', 'Les modifications n\'ont pas pu être enregistrées. Réessaie.')
      return
    }
    flash('success', 'Profil mis à jour')
  }

  async function changePassword() {
    setPwError('')
    if (!pwForm.current) { setPwError('Entre ton mot de passe actuel.'); return }
    if (!pwForm.next || !pwForm.confirm) { setPwError('Remplis tous les champs.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('Les nouveaux mots de passe ne correspondent pas.'); return }
    if (pwForm.next.length < 6) { setPwError('Minimum 6 caractères.'); return }
    if (pwForm.next === pwForm.current) { setPwError("Le nouveau doit être différent de l'ancien."); return }

    setSavingPw(true)
    const errorMessage = await changePasswordRequest(pwForm.current, pwForm.next)
    setSavingPw(false)
    if (errorMessage) { setPwError(errorMessage); return }
    setPwForm({ current: '', next: '', confirm: '' })
    flash('success', 'Mot de passe modifié')
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Card padding={24} style={s.heroCard}>
            <View style={s.heroRow}>
              {profile && (
                <AvatarPicker
                  userId={profile.id}
                  currentUrl={form.avatar_url}
                  size={90}
                  onUploaded={url => setForm(f => ({ ...f, avatar_url: url }))}
                />
              )}
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={s.heroName}>{profile?.full_name}</Text>
                <View style={s.roleBadge}><Text style={s.roleText}>Gérant(e)</Text></View>
                {shop && <Text style={s.heroShop}>{shop.name} · {shop.city}</Text>}
              </View>
            </View>
          </Card>

          {msg && <Banner type={msg.type} message={msg.text} />}

          <Card padding={20} style={s.section}>
            <Text style={s.sectionTitle}>Informations personnelles</Text>
            <Input label="Nom complet" value={form.full_name} onChangeText={t => setForm(f => ({ ...f, full_name: t }))} placeholder="Ton nom" />
            <Input label="Téléphone" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} placeholder="+228 90000000" keyboardType="phone-pad" />
          </Card>

          <Card padding={20} style={s.section}>
            <Text style={s.sectionTitle}>Mon commerce</Text>
            <Input label="Nom du commerce" value={shopForm.name} onChangeText={t => setShopForm(f => ({ ...f, name: t }))} placeholder="ex: Marché Mama" />
            <Input label="Ville" value={shopForm.city} onChangeText={t => setShopForm(f => ({ ...f, city: t }))} placeholder="ex: Lomé" />
            <Input label="Pays" value={shopForm.country} onChangeText={t => setShopForm(f => ({ ...f, country: t }))} placeholder="ex: Togo" />
          </Card>

          <Button title="Enregistrer les modifications" onPress={saveProfile} loading={saving} size="lg" style={{ marginHorizontal: 16 }} />

          <Card padding={20} style={s.section}>
            <Text style={s.sectionTitle}>Changer le mot de passe</Text>
            <Input label="Mot de passe actuel" value={pwForm.current} onChangeText={t => setPwForm(f => ({ ...f, current: t }))} secureTextEntry placeholder="Ton mot de passe actuel" autoComplete="off" textContentType="oneTimeCode" importantForAutofill="no" />
            <Input label="Nouveau mot de passe" value={pwForm.next} onChangeText={t => setPwForm(f => ({ ...f, next: t }))} secureTextEntry placeholder="Minimum 6 caractères" autoComplete="new-password" textContentType="newPassword" importantForAutofill="no" />
            <Input label="Confirmer le nouveau" value={pwForm.confirm} onChangeText={t => setPwForm(f => ({ ...f, confirm: t }))} secureTextEntry placeholder="Répète le nouveau mot de passe" autoComplete="new-password" textContentType="newPassword" importantForAutofill="no" />
            {pwError ? <Text style={s.error}>{pwError}</Text> : null}
            <Button title="Changer le mot de passe" onPress={changePassword} loading={savingPw} variant="ghost" />
          </Card>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  scroll:      { padding: 16, gap: 12 },
  heroCard:    { alignItems: 'flex-start' },
  heroRow:     { flexDirection: 'row', alignItems: 'center' },
  heroName:    { fontSize: 20, fontWeight: '800', color: Colors.text },
  roleBadge:   { marginTop: 4, backgroundColor: Colors.bossLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  roleText:    { fontSize: 12, fontWeight: '700', color: Colors.boss },
  heroShop:    { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  section:     {},
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  error:       { color: Colors.danger, fontSize: 13, marginBottom: 8 },
})
