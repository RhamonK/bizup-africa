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
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { supabase } from '../../lib/supabase'

const JOB_TITLES = ['Vendeur/Vendeuse', 'Caissier/Caissière', 'Livreur/Livreuse', 'Gestionnaire stock', 'Superviseur']

export default function TerrainProfilScreen() {
  useHamburgerHeader()
  const { profile, refreshProfile, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    avatar_url: null as string | null,
  })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name, phone: profile.phone ?? '', avatar_url: profile.avatar_url })
    }
  }, [profile])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      avatar_url: form.avatar_url,
    }).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    Alert.alert('Enregistré ✅')
  }

  async function changePassword() {
    setPwError('')
    if (!pwForm.current) { setPwError('Entre ton mot de passe actuel.'); return }
    if (!pwForm.next || !pwForm.confirm) { setPwError('Remplis tous les champs.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('Les nouveaux mots de passe ne correspondent pas.'); return }
    if (pwForm.next.length < 6) { setPwError('Minimum 6 caractères.'); return }
    if (pwForm.next === pwForm.current) { setPwError('Le nouveau doit être différent de l\'ancien.'); return }

    setSavingPw(true)
    // Vérifier l'ancien mot de passe via re-authentification
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '', password: pwForm.current,
    })
    if (signInErr) { setSavingPw(false); setPwError('Mot de passe actuel incorrect.'); return }

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

          {/* Hero */}
          <Card padding={24} style={styles.heroCard}>
            <View style={styles.heroRow}>
              {profile && (
                <AvatarPicker
                  userId={profile.id}
                  currentUrl={form.avatar_url}
                  size={80}
                  onUploaded={url => setForm(f => ({ ...f, avatar_url: url }))}
                />
              )}
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.heroName}>{profile?.full_name}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>🏪 {profile?.job_title ?? 'Équipe Terrain'}</Text>
                </View>
                {profile?.salary && (
                  <Text style={styles.salary}>Salaire: {profile.salary.toLocaleString('fr-FR')} F/mois</Text>
                )}
                {profile?.hire_date && (
                  <Text style={styles.hireDate}>
                    Depuis le {new Date(profile.hire_date).toLocaleDateString('fr-FR')}
                  </Text>
                )}
              </View>
            </View>
          </Card>

          {/* Infos */}
          <Card padding={20} style={styles.section}>
            <Text style={styles.sectionTitle}>Mes informations</Text>
            <Input label="Nom complet" value={form.full_name} onChangeText={t => setForm(f => ({ ...f, full_name: t }))} />
            <Input label="Téléphone" value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+228 90000000" />
          </Card>

          <Button title="Enregistrer" onPress={saveProfile} loading={saving} size="lg" style={{ marginHorizontal: 16 }} />

          {/* Mot de passe */}
          <Card padding={20} style={styles.section}>
            <Text style={styles.sectionTitle}>Changer le mot de passe</Text>
            <Input label="Mot de passe actuel" value={pwForm.current} onChangeText={t => setPwForm(f => ({ ...f, current: t }))} secureTextEntry placeholder="Ton mot de passe actuel" />
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
  logoutText:   { fontSize: 13, color: Colors.danger, fontWeight: '600' },
  scroll:    { paddingVertical: 16 },
  heroCard:  { marginHorizontal: 16, marginBottom: 16 },
  heroRow:   { flexDirection: 'row', alignItems: 'center' },
  heroName:  { fontSize: 18, fontWeight: '700', color: Colors.text },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: Colors.terrainLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  roleText:  { fontSize: 12, fontWeight: '600', color: Colors.terrain },
  salary:    { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  hireDate:  { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  section:   { marginHorizontal: 16, marginVertical: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  error:     { fontSize: 13, color: Colors.danger, marginBottom: 12 },
})
