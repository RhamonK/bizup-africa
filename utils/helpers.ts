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

export interface MargeRow {
  id: string
  name: string
  unit: string
  avg_sale_price: number
  avg_buy_price: number
  marge_fcfa: number
  marge_pct: number
  stock: number
  sales_count: number
}

/** Calcule les marges par produit + la marge moyenne du commerce.
 *  La moyenne ne compte QUE les produits dont on connaît le prix d'achat
 *  (sinon des produits à 0% fausseraient le chiffre). Utilisé par l'écran
 *  Marges ET le KPI du tableau de bord, pour qu'ils soient toujours cohérents. */
export function computeMargins(
  products: { id: string; name: string; unit: string; current_price: number; stock_quantity: number }[],
  saleItems: { product_id: string; unit_price: number }[],
  buyRows: { product_id: string; price: number }[],
): { rows: MargeRow[]; avgPct: number } {
  const salePrices: Record<string, number[]> = {}
  saleItems.forEach(si => {
    if (!salePrices[si.product_id]) salePrices[si.product_id] = []
    salePrices[si.product_id].push(si.unit_price)
  })
  const buyPrices: Record<string, number[]> = {}
  buyRows.forEach(b => {
    if (!buyPrices[b.product_id]) buyPrices[b.product_id] = []
    buyPrices[b.product_id].push(b.price)
  })

  const rows: MargeRow[] = products.map(p => {
    const sales = salePrices[p.id] ?? []
    const buys = buyPrices[p.id] ?? []
    const avgSale = sales.length ? sales.reduce((a, b) => a + b, 0) / sales.length : p.current_price
    const avgBuy = buys.length ? buys.reduce((a, b) => a + b, 0) / buys.length : 0
    const margeFcfa = avgBuy > 0 ? avgSale - avgBuy : 0
    const margePct = avgBuy > 0 ? (margeFcfa / avgBuy) * 100 : 0
    return {
      id: p.id, name: p.name, unit: p.unit,
      avg_sale_price: Math.round(avgSale), avg_buy_price: Math.round(avgBuy),
      marge_fcfa: Math.round(margeFcfa), marge_pct: Math.round(margePct),
      stock: p.stock_quantity, sales_count: sales.length,
    }
  })

  const withBuy = rows.filter(r => r.avg_buy_price > 0)
  const avgPct = withBuy.length ? Math.round(withBuy.reduce((s, r) => s + r.marge_pct, 0) / withBuy.length) : 0
  return { rows, avgPct }
}

/** Lien WhatsApp (wa.me) : numéro réduit aux chiffres + message encodé.
 *  Renvoie null si le numéro est inexploitable (trop court / absent). */
export function whatsappUrl(phone: string | null, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
