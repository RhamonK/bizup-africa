import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../constants/colors'

interface Props {
  data: number[]                          // 7 valeurs
  labels?: string[]                       // ex: ['J-6','J-5',...,'Auj.']
  height?: number
  highlightLast?: boolean
}

const DEFAULT_LABELS = ['J-6', 'J-5', 'J-4', 'J-3', 'J-2', 'Hier', 'Auj.']

export function BarChart({ data, labels = DEFAULT_LABELS, height = 64, highlightLast = true }: Props) {
  const max = Math.max(...data, 1)

  return (
    <View>
      <View style={[styles.chart, { height }]}>
        {data.map((val, i) => {
          const isNow = highlightLast && i === data.length - 1
          const barH = Math.max(4, (val / max) * height)
          return (
            <View key={i} style={styles.barWrap}>
              {val > 0 && (
                <Text style={styles.barVal}>
                  {val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val > 0 ? val.toString() : ''}
                </Text>
              )}
              <View style={[
                styles.bar,
                { height: barH },
                isNow ? styles.barNow : styles.barDefault,
              ]} />
            </View>
          )
        })}
      </View>
      <View style={styles.labels}>
        {labels.map((l, i) => {
          const isNow = highlightLast && i === labels.length - 1
          return (
            <Text key={i} style={[styles.label, isNow && styles.labelNow]}>{l}</Text>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barVal: {
    fontSize: 8,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: '700',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  barDefault: {
    backgroundColor: 'rgba(13,74,47,0.12)',
  },
  barNow: {
    backgroundColor: Colors.mint,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  labels: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  label: {
    flex: 1,
    fontSize: 9,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontWeight: '600',
  },
  labelNow: {
    color: Colors.mint,
    fontWeight: '800',
  },
})
