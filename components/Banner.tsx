import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../constants/colors'

/** Bandeau de feedback inline (succès/erreur) — fiable sur web ET mobile,
 *  contrairement à Alert.alert qui ne s'affiche pas toujours sur le web. */
export function Banner({ type, message }: { type: 'success' | 'error'; message: string }) {
  const ok = type === 'success'
  return (
    <View style={[styles.banner, { backgroundColor: ok ? Colors.successLight : Colors.dangerLight }]}>
      <Text style={[styles.text, { color: ok ? Colors.forest : Colors.danger }]}>
        {ok ? '✅ ' : '⚠️ '}{message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 4 },
  text: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
})
