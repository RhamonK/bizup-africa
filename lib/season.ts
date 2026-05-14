/**
 * Calcule l'alerte saisonnière pour l'Afrique de l'Ouest
 * Saison sèche (harmattan) : novembre → mars
 * Saison des pluies : avril → octobre
 */
export interface SeasonAlert {
  message: string
  detail: string
  type: 'dry_coming' | 'rainy_coming' | 'dry_active' | 'rainy_active'
  weeksUntil: number | null
}

export function getSeasonAlert(date = new Date()): SeasonAlert {
  const month = date.getMonth() + 1 // 1-12

  // Saison sèche : nov (11) → mars (3)
  const isDry = month >= 11 || month <= 3
  // Saison pluies : avril (4) → oct (10)
  const isRainy = month >= 4 && month <= 10

  if (isDry) {
    // On est en saison sèche — quand arrivent les pluies ?
    // Pluies arrivent en avril (mois 4)
    const aprilThisYear = new Date(date.getFullYear(), 3, 1) // avril
    const aprilNextYear = new Date(date.getFullYear() + 1, 3, 1)
    const target = month >= 4 ? aprilNextYear : aprilThisYear
    const weeks = Math.round((target.getTime() - date.getTime()) / (7 * 86400000))
    return {
      message: `☀️ Saison sèche active`,
      detail: `Prix tomates plus hauts · Saison pluies dans ~${weeks} semaines`,
      type: 'dry_active',
      weeksUntil: weeks,
    }
  }

  // On est en saison des pluies — quand arrive la sèche ?
  const novThisYear = new Date(date.getFullYear(), 10, 1) // novembre
  const novNextYear = new Date(date.getFullYear() + 1, 10, 1)
  const target = month >= 11 ? novNextYear : novThisYear
  const weeks = Math.round((target.getTime() - date.getTime()) / (7 * 86400000))

  if (weeks <= 8) {
    return {
      message: `☀️ Saison sèche dans ${weeks} semaine${weeks > 1 ? 's' : ''}`,
      detail: `Prix tomates vont monter · Commander maintenant`,
      type: 'dry_coming',
      weeksUntil: weeks,
    }
  }

  return {
    message: `🌧️ Saison des pluies active`,
    detail: `Bonne période pour les piments · Saison sèche dans ${weeks} semaines`,
    type: 'rainy_active',
    weeksUntil: weeks,
  }
}
