import { usePathname, useRouter } from 'expo-router'
import {
  Animated, ScrollView,
  StyleSheet, Text, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import { useAuth } from '../hooks/useAuth'
import { DRAWER_WIDTH, useDrawer } from '../hooks/useDrawer'
import { AvatarDisplay } from './AvatarDisplay'

export interface NavItem {
  route: string
  label: string
  badge?: number
}

interface Props {
  items: NavItem[]
  activeRoute?: string  // optionnel — auto-détecté si absent
  accentColor?: string
}

export function AppDrawer({ items, activeRoute: activeProp, accentColor = Colors.mint }: Props) {
  const { isOpen, close, translateX } = useDrawer()
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const activeRoute = activeProp ?? pathname

  if (!isOpen) return null

  const roleLabel =
    profile?.role === 'terrain' ? (profile.job_title ?? 'Employé terrain') :
    profile?.role === 'diaspora' ? 'Vue famille' : 'Gérant(e)'

  function navigate(route: string) {
    close()
    setTimeout(() => router.push(route), 50)
  }

  function handleSignOut() {
    close()
    setTimeout(() => signOut(), 100)
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay sombre */}
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View style={[styles.overlay, {
          opacity: translateX.interpolate({
            inputRange: [-DRAWER_WIDTH, 0],
            outputRange: [0, 1],
          }),
        }]} />
      </TouchableWithoutFeedback>

      {/* Panneau drawer */}
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

          {/* Profil */}
          <View style={styles.profile}>
            <AvatarDisplay url={profile?.avatar_url ?? null} size={52} name={profile?.full_name} dark />
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>{profile?.full_name ?? '—'}</Text>
              <Text style={styles.profileRole}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Nav items */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {items.map(item => {
              const isActive = activeRoute === item.route
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.item, isActive && styles.itemActive]}
                  onPress={() => navigate(item.route)}
                  activeOpacity={0.7}
                >
                  {isActive && <View style={[styles.activeBar, { backgroundColor: accentColor }]} />}
                  <Text style={[styles.itemLabel, isActive && { color: accentColor, fontWeight: '700' }]}>
                    {item.label}
                  </Text>
                  {item.badge ? (
                    <View style={[styles.badge, { backgroundColor: Colors.danger }]}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={styles.separator} />

          {/* Déconnexion */}
          <TouchableOpacity style={styles.logout} onPress={handleSignOut}>
            <Text style={styles.logoutText}>↩  Déconnexion</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </Animated.View>
    </View>
  )
}

/* Bouton hamburger à mettre dans les headers */
export function HamburgerBtn() {
  const { toggle } = useDrawer()
  return (
    <TouchableOpacity style={styles.hamburger} onPress={toggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={styles.bar} />
      <View style={styles.bar} />
      <View style={styles.bar} />
    </TouchableOpacity>
  )
}

/** Bouton avatar/nom dans le header droit → navigue vers le profil */
export function ProfileHeaderBtn() {
  const { profile } = useAuth()
  const router = useRouter()

  const profilRoute =
    profile?.role === 'terrain'  ? '/(terrain)/profil' :
    profile?.role === 'diaspora' ? null :
    '/(boss)/profil'

  if (!profilRoute) return null

  return (
    <TouchableOpacity
      onPress={() => router.push(profilRoute)}
      style={styles.profileBtn}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <AvatarDisplay url={profile?.avatar_url ?? null} size={30} name={profile?.full_name} dark />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0D1A12',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    paddingTop: 16,
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  profileRole: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    position: 'relative',
  },
  itemActive: { backgroundColor: 'rgba(46,204,138,0.08)' },
  itemLabel:   { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500', flex: 1 },
  activeBar:   { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  logout:      { paddingHorizontal: 20, paddingVertical: 16 },
  logoutText:  { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  badge:       { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:   { fontSize: 10, fontWeight: '800', color: '#fff' },
  hamburger:   { marginLeft: 8, padding: 6, gap: 4 },
  bar:         { width: 22, height: 2, borderRadius: 2, backgroundColor: '#fff' },
  profileBtn:  { marginRight: 6, padding: 2 },
})
