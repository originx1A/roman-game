/** Shared numbers. Coin amounts and item prices stay placeholders until the coin chart. */

export const TERMS_VERSION = '2026-10-24'
export const BUILD_NUMBER = '2026.10.24.1'

/** Working cash-buying age. Quebec's 14 is not applied. Asked once, then only over/under is kept. */
export const CASH_AGE = 13

export const MAX_HEARTS = 3
export const DAILY_FREE_COINS = 25
export const RESET_MINUTES = 20
export const APPROVAL_DAYS = 7
export const REMINDER_DAYS = 3

export const SELLER = 'Funderwood'
export const SUPPORT_EMAIL = 'support@romansgame.com'

export type Sku = 'starter' | 'pack-small'

export function priceForCountry(country: string | null | undefined): {
  currency: 'cad' | 'usd'
  starterCents: number
  smallCents: number
  symbol: 'CA$' | 'US$'
} {
  if ((country ?? '').toUpperCase() === 'US') {
    return { currency: 'usd', starterCents: 199, smallCents: 199, symbol: 'US$' }
  }
  return { currency: 'cad', starterCents: 299, smallCents: 299, symbol: 'CA$' }
}

export function formatPrice(cents: number, symbol: 'CA$' | 'US$'): string {
  return `${symbol}${ (cents / 100).toFixed(2) }`
}

export const DEFENDERS = [
  { id: 'leo', name: 'Leo', ability: 'place' },
  { id: 'lupa', name: 'Lupa', ability: 'heart' },
  { id: 'aquila', name: 'Aquila', ability: 'light' },
  { id: 'nox', name: 'Nox', ability: 'rule' },
  { id: 'invictus', name: 'Invictus', ability: 'light6' },
] as const

export type Ability = (typeof DEFENDERS)[number]['ability']

export const CHARGE_LABEL: Record<Ability, { en: string; fr: string }> = {
  place: { en: 'Place one', fr: 'Placer un' },
  heart: { en: 'Keep going', fr: 'Continuer' },
  light: { en: 'Big light', fr: 'Grande lumière' },
  rule: { en: 'Rule out', fr: 'Écarter' },
  light6: { en: 'Light 6', fr: 'Lumière 6' },
}

/** Shop pets and clothing. Coin prices are intentionally unset. */
export const PETS = [
  { id: 'leo', name: 'Leo', free: true },
  { id: 'war-horse', name: 'War Horse', free: false },
  { id: 'night-owl', name: 'Night Owl', free: false },
  { id: 'eagle', name: 'Eagle', free: false },
] as const

export const CLOTHES = [
  { id: 'for-lupa', name: 'For Lupa', pet: 'lupa' },
  { id: 'for-aquila', name: 'For Aquila', pet: 'aquila' },
  { id: 'for-leo', name: 'For Leo', pet: 'leo' },
] as const

export const STARTER_PET = 'night-owl'
export const STARTER_CLOTH = 'for-lupa'
