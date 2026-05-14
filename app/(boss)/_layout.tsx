import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { AppDrawer } from '../../components/AppDrawer'
import { Colors } from '../../constants/colors'
import { DrawerProvider } from '../../hooks/useDrawer'

const BOSS_NAV = [
  { route: '/(boss)/',            label: 'Tableau de bord' },
  { route: '/(boss)/gestion',     label: 'Gestion' },
  { route: '/(boss)/fournisseurs', label: 'Fournisseurs' },
  { route: '/(boss)/historique',  label: 'Historique ventes' },
  { route: '/(boss)/marges',      label: 'Marges & Finances' },
  { route: '/(boss)/employes',    label: 'Équipe' },
  { route: '/(boss)/finances',    label: 'Dossier Financier' },
  { route: '/(boss)/profil',      label: 'Mon Profil' },
]

function BossContent() {
  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.forest },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index"        options={{ title: 'Tableau de bord' }} />
        <Stack.Screen name="gestion"      options={{ title: 'Gestion' }} />
        <Stack.Screen name="fournisseurs" options={{ title: 'Fournisseurs' }} />
        <Stack.Screen name="historique"   options={{ title: 'Historique des ventes' }} />
        <Stack.Screen name="marges"       options={{ title: 'Marges & Finances' }} />
        <Stack.Screen name="employes"     options={{ title: 'Équipe' }} />
        <Stack.Screen name="finances"     options={{ title: 'Dossier Financier' }} />
        <Stack.Screen name="profil"       options={{ title: 'Mon Profil' }} />
      </Stack>
      {/* Drawer persistant sur tous les écrans */}
      <AppDrawer items={BOSS_NAV} accentColor={Colors.mint} />
    </View>
  )
}

export default function GerantLayout() {
  return (
    <DrawerProvider>
      <BossContent />
    </DrawerProvider>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
