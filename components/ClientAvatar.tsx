import { Text, View } from 'react-native'
import { Colors } from '../constants/colors'
import { ClientLevel } from '../lib/types'

export const LEVEL_COLORS: Record<ClientLevel, string> = {
  grand_compte: Colors.boss,
  vip:          Colors.info,
  standard:     Colors.sage,
}

export const LEVEL_ICON: Record<ClientLevel, string> = {
  grand_compte: '👑',
  vip:          '⭐',
  standard:     '',
}

export const LEVEL_LABEL: Record<ClientLevel, string> = {
  grand_compte: 'Grand compte',
  vip:          'VIP',
  standard:     'Standard',
}

export function ClientAvatar({ name, level, size = 42 }: {
  name: string; level: ClientLevel; size?: number
}) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.31,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: LEVEL_COLORS[level] ?? Colors.sage,
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '800' }}>
        {initials}
      </Text>
    </View>
  )
}
