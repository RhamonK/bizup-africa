import { useNavigation } from 'expo-router'
import { useLayoutEffect } from 'react'
import { HamburgerBtn } from '../components/AppDrawer'

export function useHamburgerHeader() {
  const navigation = useNavigation()
  useLayoutEffect(() => {
    // JSX obligatoire — appeler HamburgerBtn() directement viole les Rules of Hooks
    navigation.setOptions({ headerLeft: () => <HamburgerBtn /> })
  }, [navigation])
}
