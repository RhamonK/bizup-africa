import { Image, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../constants/colors'

interface Props {
  url: string | null
  size?: number
  name?: string
  dark?: boolean
}

export function AvatarDisplay({ url, size = 40, name, dark = false }: Props) {
  const letter = name ? name[0].toUpperCase() : '?'
  const bg = dark ? 'rgba(255,255,255,0.12)' : Colors.primaryLight
  const textColor = dark ? '#fff' : Colors.forestMid

  if (!url) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={{ fontSize: size * 0.45, fontWeight: '700', color: textColor }}>{letter}</Text>
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
  placeholder: { alignItems: 'center', justifyContent: 'center' },
})
