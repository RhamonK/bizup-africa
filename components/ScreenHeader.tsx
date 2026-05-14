/**
 * Header sombre style template HTML — bouton "← Retour" arrondi blanc semi-transparent
 * Correspond exactement au .back du prototype : background rgba(255,255,255,0.1), border-radius 10px
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'

interface Props {
  title: string
  onBack?: () => void
  right?: React.ReactNode
  subtitle?: string
  bg?: string
}

export function ScreenHeader({ title, onBack, right, subtitle, bg = Colors.forest }: Props) {
  return (
    <View style={[styles.header, { backgroundColor: bg }]}>
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  backText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
})
