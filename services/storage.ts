import { supabase } from '../lib/supabase'

/** Upload d'une image locale vers Supabase Storage, retourne l'URL publique.
 *  Passe par ArrayBuffer : l'upload direct d'un Blob échoue silencieusement
 *  sur React Native natif (fichier 0 octet). */
async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
  ext: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    const arrayBuffer = await new Response(blob).arrayBuffer()

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext}` })
    if (error) return { url: null, error: error.message }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return { url: data.publicUrl, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Upload impossible' }
  }
}

export function uploadProductImage(shopId: string, productId: string, uri: string) {
  const ext = uri.split('.').pop() ?? 'jpg'
  return uploadImage('product-images', `${shopId}/${productId}.${ext}`, uri, ext)
}

export function uploadAvatar(userId: string, uri: string) {
  const ext = uri.split('.').pop() ?? 'jpg'
  return uploadImage('avatars', `${userId}/avatar.${ext}`, uri, ext)
}
