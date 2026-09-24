/**
 * In-app purchases for App Store / Google Play.
 * Web: packs are display-only (App only). Native: purchaseCoinPack → store billing.
 */

import { HINT_COST, REVIVE_COST } from './rewards'

export type CoinPackId = 'coins_100' | 'coins_500' | 'coins_1200' | 'coins_3000'

export interface CoinPack {
  id: CoinPackId
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

/** Player-facing value math — e.g. "100 coins ≈ 6 hints or 3 revives" */
export function packValueBlurb(coins: number): string {
  const hints = Math.max(1, Math.floor(coins / HINT_COST))
  const revives = Math.max(1, Math.floor(coins / REVIVE_COST))
  return `${coins} coins ≈ ${hints} hints or ${revives} revives`
}

/** Cheapest pack that covers a coin shortfall (native shortfall CTA). */
export function cheapestPackForGap(gap: number): CoinPack {
  const sorted = [...COIN_PACKS].sort((a, b) => a.coins - b.coins)
  return sorted.find((p) => p.coins >= gap) ?? sorted[sorted.length - 1]!
}

function isNativeApp(): boolean {
  try {
    return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.()
  } catch {
    return false
  }
}

export function isStoreBuild(): boolean {
  return isNativeApp()
}

export async function purchaseCoinPack(packId: CoinPackId): Promise<PurchaseResult> {
  const pack = COIN_PACKS.find((p) => p.id === packId)
  if (!pack) return { ok: false, reason: 'Unknown pack' }

  if (!isNativeApp()) {
    return {
      ok: false,
      reason: 'Top-ups unlock in the App Store / Google Play app.',
    }
  }

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
