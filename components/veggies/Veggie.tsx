import { useEffect, useRef } from 'react'
import { Image, ImageSourcePropType, LayoutChangeEvent, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg'
import { cursorEnabled, subscribeCursor } from './cursor'

export type VeggieType = 'onion' | 'tomato' | 'pepper'
export type Look = 'idle' | 'email' | 'password'

export interface VeggieConfig {
  id: string
  type: VeggieType
  light: string
  dark: string
  accent: string
  size: number          // largeur en px
  offsetY: number       // décalage vertical (px) — pour étager la rangée
  leafScale?: number    // taille des feuilles (oignon)
  eyeY: number          // position verticale des yeux (fraction de la hauteur)
  eyeGap: number        // écart entre les yeux (fraction de la largeur)
  eyeSize: number       // diamètre d'un œil (px)
  front?: boolean       // passe au premier plan
  image?: ImageSourcePropType   // corps réaliste (PNG sans yeux) — sinon dessin SVG
}

// Regard par défaut selon le champ actif (x: droite+, y: bas+), normalisé -1..1
const LOOK: Record<Look, { x: number; y: number }> = {
  idle: { x: 0, y: 0.18 },
  email: { x: 0, y: 0.82 },
  password: { x: 0, y: 1 },
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

interface VeggieProps {
  config: VeggieConfig
  look: Look
  closed: boolean   // ferme les yeux (mot de passe visible)
}

export function Veggie({ config, look, closed }: VeggieProps) {
  const w = config.size
  const h = config.size * 1.25
  const max = config.eyeSize * 0.24

  const px = useSharedValue(LOOK.idle.x)
  const py = useSharedValue(LOOK.idle.y)
  const lid = useSharedValue(1)

  const closedRef = useRef(closed)
  const lookRef = useRef(look)
  const center = useRef({ x: 0, y: 0 })
  const boxRef = useRef<View>(null)

  // Cible du regard selon le champ actif (300 ms)
  useEffect(() => {
    lookRef.current = look
    const t = LOOK[look]
    px.value = withTiming(t.x, { duration: 300 })
    py.value = withTiming(t.y, { duration: 300 })
  }, [look, px, py])

  // Yeux fermés quand le mot de passe est visible
  useEffect(() => {
    closedRef.current = closed
    lid.value = withTiming(closed ? 0.08 : 1, { duration: 300 })
  }, [closed, lid])

  // Suivi du curseur (web uniquement) — prioritaire au repos
  useEffect(() => {
    if (!cursorEnabled) return
    return subscribeCursor((cx, cy) => {
      if (lookRef.current !== 'idle' || closedRef.current) return
      const dx = cx - center.current.x
      const dy = cy - center.current.y
      const d = Math.hypot(dx, dy) || 1
      px.value = withTiming(clamp(dx / d), { duration: 130 })
      py.value = withTiming(clamp(dy / d), { duration: 130 })
    })
  }, [px, py])

  // Clignements aléatoires et indépendants
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const loop = () => {
      timer = setTimeout(() => {
        if (!alive) return
        if (!closedRef.current) {
          lid.value = withSequence(withTiming(0.08, { duration: 60 }), withTiming(1, { duration: 120 }))
        }
        loop()
      }, 3000 + Math.random() * 4000)
    }
    loop()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [lid])

  const onLayout = (_e: LayoutChangeEvent) => {
    boxRef.current?.measureInWindow?.((x, y, ww, hh) => {
      center.current = { x: x + ww / 2, y: y + hh * 0.45 }
    })
  }

  const pupilStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: px.value * max }, { translateY: py.value * max }],
  }))
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.value }] }))

  const eyeSize = config.eyeSize
  const pupil = eyeSize * 0.6
  const shine = pupil * 0.42
  const total = 2 * eyeSize + config.eyeGap * w

  // Joues & bouche calées sur la hauteur des yeux (coordonnées viewBox 0-125)
  const eyePx = config.eyeY * 125
  const cheekY = eyePx + 16
  const mouthY = eyePx + 25

  return (
    <View
      ref={boxRef}
      onLayout={onLayout}
      style={[
        styles.wrap,
        { width: w, height: h, marginTop: config.offsetY, elevation: config.front ? 8 : 2, zIndex: config.front ? 2 : 1 },
      ]}
    >
      {config.image ? (
        <Image source={config.image} style={{ width: w, height: h }} resizeMode="contain" />
      ) : (
        <Svg width={w} height={h} viewBox="0 0 100 125">
          <Body config={config} />
          {/* joues roses */}
          <Ellipse cx={50 - 19} cy={cheekY} rx={7.5} ry={4.6} fill="rgba(255,120,120,0.4)" />
          <Ellipse cx={50 + 19} cy={cheekY} rx={7.5} ry={4.6} fill="rgba(255,120,120,0.4)" />
          {/* sourire */}
          <Path d={`M${50 - 7} ${mouthY} Q 50 ${mouthY + 6} ${50 + 7} ${mouthY}`} stroke="rgba(60,30,20,0.55)" strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </Svg>
      )}

      <View style={[styles.eyes, { top: config.eyeY * h - eyeSize / 2, left: w / 2 - total / 2, columnGap: config.eyeGap * w }]}>
        {[0, 1].map((i) => (
          <Animated.View key={i} style={[styles.eye, { width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2 }, lidStyle]}>
            <Animated.View style={[styles.pupil, { width: pupil, height: pupil, borderRadius: pupil / 2 }, pupilStyle]}>
              <View style={[styles.shine, { width: shine, height: shine, borderRadius: shine / 2 }]} />
            </Animated.View>
          </Animated.View>
        ))}
      </View>
    </View>
  )
}

/** Corps du légume en SVG selon son type. */
function Body({ config }: { config: VeggieConfig }) {
  const gid = `g-${config.id}`
  const fill = `url(#${gid})`
  const grad = (
    <Defs>
      <RadialGradient id={gid} cx="36%" cy="26%" r="82%">
        <Stop offset="0" stopColor={config.light} />
        <Stop offset="0.55" stopColor={config.light} stopOpacity={0.85} />
        <Stop offset="1" stopColor={config.dark} />
      </RadialGradient>
    </Defs>
  )
  // reflet brillant commun
  const sheen = <Ellipse cx="37" cy="55" rx="13" ry="9" fill="rgba(255,255,255,0.32)" />

  if (config.type === 'onion') {
    return (
      <>
        {grad}
        <G transform={`translate(50, 40) scale(${config.leafScale ?? 1}) translate(-50, -40)`}>
          <G stroke={config.accent} strokeWidth={3.6} strokeLinecap="round" fill="none">
            <Path d="M50 42 C 45 22, 39 14, 33 8" />
            <Path d="M50 42 C 50 20, 50 12, 50 5" />
            <Path d="M50 42 C 55 22, 61 14, 68 9" />
          </G>
        </G>
        <Path d="M50 34 C 25 34, 15 60, 17 84 C 19 108, 34 121, 50 121 C 66 121, 81 108, 83 84 C 85 60, 75 34, 50 34 Z" fill={fill} />
        {sheen}
      </>
    )
  }

  if (config.type === 'tomato') {
    return (
      <>
        {grad}
        <G fill={config.accent}>
          <Path d="M50 30 C 40 21, 29 23, 24 30 C 34 33, 41 39, 50 39 C 59 39, 66 33, 76 30 C 71 23, 60 21, 50 30 Z" />
          <Path d="M47 22 L50 11 L53 22 Z" />
        </G>
        <Ellipse cx="50" cy="77" rx="42" ry="39" fill={fill} />
        {sheen}
      </>
    )
  }

  // pepper
  return (
    <>
      {grad}
      <Path d="M50 30 C 53 17, 57 11, 64 8" stroke={config.dark} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M50 32 C 28 30, 20 56, 23 83 C 26 107, 38 119, 50 112 C 62 119, 74 107, 77 83 C 80 56, 72 30, 50 32 Z" fill={fill} />
      <Path d="M50 112 C 47 104, 47 96, 50 88" stroke="rgba(0,0,0,0.1)" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {sheen}
    </>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', marginHorizontal: -3 },
  eyes: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  eye: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  pupil: { backgroundColor: '#241c1a', alignItems: 'flex-start', justifyContent: 'flex-start' },
  shine: { backgroundColor: 'rgba(255,255,255,0.92)', marginTop: '16%', marginLeft: '16%' },
})
