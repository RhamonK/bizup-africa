import { StyleSheet, View } from 'react-native'
import { Look, Veggie, VeggieConfig } from './Veggie'

// Ordre exact : oignon jaune, tomate, oignon violet, piment vert (devant), tomate
const VEGGIES: VeggieConfig[] = [
  { id: 'onion-y', type: 'onion', light: '#FFE08A', dark: '#E8A93C', accent: '#6BBF59', size: 72, offsetY: 10, leafScale: 0.6, eyeY: 0.5, eyeGap: 0.1, eyeSize: 17 },
  { id: 'tomato-1', type: 'tomato', light: '#FF7A6B', dark: '#C0392B', accent: '#3FA34D', size: 76, offsetY: 6, eyeY: 0.54, eyeGap: 0.1, eyeSize: 18 },
  { id: 'onion-p', type: 'onion', light: '#B06BC9', dark: '#6C3483', accent: '#6BBF59', size: 82, offsetY: 0, leafScale: 1, eyeY: 0.48, eyeGap: 0.1, eyeSize: 19 },
  { id: 'pepper', type: 'pepper', light: '#86D957', dark: '#3E8E3E', accent: '#2E6B2E', size: 66, offsetY: 26, eyeY: 0.5, eyeGap: 0.1, eyeSize: 15, front: true },
  { id: 'tomato-2', type: 'tomato', light: '#FF7A6B', dark: '#B83227', accent: '#3FA34D', size: 74, offsetY: 6, eyeY: 0.54, eyeGap: 0.1, eyeSize: 17 },
]

interface Props {
  look: Look
  hidePeek: boolean   // mot de passe visible -> les légumes ferment les yeux
}

export function VeggieMascots({ look, hidePeek }: Props) {
  return (
    <View style={styles.row}>
      {VEGGIES.map((v) => (
        <Veggie key={v.id} config={v} look={look} closed={hidePeek} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
})
