import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Remplis tous les champs.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await signIn(email.trim(), password)
    if (err) {
      setError(err)
    } else {
      // Petit délai pour laisser le profil charger
      setTimeout(() => setLoading(false), 3000)
      return
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={styles.title}>
              BiZ-<Text style={styles.titleOrange}>Up</Text>
              {' '}<Text style={{ fontSize: 20, color: Colors.sage, fontWeight: '700' }}>Africa</Text>
            </Text>
            <Text style={styles.subtitle}>
              La gestion digitale des commerçantes en gros
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Connexion</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              title="Se connecter"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={{ marginTop: 8 }}
            />
          </View>

          {/* Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Lomé · Cotonou · Accra · Abidjan
            </Text>
            <Text style={styles.footerSub}>v3.0 · BiZ-Up Africa</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: 24 },
  hero: { alignItems: 'center', paddingTop: 48, paddingBottom: 36 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: { fontSize: 36, fontWeight: '900', color: '#fff' },
  title: { fontSize: 30, fontWeight: '800', color: Colors.text },
  titleOrange: { color: Colors.mint },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 13, color: Colors.textSecondary },
  footerSub: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
})
