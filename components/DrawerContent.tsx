import { DrawerContentScrollView } from '@react-navigation/drawer'
import { useRouter } from 'expo-router'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { AvatarDisplay } from './AvatarDisplay'
import { Colors } from '../constants/colors'
import { useAuth } from '../hooks/useAuth'

interface NavItem {
  route: string
  label: string
  icon: string      // Feather-like text icon
}

interface Props {
  items: NavItem[]
  drawerProps: any
  accentColor?: string
}

export function DrawerContent({ items, drawerProps, accentColor = Colors.mint }: Props) {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const state = drawerProps.state
  const activeRoute = state?.routes?.[state?.index]?.name ?? ''

  function handleSignOut() {
    Alert.alert('Déconnexion', 'Quitter l\'application ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: signOut },
    ])
  }

  const roleLabel = profile?.role === 'terrain'
    ? profile.job_title ?? 'Employé terrain'
    : profile?.role === 'diaspora'
    ? 'Vue famille'
    : 'Gérant(e)'

  return (
    <View style={styles.root}>
      {/* Profile section */}
      <View style={styles.profileSection}>
        <AvatarDisplay url={profile?.avatar_url ?? null} size={56} name={profile?.full_name} dark />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.profileRole}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Nav items */}
      <DrawerContentScrollView {...drawerProps} style={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.map(item => {
          const isActive = activeRoute === item.route || (item.route === 'index' && activeRoute === '')
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, isActive && { color: accentColor }]}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && { color: accentColor, fontWeight: '700' }]}>
                {item.label}
              </Text>
              {isActive && <View style={[styles.activeBar, { backgroundColor: accentColor }]} />}
            </TouchableOpacity>
          )
        })}
      </DrawerContentScrollView>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <Text style={styles.logoutIcon}>↩</Text>
          <Text style={styles.logoutLabel}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1A12' },

  profileSection: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 24, paddingTop: 50, paddingBottom: 20,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  profileRole: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 20 },

  scroll: { flex: 1, paddingTop: 8 },

  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 0, position: 'relative',
  },
  navItemActive: { backgroundColor: 'rgba(46,204,138,0.08)' },
  navIcon: { fontSize: 16, width: 22, textAlign: 'center', color: 'rgba(255,255,255,0.45)' },
  navLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500', flex: 1 },
  activeBar: { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },

  bottomSection: { paddingBottom: 32 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  logoutIcon: { fontSize: 16, color: 'rgba(255,255,255,0.35)', width: 22, textAlign: 'center' },
  logoutLabel: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
})
