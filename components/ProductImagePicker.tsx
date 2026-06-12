import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import { uploadProductImage } from '../services/storage'
import { ProductImage } from './ProductImage'

interface Props {
  productId: string
  shopId: string
  currentUrl?: string | null
  productName: string
  onUploaded: (url: string) => void
}

export function ProductImagePicker({ productId, shopId, currentUrl, productName, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false)

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    const { url, error } = await uploadProductImage(shopId, productId, result.assets[0].uri)
    setUploading(false)

    if (error || !url) {
      Alert.alert('Erreur', 'La photo n\'a pas pu être envoyée. Vérifie ta connexion et réessaie.')
      return
    }
    onUploaded(url)
  }

  return (
    <TouchableOpacity style={s.container} onPress={pick} disabled={uploading}>
      <ProductImage name={productName} photoUrl={currentUrl} size={72} borderRadius={16} />
      <View style={s.badge}>
        {uploading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={s.badgeText}>📷</Text>
        }
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { position: 'relative', alignSelf: 'flex-start', marginBottom: 16 },
  badge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.forest,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  badgeText: { fontSize: 13 },
})
