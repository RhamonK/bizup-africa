import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../constants/colors'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean // true = fond sombre (headers verts)
}

const SIZES = { sm: 16, md: 22, lg: 32 }

export function AppName({ size = 'md', dark = true }: Props) {
  const fs = SIZES[size]
  const mainColor = dark ? '#fff' : Colors.forest
  const accentColor = Colors.mint

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { fontSize: fs, color: mainColor }]}>
        Mama
        <Text style={{ color: accentColor }}>Shop</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  text: { fontWeight: '900', letterSpacing: -0.5 },
})
