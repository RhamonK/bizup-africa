import { createContext, useContext, useRef, useState } from 'react'
import { Animated } from 'react-native'

interface DrawerCtx {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  translateX: Animated.Value
}

const Ctx = createContext<DrawerCtx>({} as DrawerCtx)

const DRAWER_WIDTH = 270

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current

  function open() {
    setIsOpen(true)
    Animated.timing(translateX, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }

  function close() {
    Animated.timing(translateX, {
      toValue: -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setIsOpen(false))
  }

  function toggle() {
    isOpen ? close() : open()
  }

  return (
    <Ctx.Provider value={{ isOpen, open, close, toggle, translateX }}>
      {children}
    </Ctx.Provider>
  )
}

export function useDrawer() {
  return useContext(Ctx)
}

export { DRAWER_WIDTH }
