import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { AppDrawer } from '../../components/AppDrawer'
import { Colors } from '../../constants/colors'
import { DrawerProvider } from '../../hooks/useDrawer'

const TERRAIN_NAV = [
  { route: '/(terrain)/',          label: 'Accueil' },
  { route: '/(terrain)/stock',     label: 'Stock' },
  { route: '/(terrain)/credits',   label: 'Crédits clients' },
  { route: '/(terrain)/historique', label: 'Mes ventes' },
  { route: '/(terrain)/profil',    label: 'Mon profil' },
]

function TerrainContent() {
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
        <Stack.Screen name="index"      options={{ title: 'Accueil' }} />
        <Stack.Screen name="stock"      options={{ title: 'Stock' }} />
        <Stack.Screen name="credits"    options={{ title: 'Crédits clients' }} />
        <Stack.Screen name="historique" options={{ title: 'Mes ventes' }} />
        <Stack.Screen name="profil"     options={{ title: 'Mon profil' }} />
      </Stack>
      {/* Drawer persistant sur tous les écrans */}
      <AppDrawer items={TERRAIN_NAV} accentColor={Colors.mint} />
    </View>
  )
}

export default function TerrainLayout() {
  return (
    <DrawerProvider>
      <TerrainContent />
    </DrawerProvider>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })
