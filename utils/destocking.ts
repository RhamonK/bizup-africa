// Calcul du prix de déstockage — pur, sans dépendance, donc testable.
// Plein tarif pendant GRACE_HOURS, puis décote par paliers horaires
// jusqu'au prix plancher sur window_hours. Jamais en dessous du plancher.

export interface LotPricing {
  base_price: number
  floor_price: number
  window_hours: number
  started_at: string
}

const GRACE_HOURS = 1     // 1h à plein tarif avant de baisser
const STEP = 250          // arrondi FCFA pour un prix lisible

function elapsedHours(startedAt: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(startedAt).getTime()) / 3_600_000)
}

export function priceAtHour(lot: LotPricing, hour: number): number {
  if (hour <= GRACE_HOURS) return lot.base_price
  const span = Math.max(1, lot.window_hours - GRACE_HOURS)
  const progress = Math.min(1, (hour - GRACE_HOURS) / span)
  const raw = lot.base_price - (lot.base_price - lot.floor_price) * progress
  const rounded = Math.round(raw / STEP) * STEP
  return Math.max(lot.floor_price, rounded)
}

/** Prix conseillé maintenant. */
export function currentLotPrice(lot: LotPricing, now: Date = new Date()): number {
  return priceAtHour(lot, elapsedHours(lot.started_at, now))
}

/** Prix de l'heure suivante, pour afficher « tombe à X dans 1h ».
 *  null si on est déjà au plancher (plus de baisse). */
export function nextLotPrice(lot: LotPricing, now: Date = new Date()): number | null {
  const current = currentLotPrice(lot, now)
  if (current <= lot.floor_price) return null
  const next = priceAtHour(lot, elapsedHours(lot.started_at, now) + 1)
  return next < current ? next : null
}
