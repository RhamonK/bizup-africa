import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppName } from '../../components/AppName'
import { MaterialTopTabs, topTabScreenOptions } from '../../components/TopTabLayout'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'

export default function TerrainLayout() {
  const { profile, signOut } = useAuth()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppName size="md" dark />
          <Text style={styles.subtitle}>
            🏪 {profile?.job_title ?? 'Terrain'} · {profile?.full_name?.split(' ')[0] ?? '—'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => signOut()} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>↩</Text>
        </TouchableOpacity>
      </View>
      <MaterialTopTabs screenOptions={{ ...topTabScreenOptions, tabBarActiveTintColor: Colors.mint, tabBarIndicatorStyle: { backgroundColor: Colors.mint, height: 3, borderRadius: 2 } }}>
        <MaterialTopTabs.Screen name="index"      options={{ title: 'Accueil' }} />
        <MaterialTopTabs.Screen name="stock"      options={{ title: 'Stock' }} />
        <MaterialTopTabs.Screen name="credits"    options={{ title: 'Crédits' }} />
        <MaterialTopTabs.Screen name="historique" options={{ title: 'Historique' }} />
        <MaterialTopTabs.Screen name="profil"     options={{ title: 'Mon profil' }} />
      </MaterialTopTabs>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.forest },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.forest },
  appName: { fontSize: 22, fontWeight: '900', color: '#fff' },
  appNameMint: { color: Colors.mint },
  subtitle: { fontSize: 12, color: Colors.heroMuted, marginTop: 1 },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 },
  logoutText: { fontSize: 18, color: 'rgba(255,255,255,0.7)' },
})
