import { Drawer } from 'expo-router/drawer'
import { DrawerContent } from '../../components/DrawerContent'
import { Colors } from '../../constants/colors'

const DIASPORA_NAV = [
  { route: 'index', label: 'Vue générale', icon: '▦' },
]

export default function DiasporaLayout() {
  return (
    <Drawer
      drawerContent={props => (
        <DrawerContent items={DIASPORA_NAV} drawerProps={props} accentColor={Colors.amber} />
      )}
      screenOptions={{
        headerStyle: { backgroundColor: '#2C1654', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        drawerStyle: { backgroundColor: '#1A0D33', width: 260 },
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Vue famille — Lecture seule' }} />
    </Drawer>
  )
}
