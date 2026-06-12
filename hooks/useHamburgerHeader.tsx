import { useNavigation } from 'expo-router'
import { useLayoutEffect } from 'react'
import { HamburgerBtn, ProfileHeaderBtn } from '../components/AppDrawer'

export function useHamburgerHeader() {
  const navigation = useNavigation()
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft:  () => <HamburgerBtn />,
      headerRight: () => <ProfileHeaderBtn />,
    })
  }, [navigation])
}
