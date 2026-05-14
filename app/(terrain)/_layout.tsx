import { Stack } from 'expo-router'
import { Colors } from '../../constants/colors'
import { DrawerProvider } from '../../hooks/useDrawer'

export default function TerrainLayout() {
  return (
    <DrawerProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.forest },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index"      options={{ title: 'Accueil' }} />
        <Stack.Screen name="stock"      options={{ title: 'Stock' }} />
        <Stack.Screen name="credits"    options={{ title: 'Crédits clients' }} />
        <Stack.Screen name="historique" options={{ title: 'Mes ventes' }} />
        <Stack.Screen name="profil"     options={{ title: 'Mon profil' }} />
      </Stack>
    </DrawerProvider>
  )
}
