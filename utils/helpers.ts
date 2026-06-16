const MONTHS = ['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc']
const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

// Photos produits stockées dans Supabase Storage (bucket product-images).
// productImage() a été supprimé — utiliser le composant <ProductImage photoUrl={...} /> à la place.

export function productEmoji(name = ''): { emoji: string; bg: string } {
  const n = name.toLowerCase()
  if (n.includes('tomate')) return { emoji: '🍅', bg: '#FFF3E0' }
  if (n.includes('piment')) return { emoji: '🌶️', bg: '#FDF0EE' }
  if (n.includes('oignon')) return { emoji: '🧅', bg: '#F5F0E8' }
  return { emoji: '🌿', bg: '#E8F5EE' }
}

export function fmt(n: number): string {
  // 1 décimale conservée pour ne pas masquer 500 F d'écart (1 500 → "1,5k F", 2 000 → "2k F")
  if (n >= 1000000) return trimZero(n / 1000000) + 'M F'
  if (n >= 1000) return trimZero(n / 1000) + 'k F'
  return n.toLocaleString('fr-FR') + ' F'
}

function trimZero(n: number): string {
  return n.toFixed(1).replace('.0', '').replace('.', ',')
}

/** Affiche une quantité en fraction lisible.
 *  0.25 → "¼"  |  0.5 → "½"  |  0.75 → "¾"
 *  1.5  → "1½" |  2   → "2"  |  3.25 → "3¼"
 */
export function fmtQty(n: number): string {
  const whole = Math.floor(n)
  const frac  = Math.round((n - whole) * 4) / 4   // arrondi au ¼ le plus proche
  const fracStr = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : ''
  if (whole === 0) return fracStr || '0'
  return fracStr ? `${whole}${fracStr}` : `${whole}`
}

export function formatDate(date: Date): string {
  return `${DAYS[date.getDay()]}. ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/** Lien WhatsApp (wa.me) : numéro réduit aux chiffres + message encodé.
 *  Renvoie null si le numéro est inexploitable (trop court / absent). */
export function whatsappUrl(phone: string | null, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
