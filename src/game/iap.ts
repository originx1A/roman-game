/**
 * In-app purchases for App Store / Google Play.
 * Website checkout lives in webCheckout.ts and is not used here.
 * Native: purchaseCoinPack → store billing.
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
  | { ok: true; pack: CoinPack; coins: number; /** Coins were already saved on device */ credited?: boolean }
  | { ok: false; reason: string }

type RomanIapBridge = {
  purchase: (productId: string) => Promise<boolean | PurchaseResult>
  restore?: () => Promise<{ ok: boolean; message: string }>
}

/** Events from the native store: a finished purchase, or localized prices. */
export type StoreNotice =
  | { type: 'granted'; coins: number; label: string }
  | { type: 'prices'; prices: Record<string, string> }

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
      reason: 'Purchases are unavailable right now.',
    }
  }

  try {
    const { ensureStore } = await import('./iap-native')
    await ensureStore()
    const bridge = (window as unknown as { RomanIAP?: RomanIapBridge }).RomanIAP
    if (bridge?.purchase) {
      const paid = await bridge.purchase(pack.productId)
      if (typeof paid === 'boolean') {
        if (!paid) return { ok: false, reason: 'Purchase cancelled' }
        return { ok: true, pack, coins: pack.coins, credited: false }
      }
      return paid
    }
  } catch {
    return { ok: false, reason: "Purchase didn't go through. No coins were added." }
  }

  return {
    ok: false,
    reason: 'Store billing not connected yet. Finish App Store / Play Console IAP setup.',
  }
}

/** Replay an unfinished store payment. Consumable packs that already finished are not returned. */
export async function restorePurchases(): Promise<{ ok: boolean; message: string }> {
  if (!isNativeApp()) {
    return { ok: false, message: 'Restore is available in the App Store / Google Play app.' }
  }
  try {
    const { restoreNative } = await import('./iap-native')
    return await restoreNative()
  } catch {
    return { ok: false, message: "Couldn't reach the store. Nothing was changed." }
  }
}

export function subscribeStore(listener: (notice: StoreNotice) => void): () => void {
  if (!isNativeApp()) return () => {}
  let stop = () => {}
  let cancelled = false
  void import('./iap-native').then((mod) => {
    if (cancelled) return
    stop = mod.subscribeIap(listener)
    void mod.ensureStore()
  })
  return () => {
    cancelled = true
    stop()
  }
}
