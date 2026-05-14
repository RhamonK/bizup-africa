import { Stack } from 'expo-router'
import { DrawerProvider } from '../../hooks/useDrawer'

export default function DiasporaLayout() {
  return (
    <DrawerProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#2C1654' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Vue famille — Lecture seule' }} />
      </Stack>
    </DrawerProvider>
  )
}
