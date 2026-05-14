import { Stack } from 'expo-router'
import { Colors } from '../../constants/colors'
import { DrawerProvider } from '../../hooks/useDrawer'

export default function GerantLayout() {
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
        <Stack.Screen name="index"       options={{ title: 'Tableau de bord' }} />
        <Stack.Screen name="gestion"     options={{ title: 'Gestion' }} />
        <Stack.Screen name="fournisseurs" options={{ title: 'Fournisseurs' }} />
        <Stack.Screen name="historique"  options={{ title: 'Historique des ventes' }} />
        <Stack.Screen name="marges"      options={{ title: 'Marges & Finances' }} />
        <Stack.Screen name="employes"    options={{ title: 'Équipe' }} />
        <Stack.Screen name="finances"    options={{ title: 'Dossier Financier' }} />
        <Stack.Screen name="profil"      options={{ title: 'Mon Profil' }} />
      </Stack>
    </DrawerProvider>
  )
}
