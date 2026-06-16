import * as Location from 'expo-location'
import { useState } from 'react'
import { Alert } from 'react-native'

export interface Coords { latitude: number; longitude: number }

/** Capture la position GPS du téléphone (foreground uniquement, sur action explicite). */
export function useCapturePosition() {
  const [capturing, setCapturing] = useState(false)

  async function capture(): Promise<Coords | null> {
    setCapturing(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorise la localisation pour enregistrer la position.')
        return null
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
    } catch {
      Alert.alert('Position introuvable', 'Réessaie à l\'extérieur, avec le GPS activé.')
      return null
    } finally {
      setCapturing(false)
    }
  }

  return { capture, capturing }
}
