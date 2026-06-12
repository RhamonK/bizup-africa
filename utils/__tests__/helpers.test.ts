import { fmt, fmtQty, formatDate, productEmoji } from '../helpers'

describe('fmt — montants FCFA', () => {
  it('affiche les petits montants tels quels', () => {
    expect(fmt(0)).toBe('0 F')
    expect(fmt(850)).toBe('850 F')
  })

  it('abrège les milliers en gardant la demi-unité', () => {
    expect(fmt(1500)).toBe('1,5k F')   // pas "2k F" — 500 F d'écart comptent
    expect(fmt(2000)).toBe('2k F')
    expect(fmt(27500)).toBe('27,5k F')
  })

  it('abrège les millions', () => {
    expect(fmt(1_000_000)).toBe('1M F')
    expect(fmt(1_500_000)).toBe('1,5M F')
  })
})

describe('fmtQty — quantités fractionnaires', () => {
  it('affiche les fractions usuelles du marché', () => {
    expect(fmtQty(0.25)).toBe('¼')
    expect(fmtQty(0.5)).toBe('½')
    expect(fmtQty(0.75)).toBe('¾')
  })

  it('combine entier et fraction', () => {
    expect(fmtQty(1.5)).toBe('1½')
    expect(fmtQty(3.25)).toBe('3¼')
  })

  it('affiche les entiers sans fraction', () => {
    expect(fmtQty(2)).toBe('2')
    expect(fmtQty(0)).toBe('0')
  })
})

describe('formatDate', () => {
  it('formate en jour court français', () => {
    // 2026-06-12 est un vendredi
    expect(formatDate(new Date(2026, 5, 12))).toBe('Ven. 12 juin')
  })
})

describe('productEmoji', () => {
  it('reconnaît les produits connus, insensible à la casse', () => {
    expect(productEmoji('Tomates fraîches').emoji).toBe('🍅')
    expect(productEmoji('PIMENT').emoji).toBe('🌶️')
  })

  it('retombe sur l\'emoji générique sinon', () => {
    expect(productEmoji('Igname').emoji).toBe('🌿')
    expect(productEmoji().emoji).toBe('🌿')
  })
})
