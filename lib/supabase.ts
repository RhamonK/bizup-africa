import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Sur web : localStorage direct (SSR-safe — guard window).
// Sur mobile : SecureStore → Keychain iOS / Keystore Android.
const webStorage = {
  getItem:    (key: string) => Promise.resolve(typeof window !== 'undefined' ? window.localStorage.getItem(key) : null),
  setItem:    (key: string, value: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); return Promise.resolve() },
  removeItem: (key: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(key); return Promise.resolve() },
}

const secureStorage = Platform.OS === 'web'
  ? webStorage
  : {
      getItem:    (key: string) => SecureStore.getItemAsync(key),
      setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
