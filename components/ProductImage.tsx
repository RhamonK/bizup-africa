import { Image, StyleSheet, Text, View } from 'react-native'
import { productEmoji } from '../utils/helpers'

interface Props {
  name: string
  photoUrl?: string | null
  size?: number
  borderRadius?: number
}

/**
 * Affiche la photo Supabase Storage si photoUrl est fourni,
 * sinon l'emoji fallback coloré.
 */
export function ProductImage({ name, photoUrl, size = 52, borderRadius = 14 }: Props) {
  const { emoji, bg } = productEmoji(name)

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius }}
        resizeMode="cover"
      />
    )
  }

  return (
    <View style={[s.fallback, { width: size, height: size, borderRadius, backgroundColor: bg }]}>
      <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
})
