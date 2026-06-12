import { View } from 'react-native'
import { Colors } from '../constants/colors'

export function ReliabilityDots({ score }: { score: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: i <= score ? Colors.primary : Colors.border,
          }}
        />
      ))}
    </View>
  )
}
