import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { uploadAvatar } from '../services/storage'
import { AvatarDisplay } from './AvatarDisplay'

interface AvatarPickerProps {
  userId: string
  currentUrl: string | null
  size?: number
  onUploaded: (url: string) => void
}

export function AvatarPicker({ userId, currentUrl, size = 80, onUploaded }: AvatarPickerProps) {
  const [uploading, setUploading] = useState(false)

  async function pickAndUpload() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorise l\'accès à ta galerie photo.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled) return

    setUploading(true)
    const { url, error } = await uploadAvatar(userId, result.assets[0].uri, result.assets[0].mimeType)
    setUploading(false)

    if (error || !url) {
      Alert.alert('Erreur upload', error ?? 'Réessaie plus tard.')
      return
    }
    onUploaded(url)
  }

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
      onPress={pickAndUpload}
      disabled={uploading}
    >
      {uploading
        ? <ActivityIndicator color={Colors.primary} />
        : <AvatarDisplay url={currentUrl} size={size} />}
      <View style={styles.editBadge}>
        <Text style={{ fontSize: 10 }}>📷</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
})
