import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { supabase } from '../lib/supabase'

interface AvatarPickerProps {
  userId: string
  currentUrl: string | null
  size?: number
  onUploaded: (url: string) => void
}

export function AvatarPicker({ userId, currentUrl, size = 80, onUploaded }: AvatarPickerProps) {
  const [uploading, setUploading] = useState(false)

  const initials = '👤'

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
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const fileName = `${userId}/avatar.${ext}`

      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${ext}`,
          upsert: true,
        })

      if (error) { Alert.alert('Erreur upload', error.message); return }

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      onUploaded(data.publicUrl)
    } finally {
      setUploading(false)
    }
  }

  return (
    <TouchableOpacity style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]} onPress={pickAndUpload} disabled={uploading}>
      {uploading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : currentUrl ? (
        <AvatarImage url={currentUrl} size={size} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={{ fontSize: size * 0.4 }}>{initials}</Text>
        </View>
      )}
      <View style={styles.editBadge}>
        <Text style={{ fontSize: 10 }}>📷</Text>
      </View>
    </TouchableOpacity>
  )
}

function AvatarImage({ url, size }: { url: string; size: number }) {
  // Utilise Image de react-native avec gestion d'erreur
  const { Image } = require('react-native')
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      defaultSource={{ uri: '' }}
    />
  )
}

export function AvatarDisplay({ url, size = 40, name }: { url: string | null; size?: number; name?: string }) {
  const { Image } = require('react-native')
  const letter = name ? name[0].toUpperCase() : '?'
  if (!url) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.45, fontWeight: '700', color: Colors.primaryDark }}>{letter}</Text>
      </View>
    )
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surfaceSecondary }}
    />
  )
}

const styles = StyleSheet.create({
  container: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  placeholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
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
