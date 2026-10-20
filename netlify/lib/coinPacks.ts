import { formatCad, SHOP_OFFERS, type ShopOfferId } from '../../src/game/shopOffers.ts'

/**
 * Website price list. Canadian dollars, proposed until Tony approves them.
 * Checkout reads this file, never a price the browser sends.
 * The native store list in iap.ts is unchanged.
 * Live Stripe keys are refused until Tony turns CHECKOUT_TEST_ONLY off.
 */
export const CHECKOUT_TEST_ONLY = true
export const WEB_CURRENCY = 'cad' as const

export interface WebCoinPack {
  id: ShopOfferId
  productId: string
  label: string
  coins: number
  treats: number
  pets: readonly string[]
  once: boolean
  currency: typeof WEB_CURRENCY
  unitAmount: number
  priceLabel: string
  contents: readonly string[]
}

export const WEB_COIN_PACKS: WebCoinPack[] = SHOP_OFFERS.map((offer) => ({
  id: offer.id,
  productId: offer.productId,
  label: offer.label,
  coins: offer.coins,
  treats: offer.treats,
  pets: offer.pets,
  once: offer.once,
  currency: WEB_CURRENCY,
  unitAmount: offer.cadCents,
  priceLabel: formatCad(offer.cadCents),
  contents: offer.contents,
}))

export function webPackById(id: string | undefined): WebCoinPack | undefined {
  if (!id) return undefined
  return WEB_COIN_PACKS.find((pack) => pack.id === id)
}

/** What the browser is allowed to see. No secret, and no amount the client can set. */
export function publicPackCatalog() {
  return WEB_COIN_PACKS.filter((pack) => pack.pets.length === 0).map((pack) => ({
    id: pack.id,
    productId: pack.productId,
    label: pack.label,
    coins: pack.coins,
    priceLabel: pack.priceLabel,
  }))
}
