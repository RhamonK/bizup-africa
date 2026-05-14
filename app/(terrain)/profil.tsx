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

const JOB_TITLES = ['Vendeur/Vendeuse', 'Caissier/Caissière', 'Livreur/Livreuse', 'Gestionnaire stock', 'Superviseur']

export default function TerrainProfilScreen() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    avatar_url: null as string | null,
  })
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' })
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
    if (!pwForm.next || !pwForm.confirm) { setPwError('Remplis les deux champs.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('Les mots de passe ne correspondent pas.'); return }
    if (pwForm.next.length < 6) { setPwError('Minimum 6 caractères.'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setSavingPw(false)
    if (error) { setPwError(error.message); return }
    setPwForm({ next: '', confirm: '' })
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
  heroCard: {},
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  roleBadge: { marginTop: 4, backgroundColor: Colors.terrainLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  roleText: { fontSize: 12, fontWeight: '700', color: Colors.terrain },
  salary: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  hireDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  section: {},
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 8 },
})
