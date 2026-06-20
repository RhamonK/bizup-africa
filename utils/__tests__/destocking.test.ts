import { currentLotPrice, nextLotPrice, priceAtHour } from '../destocking'

// Lot type pour les tests : base 15000, plancher 11000, fenêtre 24h
const lot = (startedHoursAgo: number) => ({
  base_price: 15000,
  floor_price: 11000,
  window_hours: 24,
  started_at: new Date(Date.now() - startedHoursAgo * 3_600_000).toISOString(),
})

describe('prix de déstockage', () => {
  it('reste au prix de base pendant la première heure', () => {
    expect(currentLotPrice(lot(0))).toBe(15000)
    expect(currentLotPrice(lot(1))).toBe(15000)
  })

  it('descend en paliers après la grâce, arrondi à 250 F', () => {
    const h6 = currentLotPrice(lot(6))
    expect(h6).toBeLessThan(15000)
    expect(h6).toBeGreaterThan(11000)
    expect(h6 % 250).toBe(0)
  })

  it('ne descend jamais sous le plancher', () => {
    expect(currentLotPrice(lot(24))).toBe(11000)
    expect(currentLotPrice(lot(48))).toBe(11000) // bien après la fenêtre
  })

  it('décroît de manière monotone', () => {
    const prices = [0, 3, 6, 9, 12, 18, 24].map(h => priceAtHour(lot(0), h))
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1])
    }
  })

  it('annonce la prochaine baisse, puis null au plancher', () => {
    expect(nextLotPrice(lot(3))).toBeLessThan(currentLotPrice(lot(3)))
    expect(nextLotPrice(lot(24))).toBeNull()
  })
})
