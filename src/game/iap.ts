/**
 * In-app purchases for App Store / Google Play.
 *
 * Pricing: YOU pick a store price tier in App Store Connect / Play Console.
 * The store shows that price to the player and takes their cut (~15–30%).
 * The game never charges a credit card itself — it only requests a product ID.
 */

import { HINT_COST, REVIVE_COST } from './rewards'

export type CoinPackId = 'coins_100' | 'coins_500' | 'coins_1200' | 'coins_3000'

/** Player-facing value math so packs read as products, not bare price chips. */
export function packValueBlurb(coins: number): string {
  const hints = Math.max(1, Math.floor(coins / HINT_COST))
  const revives = Math.max(1, Math.floor(coins / REVIVE_COST))
  return `${coins} coins ≈ ${hints} hints or ${revives} revives`
}

export interface CoinPack {
  id: CoinPackId
  /** Store product id — must match App Store Connect / Play Console */
  productId: string
  label: string
  coins: number
  /** Display hint only — real price comes from the store */
  priceHint: string
}

export const COIN_PACKS: CoinPack[] = [
  {
    id: 'coins_100',
    productId: 'roman.coins.100',
    label: 'Coin Pouch',
    coins: 100,
    priceHint: '≈ $0.99',
  },
  {
    id: 'coins_500',
    productId: 'roman.coins.500',
    label: 'Coin Bag',
    coins: 500,
    priceHint: '≈ $4.99',
  },
  {
    id: 'coins_1200',
    productId: 'roman.coins.1200',
    label: 'Coin Chest',
    coins: 1200,
    priceHint: '≈ $9.99',
  },
  {
    id: 'coins_3000',
    productId: 'roman.coins.3000',
    label: 'Coin Vault',
    coins: 3000,
    priceHint: '≈ $19.99',
  },
]

export type PurchaseResult =
  | { ok: true; pack: CoinPack; coins: number }
  | { ok: false; reason: string }

function isNativeApp(): boolean {
  try {
    return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.()
  } catch {
    return false
  }
}

/**
 * Buy a coin pack. On native builds this will call StoreKit / Play Billing
 * once @capacitor-community/in-app-purchases (or RevenueCat) is wired.
 * On web it explains that real-money buys happen in the app stores.
 */
export async function purchaseCoinPack(packId: CoinPackId): Promise<PurchaseResult> {
  const pack = COIN_PACKS.find((p) => p.id === packId)
  if (!pack) return { ok: false, reason: 'Unknown pack' }

  if (!isNativeApp()) {
    return {
      ok: false,
      reason:
        'Real-money coin packs unlock in the App Store / Google Play app. Play for free coins, or install the store build when it’s live.',
    }
  }

  // Native hook point — replace with Capacitor IAP / RevenueCat when shipping stores
  try {
    const bridge = (window as unknown as { RomanIAP?: { purchase: (id: string) => Promise<boolean> } })
      .RomanIAP
    if (bridge?.purchase) {
      const paid = await bridge.purchase(pack.productId)
      if (!paid) return { ok: false, reason: 'Purchase cancelled' }
      return { ok: true, pack, coins: pack.coins }
    }
  } catch {
    /* fall through */
  }

  return {
    ok: false,
    reason: 'Store billing not connected yet. Finish App Store / Play Console IAP setup.',
  }
}

export function isStoreBuild(): boolean {
  return isNativeApp()
}
