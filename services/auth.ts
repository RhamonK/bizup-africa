import { supabase } from '../lib/supabase'

/** Crée le compte auth d'un employé. Retourne l'id utilisateur créé. */
export async function signUpEmployee(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  return { userId: data.user?.id ?? null, error: error?.message ?? null }
}

/** Change le mot de passe après re-vérification de l'actuel.
 *  Retourne un message d'erreur lisible, ou null si OK. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user?.email ?? '',
    password: currentPassword,
  })
  if (signInErr) return 'Mot de passe actuel incorrect.'

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return error?.message ?? null
}
