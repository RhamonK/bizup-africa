import { Drawer } from 'expo-router/drawer'
import { DrawerContent } from '../../components/DrawerContent'
import { Colors } from '../../constants/colors'

const GERANT_NAV = [
  { route: 'index',         label: 'Tableau de bord',  icon: '▦' },
  { route: 'gestion',       label: 'Gestion',           icon: '⚙' },
  { route: 'fournisseurs',  label: 'Fournisseurs',      icon: '⇄' },
  { route: 'historique',    label: 'Historique ventes', icon: '≡' },
  { route: 'marges',        label: 'Marges & finances', icon: '↗' },
  { route: 'employes',      label: 'Équipe',            icon: '◎' },
  { route: 'finances',      label: 'Dossier financier', icon: '◈' },
  { route: 'profil',        label: 'Mon profil',        icon: '○' },
]

export default function GerantLayout() {
  return (
    <Drawer
      drawerContent={props => (
        <DrawerContent items={GERANT_NAV} drawerProps={props} accentColor={Colors.mint} />
      )}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.forest, elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        drawerStyle: { backgroundColor: '#0D1A12', width: 280 },
        drawerActiveTintColor: Colors.mint,
        drawerInactiveTintColor: 'rgba(255,255,255,0.5)',
        swipeEnabled: true,
        headerRight: undefined,
      }}
    >
      <Drawer.Screen name="index"       options={{ title: 'Tableau de bord' }} />
      <Drawer.Screen name="gestion"     options={{ title: 'Gestion' }} />
      <Drawer.Screen name="fournisseurs" options={{ title: 'Fournisseurs' }} />
      <Drawer.Screen name="historique"  options={{ title: 'Historique des ventes' }} />
      <Drawer.Screen name="marges"      options={{ title: 'Marges & Finances' }} />
      <Drawer.Screen name="employes"    options={{ title: 'Équipe' }} />
      <Drawer.Screen name="finances"    options={{ title: 'Dossier Financier' }} />
      <Drawer.Screen name="profil"      options={{ title: 'Mon Profil' }} />
    </Drawer>
  )
}
