import { Stack } from 'expo-router'
import { View } from 'react-native'
import { AppDrawer } from '../../components/AppDrawer'
import { Colors } from '../../constants/colors'
import { DrawerProvider } from '../../hooks/useDrawer'

const DIASPORA_NAV = [
  { route: '/(diaspora)/',           label: "Vue d'ensemble" },
  { route: '/(diaspora)/historique', label: 'Historique des ventes' },
]

function DiasporaContent() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.diaspora },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index"      options={{ title: "Vue famille" }} />
        <Stack.Screen name="historique" options={{ title: 'Historique des ventes' }} />
      </Stack>
      <AppDrawer items={DIASPORA_NAV} accentColor={Colors.diaspora} />
    </View>
  )
}

export default function DiasporaLayout() {
  return (
    <DrawerProvider>
      <DiasporaContent />
    </DrawerProvider>
  )
}
