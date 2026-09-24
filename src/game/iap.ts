/**
 * In-app purchases for App Store / Google Play builds.
 * Web builds keep the shop UI but do not charge; coins still unlock via play.
 */

export type CoinPackId = 'coins_100' | 'coins_550' | 'coins_1200'

export type CoinPack = {
  id: CoinPackId
  label: string
  coins: number
  /** Store product id — wire to RevenueCat / StoreKit / Play Billing */
  productId: string
  /** Display-only hint; real price comes from the store */
  priceHint: string
}

export const COIN_PACKS: CoinPack[] = [
  { id: 'coins_100', label: 'Starter', coins: 100, productId: 'roman_coins_100', priceHint: 'Store price' },
  { id: 'coins_550', label: 'Popular', coins: 550, productId: 'roman_coins_550', priceHint: 'Best value' },
  { id: 'coins_1200', label: 'Vault', coins: 1200, productId: 'roman_coins_1200', priceHint: 'Biggest stack' },
]

export function packValueBlurb(pack: CoinPack): string {
  if (pack.id === 'coins_550') return 'Best value · most players pick this'
  if (pack.id === 'coins_1200') return 'Biggest stack · fewer store trips'
  return 'Quick top-up for a hint or two'
}

/** True when the binary is a store build (Capacitor / native shell). */
export function isStoreBuild(): boolean {
  try {
    const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
    return !!w.Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

export type PurchaseResult =
  | { ok: true; coins: number; pack: CoinPack }
  | { ok: false; reason: string }

/**
 * Purchase a coin pack.
 * Native: replace the body with StoreKit 2 / Play Billing / RevenueCat.
 * Web: returns a clear message — no fake coins from a pretend checkout.
 */
export async function purchaseCoinPack(packId: CoinPackId): Promise<PurchaseResult> {
  const pack = COIN_PACKS.find((p) => p.id === packId)
  if (!pack) return { ok: false, reason: 'Unknown pack' }

  if (!isStoreBuild()) {
    return {
      ok: false,
      reason: 'Coin packs unlock in the App Store / Google Play app. On web, win boards for free coins.',
    }
  }

  // Native stub — integrate billing SDK here.
  // Example: await Purchases.purchaseProduct(pack.productId)
  return {
    ok: false,
    reason: `Store billing not wired yet for ${pack.productId}. Connect RevenueCat / StoreKit to enable.`,
  }
}
