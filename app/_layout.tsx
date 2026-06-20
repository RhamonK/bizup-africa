import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../hooks/useAuth'

// Groupe de routes autorisé pour chaque rôle
const HOME_BY_ROLE = {
  terrain: '/(terrain)/',
  diaspora: '/(diaspora)/',
  boss: '/(boss)/',
} as const

function groupForRole(role?: string | null) {
  if (role === 'terrain') return '(terrain)'
  if (role === 'diaspora') return '(diaspora)'
  return '(boss)'
}

function RootGuard() {
  const { session, profile, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const group = segments[0]                // '(auth)' | '(boss)' | '(terrain)' | '(diaspora)' | undefined
    const inAuth = group === '(auth)'

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login')
      return
    }
    // Connecté mais profil pas encore chargé : on attend (évite une redirection prématurée)
    if (!profile) return

    // Sécurité : un rôle ne peut accéder qu'à son propre groupe de routes.
    const allowed = groupForRole(profile.role)
    const home = HOME_BY_ROLE[profile.role === 'terrain' || profile.role === 'diaspora' ? profile.role : 'boss']
    if (inAuth || (group && group !== allowed)) {
      router.replace(home)
    }
  }, [session, profile, loading, segments])

  return <Slot />
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <RootGuard />
      </AuthProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
