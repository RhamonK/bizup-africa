import { supabase } from '../lib/supabase'

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

/** Extension fiable à partir du type MIME du picker.
 *  NE PAS déduire de l'URI : sur web c'est un blob:http://… sans extension. */
function extFromMime(mime?: string | null): string {
  return (mime && EXT_BY_MIME[mime]) || 'jpg'
}

function contentTypeFor(mime?: string | null): string {
  return mime && mime.startsWith('image/') ? mime : 'image/jpeg'
}

/** Upload d'une image locale vers Supabase Storage, retourne l'URL publique.
 *  Passe par ArrayBuffer : l'upload direct d'un Blob échoue silencieusement
 *  sur React Native natif (fichier 0 octet). */
async function uploadImage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    const arrayBuffer = await new Response(blob).arrayBuffer()

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, { upsert: true, contentType })
    if (error) return { url: null, error: error.message }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    // cache-buster : l'URL est stable (upsert), force le rechargement après remplacement
    return { url: `${data.publicUrl}?t=${Date.now()}`, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Upload impossible' }
  }
}

export function uploadProductImage(shopId: string, productId: string, uri: string, mimeType?: string | null) {
  const ext = extFromMime(mimeType)
  return uploadImage('product-images', `${shopId}/${productId}.${ext}`, uri, contentTypeFor(mimeType))
}

export function uploadAvatar(userId: string, uri: string, mimeType?: string | null) {
  const ext = extFromMime(mimeType)
  return uploadImage('avatars', `${userId}/avatar.${ext}`, uri, contentTypeFor(mimeType))
}
