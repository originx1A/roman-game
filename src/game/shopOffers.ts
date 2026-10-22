/**
 * Website shop prices. Canadian dollars, in cents.
 * Approved. Checkout still refuses a live Stripe key until test-only mode is turned off.
 * The native store list in iap.ts is unchanged.
 *
 * Savings use the Large pack rate (C$9.99 / 3,200 coins) for buddies and treats,
 * and the Small pack rate when a bigger coin pack beats buying Small packs.
 * Buddy coin prices: Lupa 3,600, Aquila 6,000. A snack is 30 coins.
 */

export const SHOP_CURRENCY = 'cad' as const

/** First, second, and third-or-later Starter price. Contents do not change. */
export const STARTER_PRICE_CENTS = {
  cad: [299, 349, 449],
  usd: [149, 199, 249],
} as const

export type StarterCurrency = keyof typeof STARTER_PRICE_CENTS

/** How many Starters this account already has. The third price stays for every later one. */
export function starterPriceCents(currency: StarterCurrency, alreadyReceived: number): number {
  const steps = STARTER_PRICE_CENTS[currency]
  const index = Math.min(steps.length - 1, Math.max(0, Math.floor(alreadyReceived)))
  return steps[index]
}

export function formatStarterLadder(currency: StarterCurrency): string {
  const [first, second, later] = STARTER_PRICE_CENTS[currency]
  const symbol = currency === 'cad' ? 'C$' : 'US$'
  const money = (cents: number) => `${symbol}${(cents / 100).toFixed(2)}`
  return `${money(first)} first, ${money(second)} second, ${money(later)} after`
}

/** A Starter charge is legal at any of the three steps. Other packs stay on their one price. */
export function chargeMatchesPack(
  pack: { id: string; currency: string; unitAmount: number },
  currency: string | null | undefined,
  amount: number | null | undefined,
): boolean {
  const cur = (currency ?? '').toLowerCase()
  if (pack.id === 'starter') {
    if (cur !== 'cad' && cur !== 'usd') return false
    return typeof amount === 'number' && (STARTER_PRICE_CENTS[cur] as readonly number[]).includes(amount)
  }
  return cur === pack.currency && amount === pack.unitAmount
}

export type ShopOfferId =
  | 'coins_500'
  | 'coins_1400'
  | 'coins_3200'
  | 'starter'
  | 'adventurer'
  | 'stable'

export interface ShopOffer {
  id: ShopOfferId
  productId: string
  label: string
  /** Short ribbon. Empty when the card has no badge. */
  badge: string
  /** Quantity stays one. A Starter may still be bought again. */
  once: boolean
  coins: number
  treats: number
  /** Pet ids included. `random-common` and `premium-choice` are resolved after payment. */
  pets: readonly string[]
  cadCents: number
  contents: readonly string[]
  /** What the same contents cost at the coin-pack rate, in CAD cents. */
  separateCadCents: number
}

export const SHOP_OFFERS: readonly ShopOffer[] = [
  {
    id: 'coins_500',
    productId: 'roman.cad.coins.500',
    label: 'Small',
    badge: '',
    once: false,
    coins: 500,
    treats: 0,
    pets: [],
    cadCents: 199,
    contents: ['500 coins'],
    separateCadCents: 199,
  },
  {
    id: 'coins_1400',
    productId: 'roman.cad.coins.1400',
    label: 'Medium',
    badge: '',
    once: false,
    coins: 1400,
    treats: 0,
    pets: [],
    cadCents: 499,
    contents: ['1,400 coins'],
    separateCadCents: 558,
  },
  {
    id: 'coins_3200',
    productId: 'roman.cad.coins.3200',
    label: 'Large',
    badge: '',
    once: false,
    coins: 3200,
    treats: 0,
    pets: [],
    cadCents: 999,
    contents: ['3,200 coins'],
    separateCadCents: 1274,
  },
  {
    id: 'starter',
    productId: 'roman.cad.bundle.starter',
    label: 'Starter Pack',
    badge: 'Best first buy',
    once: false,
    coins: 8000,
    treats: 5,
    pets: [],
    cadCents: 299,
    contents: ['8,000 coins', '5 treats'],
    separateCadCents: 2544,
  },
  {
    id: 'adventurer',
    productId: 'roman.cad.bundle.adventurer',
    label: 'Adventurer Bundle',
    badge: '',
    once: false,
    coins: 1000,
    treats: 30,
    pets: ['random-common'],
    cadCents: 699,
    contents: ['1,000 coins', '30 treats', '1 random common buddy'],
    separateCadCents: 1717,
  },
  {
    id: 'stable',
    productId: 'roman.cad.bundle.stable',
    label: 'Stable Bundle',
    badge: 'Best value',
    once: false,
    coins: 2500,
    treats: 75,
    pets: ['premium-choice'],
    cadCents: 1499,
    contents: ['1 premium buddy of your choice', '2,500 coins', '75 treats'],
    separateCadCents: 3272,
  },
]

export function shopOfferById(id: string | undefined): ShopOffer | undefined {
  if (!id) return undefined
  return SHOP_OFFERS.find((offer) => offer.id === id)
}

export function formatCad(cents: number): string {
  return `C$${(cents / 100).toFixed(2)}`
}

export function savingsCents(offer: ShopOffer): number {
  return Math.max(0, offer.separateCadCents - offer.cadCents)
}

export const SUPPORT_ADDRESS = 'Funderwood, 6-2160 Highway 7, Suite 639, Vaughan, ON L4K 1W6, Canada'
export const SUPPORT_EMAIL = 'support@romansgame.com'
