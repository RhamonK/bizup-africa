import { useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useHamburgerHeader } from '../../hooks/useHamburgerHeader'
import { Profile, Sale } from '../../lib/types'
import { signUpEmployee } from '../../services/auth'
import { getEmployees, updateProfile } from '../../services/profiles'
import { getEmployeeSales } from '../../services/sales'

interface EmployeeStats {
  profile: Profile
  salesCount: number
  totalRevenue: number
  totalCredit: number
}

export default function EmployesScreen() {
  useHamburgerHeader()
  const { profile } = useAuth()
  const [stats, setStats] = useState<EmployeeStats[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<'today' | 'week'>('today')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => { loadStats() }, [period, profile?.shop_id])

  async function loadStats() {
    if (!profile?.shop_id) return
    const now = new Date()
    const cutoff = period === 'today'
      ? now.toISOString().split('T')[0]
      : new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

    const shopId = profile.shop_id
    const { data: employees } = await getEmployees(shopId)

    if (!employees) return

    const employeeStats = await Promise.all(employees.map(async (emp: Profile) => {
      const { data: sales } = await getEmployeeSales(shopId, emp.id, cutoff)

      const salesList = (sales ?? []) as Pick<Sale, 'paid_amount' | 'credit_amount'>[]
      return {
        profile: emp,
        salesCount: salesList.length,
        totalRevenue: salesList.reduce((s, v) => s + v.paid_amount, 0),
        totalCredit: salesList.reduce((s, v) => s + v.credit_amount, 0),
      }
    }))

    setStats(employeeStats.sort((a, b) => b.totalRevenue - a.totalRevenue))
  }

  async function createEmployee() {
    setFormError('')
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('Tous les champs sont obligatoires.')
      return
    }
    if (form.password.length < 6) {
      setFormError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    if (!profile?.shop_id) return

    setSaving(true)
    try {
      const { userId, error } = await signUpEmployee(form.email.trim(), form.password, form.full_name.trim())
      if (error || !userId) { setFormError(error ?? 'Erreur lors de la création.'); return }

      // Met à jour le profil avec shop_id et rôle terrain
      const { error: profileError } = await updateProfile(userId, {
        shop_id: profile.shop_id,
        role: 'terrain',
        full_name: form.full_name.trim(),
      })

      if (profileError) { setFormError(profileError.message); return }

      setModal(false)
      setForm({ full_name: '', email: '', password: '' })
      Alert.alert(
        'Employé créé ✅',
        `${form.full_name} peut maintenant se connecter avec :\nEmail: ${form.email}\nMot de passe: ${form.password}\n\nPartage ces identifiants avec lui/elle.`
      )
      loadStats()
    } finally {
      setSaving(false)
    }
  }

  async function removeEmployee(emp: Profile) {
    Alert.alert(
      'Retirer l\'accès',
      `Retirer l'accès de ${emp.full_name} à ce commerce ? (Le compte reste actif mais sans shop_id)`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer', style: 'destructive',
          onPress: async () => {
            await updateProfile(emp.id, { shop_id: null, role: 'terrain' })
            loadStats()
          },
        },
      ]
    )
  }

  const totalRevenue = stats.reduce((s, e) => s + e.totalRevenue, 0)
  const totalSales = stats.reduce((s, e) => s + e.salesCount, 0)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Employés</Text>
        <View style={styles.headerRight}>
          <View style={styles.periodToggle}>
            {(['today', 'week'] as const).map(p => (
              <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                  {p === 'today' ? "Auj." : "Semaine"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}>
            <Text style={styles.addBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadStats(); setRefreshing(false) }} />}
      >
        {/* Summary */}
        {stats.length > 0 && (
          <Card style={styles.summaryCard} padding={16}>
            <Text style={styles.summaryTitle}>Résumé équipe</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{totalSales}</Text>
                <Text style={styles.summaryLabel}>ventes</Text>
              </View>
              <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(0) + 'k' : totalRevenue.toLocaleString('fr-FR')} F
                </Text>
                <Text style={styles.summaryLabel}>encaissé</Text>
              </View>
            </View>
          </Card>
        )}

        {stats.length === 0 ? (
          <Card padding={24} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>👥</Text>
            <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
              Aucun employé terrain.{'\n'}Appuie sur "+ Ajouter" pour créer un compte.
            </Text>
          </Card>
        ) : (
          stats.map((emp, index) => (
            <Card key={emp.profile.id} style={styles.empCard} padding={16}>
              <View style={styles.empRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{emp.profile.full_name}</Text>
                  {emp.profile.phone && <Text style={styles.empPhone}>📞 {emp.profile.phone}</Text>}
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeEmployee(emp.profile)}>
                  <Text style={styles.removeBtnText}>Retirer</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.empStats}>
                <View style={styles.empStat}>
                  <Text style={styles.empStatValue}>{emp.salesCount}</Text>
                  <Text style={styles.empStatLabel}>Ventes</Text>
                </View>
                <View style={styles.empStat}>
                  <Text style={[styles.empStatValue, { color: Colors.success }]}>
                    {emp.totalRevenue.toLocaleString('fr-FR')} F
                  </Text>
                  <Text style={styles.empStatLabel}>Encaissé</Text>
                </View>
                {emp.totalCredit > 0 && (
                  <View style={styles.empStat}>
                    <Text style={[styles.empStatValue, { color: Colors.danger }]}>
                      {emp.totalCredit.toLocaleString('fr-FR')} F
                    </Text>
                    <Text style={styles.empStatLabel}>Crédits</Text>
                  </View>
                )}
              </View>

              {totalRevenue > 0 && (
                <View style={styles.perfBarBg}>
                  <View style={[styles.perfBarFill, { width: `${(emp.totalRevenue / totalRevenue) * 100}%` }]} />
                </View>
              )}
            </Card>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create employee modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Créer un compte employé</Text>
            <TouchableOpacity onPress={() => { setModal(false); setFormError('') }}>
              <Text style={{ fontSize: 20, color: Colors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Card style={{ backgroundColor: Colors.infoLight, borderWidth: 1, borderColor: Colors.info + '30', marginBottom: 20 }} padding={14}>
              <Text style={{ fontSize: 13, color: Colors.info, lineHeight: 18 }}>
                Un compte sera créé pour cet employé. Il/elle pourra se connecter à l'App Terrain avec ces identifiants.
              </Text>
            </Card>
            <Input
              label="Nom complet"
              value={form.full_name}
              onChangeText={t => setForm(f => ({ ...f, full_name: t }))}
              placeholder="ex: Adjoua Kofi"
            />
            <Input
              label="Email"
              value={form.email}
              onChangeText={t => setForm(f => ({ ...f, email: t }))}
              placeholder="employe@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Mot de passe"
              value={form.password}
              onChangeText={t => setForm(f => ({ ...f, password: t }))}
              placeholder="Minimum 6 caractères"
              secureTextEntry
              hint="Note ce mot de passe pour le donner à l'employé"
            />
            {formError ? (
              <Text style={{ color: Colors.danger, fontSize: 13, marginBottom: 8 }}>{formError}</Text>
            ) : null}
            <Button title="Créer le compte" onPress={createEmployee} loading={saving} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodToggle: { flexDirection: 'row', gap: 4 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surfaceSecondary },
  periodBtnActive: { backgroundColor: Colors.boss },
  periodText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  periodTextActive: { color: '#fff' },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summaryCard: { marginBottom: 16 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  summaryValue: { fontSize: 24, fontWeight: '900', color: Colors.text },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary },
  empCard: { marginBottom: 10 },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bossLight, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '800', color: Colors.boss },
  empName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  empPhone: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: Colors.danger },
  removeBtnText: { fontSize: 12, color: Colors.danger, fontWeight: '600' },
  empStats: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  empStat: {},
  empStatValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  empStatLabel: { fontSize: 11, color: Colors.textSecondary },
  perfBarBg: { height: 4, borderRadius: 2, backgroundColor: Colors.surfaceSecondary, overflow: 'hidden' },
  perfBarFill: { height: '100%', backgroundColor: Colors.boss, borderRadius: 2 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
})
