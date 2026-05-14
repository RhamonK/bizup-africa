import { Drawer } from 'expo-router/drawer'
import { DrawerContent } from '../../components/DrawerContent'
import { Colors } from '../../constants/colors'

const TERRAIN_NAV = [
  { route: 'index',      label: 'Accueil',         icon: '⌂' },
  { route: 'stock',      label: 'Stock',            icon: '▣' },
  { route: 'credits',    label: 'Crédits clients',  icon: '◫' },
  { route: 'historique', label: 'Mes ventes',       icon: '≡' },
  { route: 'profil',     label: 'Mon profil',       icon: '○' },
]

export default function TerrainLayout() {
  return (
    <Drawer
      drawerContent={props => (
        <DrawerContent items={TERRAIN_NAV} drawerProps={props} accentColor={Colors.mint} />
      )}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.forest, elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        drawerStyle: { backgroundColor: '#0D1A12', width: 260 },
        drawerActiveTintColor: Colors.mint,
        drawerInactiveTintColor: 'rgba(255,255,255,0.5)',
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="index"      options={{ title: 'Accueil' }} />
      <Drawer.Screen name="stock"      options={{ title: 'Stock' }} />
      <Drawer.Screen name="credits"    options={{ title: 'Crédits clients' }} />
      <Drawer.Screen name="historique" options={{ title: 'Mes ventes' }} />
      <Drawer.Screen name="profil"     options={{ title: 'Mon profil' }} />
    </Drawer>
  )
}
