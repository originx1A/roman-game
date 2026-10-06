import { COIN_PACKS, type CoinPackId } from '../../src/game/iap.ts'

/**
 * Web price list. Coin counts, names, and product ids come from the store packs.
 * The $0.99 pouch is left out: Stripe's fixed fee would eat it.
 * Amounts are US cents. Checkout and coin grants read this file, never the browser.
 */
const WEB_UNIT_AMOUNT: Partial<Record<CoinPackId, number>> = {
  coins_500: 499,
  coins_1200: 999,
  coins_3000: 1999,
}

export const WEB_CURRENCY = 'usd'

export interface WebCoinPack {
  id: CoinPackId
  productId: string
  label: string
  coins: number
  currency: typeof WEB_CURRENCY
  unitAmount: number
  priceLabel: string
}

function usdLabel(cents: number): string {
  return `US$${(cents / 100).toFixed(2)}`
}

export const WEB_COIN_PACKS: WebCoinPack[] = COIN_PACKS.flatMap((pack) => {
  const unitAmount = WEB_UNIT_AMOUNT[pack.id]
  if (unitAmount == null || unitAmount < 299) return []
  return [
    {
      id: pack.id,
      productId: pack.productId,
      label: pack.label,
      coins: pack.coins,
      currency: WEB_CURRENCY,
      unitAmount,
      priceLabel: usdLabel(unitAmount),
    },
  ]
})

export function webPackById(id: string | undefined): WebCoinPack | undefined {
  if (!id) return undefined
  return WEB_COIN_PACKS.find((pack) => pack.id === id)
}

/** What the browser is allowed to see. No secret, and no amount the client can set. */
export function publicPackCatalog() {
  return WEB_COIN_PACKS.map((pack) => ({
    id: pack.id,
    productId: pack.productId,
    label: pack.label,
    coins: pack.coins,
    priceLabel: pack.priceLabel,
  }))
}
