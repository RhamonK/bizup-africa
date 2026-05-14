import { Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppName } from '../../components/AppName'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'

export default function DiasporaLayout() {
  const { profile } = useAuth()
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <AppName size="md" dark />
          <Text style={styles.subtitle}>✈️ Vue famille · {profile?.full_name}</Text>
        </View>
        <View style={styles.readOnlyBadge}>
          <Text style={styles.readOnlyText}>Lecture seule</Text>
        </View>
      </View>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A0D33' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  appName: { fontSize: 22, fontWeight: '900', color: '#fff' },
  appNameMint: { color: Colors.mint },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  readOnlyBadge: {
    backgroundColor: 'rgba(201,146,42,0.2)', borderWidth: 1,
    borderColor: 'rgba(201,146,42,0.4)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  readOnlyText: { fontSize: 11, fontWeight: '700', color: Colors.amber },
})
