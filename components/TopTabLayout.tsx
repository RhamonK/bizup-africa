import {
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
  createMaterialTopTabNavigator,
} from '@react-navigation/material-top-tabs'
import { ParamListBase, TabNavigationState } from '@react-navigation/native'
import { withLayoutContext } from 'expo-router'
import { Colors } from '../constants/colors'

const { Navigator } = createMaterialTopTabNavigator()

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator)

export const topTabScreenOptions: MaterialTopTabNavigationOptions = {
  tabBarStyle: {
    backgroundColor: Colors.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13,74,47,0.10)',
  },
  tabBarLabelStyle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'none',
  },
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.textSecondary,
  tabBarIndicatorStyle: {
    backgroundColor: Colors.primary,
    height: 3,
    borderRadius: 2,
  },
  tabBarScrollEnabled: true,
  tabBarItemStyle: { width: 'auto', paddingHorizontal: 16 },
}
