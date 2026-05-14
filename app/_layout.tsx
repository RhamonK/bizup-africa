import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../hooks/useAuth'

function RootGuard() {
  const { session, profile, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login')
    } else if (profile) {
      if (inAuth) {
        if (profile.role === 'terrain') router.replace('/(terrain)/')
        else if (profile.role === 'diaspora') router.replace('/(diaspora)/')
        else router.replace('/(boss)/')
      }
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
