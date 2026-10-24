/** Shared numbers. Pet and clothing coin prices stay unset. */

export const TERMS_VERSION = '2026-10-24'
export const BUILD_NUMBER = '2026.10.24.16'

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
/** The starter clothing is the top hat. */
export const STARTER_CLOTH = 'top-hat'

/** Approved coin economy, 2026-10-24. A local day is the Toronto calendar day. */
export const WIN_COINS = 100
export const WIN_COINS_AFTER = 25
export const DAILY_FULL_WINS = 10
export const DAILY_CLEAR_BONUS = 150
export const WEEK_WIN_BONUS = 500
export const WEEK_WIN_BONUS_AT = 20
export const BOARD_TOP10_COINS = 300
export const BOARD_TOP100_COINS = 100
export const CHARGE_COST = 150

export const DEFENDER_PRICE: Record<(typeof DEFENDERS)[number]['id'], number> = {
  lupa: 6000,
  nox: 8000,
  aquila: 10000,
  leo: 12000,
  invictus: 15000,
}

/**
 * Coins for one new win.
 * The first 10 wins of the local day pay 100. Later wins that day pay 25.
 * The first daily clear of that day adds 150. The 20th win of the week adds 500 once.
 */
export function coinsForWin(input: {
  winsTodayBefore: number
  dailyFirst: boolean
  winsThisWeekBefore: number
  weekBonusAlready: boolean
}): { coins: number; weekBonus: boolean } {
  const base = input.winsTodayBefore >= DAILY_FULL_WINS ? WIN_COINS_AFTER : WIN_COINS
  const daily = input.dailyFirst ? DAILY_CLEAR_BONUS : 0
  const weekBonus = !input.weekBonusAlready && input.winsThisWeekBefore + 1 >= WEEK_WIN_BONUS_AT
  return { coins: base + daily + (weekBonus ? WEEK_WIN_BONUS : 0), weekBonus: input.weekBonusAlready || weekBonus }
}

/** Weekly board prize. Ranks 1–10 get 300. Ranks 11–100 get 100. */
export function leaderboardPrize(rank: number): number {
  if (rank >= 1 && rank <= 10) return BOARD_TOP10_COINS
  if (rank >= 11 && rank <= 100) return BOARD_TOP100_COINS
  return 0
}

/** Same-site path for ?next=. Rejects protocol-relative and off-site values. */
export function sameSiteNext(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.includes('..') || value.includes('\\') || value.includes('://') || value.includes('\0')) return null
  if (!/^\/[A-Za-z0-9/_?.=&%-]*$/.test(value)) return null
  return value
}

/** Applying a coin delta. Null when the balance would go below zero. */
export function applyCoinDelta(balance: number, delta: number): number | null {
  if (!Number.isFinite(balance) || !Number.isFinite(delta)) return null
  const next = balance + delta
  if (next < 0) return null
  return next
}

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

/** Starter and older saves still know these pet ids. The shop sells the five defenders. */
export const PETS = [
  { id: 'leo', name: 'Leo', free: false },
  { id: 'war-horse', name: 'War Horse', free: false },
  { id: 'night-owl', name: 'Night Owl', free: false },
  { id: 'eagle', name: 'Eagle', free: false },
] as const

/** Laurel and Crown are earned. The other four are sold for coins. */
export const CLOTHES = [
  { id: 'top-hat', name: 'Top hat', price: 3000, earn: null },
  { id: 'sunglasses', name: 'Sunglasses', price: 3000, earn: null },
  { id: 'scarf', name: 'Scarf', price: 3000, earn: null },
  { id: 'badge', name: 'Badge', price: 4000, earn: null },
  { id: 'laurel', name: 'Laurel', price: null, earn: 'throne' },
  { id: 'crown', name: 'Crown', price: null, earn: 'streak' },
] as const

