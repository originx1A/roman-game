/** Shared numbers. Pet and clothing coin prices stay unset. */

export const TERMS_VERSION = '2026-10-24'
export const BUILD_NUMBER = '2026.10.24.10'

/** Working cash-buying age. Quebec's 14 is not applied. Asked once, then only over/under is kept. */
export const CASH_AGE = 13

export const MAX_HEARTS = 3
export const RESET_MINUTES = 20
export const APPROVAL_DAYS = 7
export const REMINDER_DAYS = 3

export const SELLER = 'Funderwood'
export const SUPPORT_EMAIL = 'support@romansgame.com'

export type Sku = 'starter' | 'pack-small' | 'pack-medium' | 'pack-large'

/**
 * Tony's coin packs. CAD prices are the ones he set.
 * US$1.99 on the small pack was already in the code. Medium and large have no USD price.
 */
export const PACKS: {
  sku: 'pack-small' | 'pack-medium' | 'pack-large'
  coins: number
  cadCents: number
  usdCents: number | null
  tag: 'bonus7' | 'bonus15' | null
}[] = [
  { sku: 'pack-small', coins: 4000, cadCents: 299, usdCents: 199, tag: null },
  { sku: 'pack-medium', coins: 10000, cadCents: 699, usdCents: null, tag: 'bonus7' },
  { sku: 'pack-large', coins: 23000, cadCents: 1499, usdCents: null, tag: 'bonus15' },
]

export function isSku(value: unknown): value is Sku {
  return value === 'starter' || value === 'pack-small' || value === 'pack-medium' || value === 'pack-large'
}

export function priceForCountry(country: string | null | undefined): {
  currency: 'cad' | 'usd'
  starterCents: number
  smallCents: number
  mediumCents: number | null
  largeCents: number | null
  symbol: 'CA$' | 'US$'
} {
  const small = PACKS[0]
  const medium = PACKS[1]
  const large = PACKS[2]
  if ((country ?? '').toUpperCase() === 'US') {
    return {
      currency: 'usd',
      starterCents: 199,
      smallCents: 199,
      mediumCents: medium.usdCents,
      largeCents: large.usdCents,
      symbol: 'US$',
    }
  }
  return {
    currency: 'cad',
    starterCents: 299,
    smallCents: small.cadCents,
    mediumCents: medium.cadCents,
    largeCents: large.cadCents,
    symbol: 'CA$',
  }
}

export function centsForSku(
  sku: Sku,
  prices: { starterCents: number; smallCents: number; mediumCents: number | null; largeCents: number | null },
): number | null {
  if (sku === 'starter') return prices.starterCents
  if (sku === 'pack-small') return prices.smallCents
  if (sku === 'pack-medium') return prices.mediumCents
  return prices.largeCents
}

export function formatPrice(cents: number, symbol: 'CA$' | 'US$', lang: 'en' | 'fr' = 'en'): string {
  if (lang === 'fr') {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: symbol === 'US$' ? 'USD' : 'CAD',
    }).format(cents / 100)
  }
  return `${symbol}${ (cents / 100).toFixed(2) }`
}

/** Sheet 11: Lupa places one, Aquila is the big light, Leo keeps going, Invictus rules out, Nox lights 6. */
export const DEFENDERS = [
  { id: 'lupa', name: 'Lupa', ability: 'place' },
  { id: 'aquila', name: 'Aquila', ability: 'light' },
  { id: 'leo', name: 'Leo', ability: 'heart' },
  { id: 'invictus', name: 'Invictus', ability: 'rule' },
  { id: 'nox', name: 'Nox', ability: 'light6' },
] as const

export type Ability = (typeof DEFENDERS)[number]['ability']

export const CHARGE_LABEL: Record<Ability, { en: string; fr: string }> = {
  place: { en: 'Place one', fr: 'Placer un' },
  heart: { en: 'Keep going', fr: 'Continuer' },
  light: { en: 'Big light', fr: 'Grande lumière' },
  rule: { en: 'Rule out', fr: 'Écarter' },
  light6: { en: 'Light 6', fr: 'Lumière 6' },
}

/**
 * Starter Pack contents. 8,000 coins is Tony's master-spec amount.
 * The approved shop card draws an owl and a top hat: Night Owl, and For Lupa (the top hat).
 * Granted only after the pack is paid, and not set as the host pet.
 */
export const STARTER_COINS = 8000
export const STARTER_PET = 'night-owl'
export const STARTER_CLOTH = 'for-lupa'

export function formatCoins(amount: number, lang: 'en' | 'fr'): string {
  return amount.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
}

export function creditStarter<T extends { coins: number; pets: string[]; clothes: string[]; starterOwned: boolean }>(account: T): T {
  return {
    ...account,
    coins: account.coins + STARTER_COINS,
    pets: account.pets.includes(STARTER_PET) ? account.pets : [...account.pets, STARTER_PET],
    clothes: account.clothes.includes(STARTER_CLOTH) ? account.clothes : [...account.clothes, STARTER_CLOTH],
    starterOwned: true,
  }
}

/** Coin packs add only their coin amount. The exactly-once lock lives on the order, not here. */
export function creditCoins<T extends { coins: number }>(account: T, sku: string): T {
  const pack = PACKS.find((item) => item.sku === sku)
  if (!pack) return account
  return { ...account, coins: account.coins + pack.coins }
}

/** Shop pets besides the defenders. Leo is the defender, not a second pet. Coin prices stay unset. */
export const PETS = [
  { id: 'war-horse', name: 'War Horse', free: false },
  { id: 'night-owl', name: 'Night Owl', free: false },
  { id: 'eagle', name: 'Eagle', free: false },
] as const

export function petName(id: string | null | undefined): string | null {
  if (!id) return null
  return PETS.find((pet) => pet.id === id)?.name ?? DEFENDERS.find((pet) => pet.id === id)?.name ?? id
}

export const CLOTHES = [
  { id: 'for-lupa', name: 'For Lupa', pet: 'lupa' },
  { id: 'for-aquila', name: 'For Aquila', pet: 'aquila' },
  { id: 'for-leo', name: 'For Leo', pet: 'leo' },
] as const

