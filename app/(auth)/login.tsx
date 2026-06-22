import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { VeggieMascots } from '../../components/veggies/VeggieMascots'
import { Look } from '../../components/veggies/Veggie'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focus, setFocus] = useState<Look>('idle')

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
          {/* Mascottes légumes */}
          <View style={styles.hero}>
            <VeggieMascots look={focus} hidePeek={showPassword} />
            <Text style={styles.title}>
              BiZ-<Text style={styles.titleOrange}>Up</Text>
              {' '}<Text style={styles.titleAfrica}>Africa</Text>
            </Text>
            <Text style={styles.subtitle}>La gestion digitale des commerçantes en gros</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Connexion</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus('idle')}
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus('idle')}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              rightSlot={
                <EyeToggle visible={showPassword} onPress={() => setShowPassword((v) => !v)} />
              }
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
            <Text style={styles.footerText}>Lomé · Cotonou · Accra · Abidjan</Text>
            <Text style={styles.footerSub}>v3.0 · MamaShop</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** Petit bouton œil afficher/masquer (SVG, sans dépendance d'icônes). */
function EyeToggle({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.textSecondary} strokeWidth={2}>
        <Path d="M1 12 C 4 5.5 20 5.5 23 12 C 20 18.5 4 18.5 1 12 Z" strokeLinejoin="round" />
        <Circle cx={12} cy={12} r={3.2} />
        {visible && <Path d="M3 3 L 21 21" strokeLinecap="round" />}
      </Svg>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingHorizontal: 24 },
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.text, marginTop: 6 },
  titleOrange: { color: Colors.mint },
  titleAfrica: { fontSize: 20, color: Colors.sage, fontWeight: '700' },
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
  formTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 13, color: Colors.textSecondary },
  footerSub: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
})
