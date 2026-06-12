import NetInfo from '@react-native-community/netinfo'

/** Détection réseau fiable sur natif ET web.
 *  Ne pas utiliser navigator.onLine : il n'existe pas sur React Native natif. */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch()
  // isInternetReachable peut être null le temps de la vérification — on ne bloque que sur un false explicite
  return state.isConnected === true && state.isInternetReachable !== false
}
