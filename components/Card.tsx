import { StyleSheet, View, ViewProps } from 'react-native'
import { Colors } from '../constants/colors'

interface CardProps extends ViewProps {
  padding?: number
}

export function Card({ style, padding = 16, ...props }: CardProps) {
  return (
    <View
      style={[styles.card, { padding }, style]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
})
