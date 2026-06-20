import { Platform } from 'react-native'

type Listener = (x: number, y: number) => void

const listeners = new Set<Listener>()
let started = false

/** Le suivi du curseur n'a de sens que sur le web (souris). */
export const cursorEnabled = Platform.OS === 'web'

function start() {
  if (started || !cursorEnabled || typeof window === 'undefined') return
  started = true
  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => listeners.forEach((l) => l(e.clientX, e.clientY)),
    { passive: true },
  )
}

/** S'abonne aux mouvements du curseur. Renvoie la fonction de désabonnement. */
export function subscribeCursor(l: Listener) {
  start()
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
