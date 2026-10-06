/**
 * Parade treasure (9.30-l). A few small drops ride along with the marching buddies: coins, a free
 * hint, or (rarely) a spin token. Tap the buddy carrying one to catch it. Skipping the parade, or
 * letting it march off, forfeits whatever wasn't caught. Sized small against the economy
 * (about 4% of a normal day's coins per parade); one hint and one spin at most per parade.
 */
export type TreasureKind = 'coins' | 'hint' | 'spin'
export interface Treasure {
  kind: TreasureKind
  /** coins only */
  amount: number
  /** 9.30-t: the small +2 tap prize after the pot is empty (not taken from the pot) */
  fallback?: boolean
}

export const TREASURE_COIN_CHOICES = [6, 8, 10, 12, 15] as const
export const TREASURE_HINT_CHANCE = 0.3
export const TREASURE_SPIN_CHANCE = 0.1
/** every parade has this many drops (one per marching buddy, up to this many) */
export const TREASURE_DROPS = 5

export function treasureLabel(t: Treasure): string {
  return t.kind === 'coins' ? `+${t.amount}` : t.kind === 'hint' ? '+1 hint' : '+1 spin'
}
export function treasureIcon(t: Treasure): string {
  return t.kind === 'coins' ? '🪙' : t.kind === 'hint' ? '💡' : '🎡'
}

/** Drops for one parade (9.30-t): one per marching buddy (3-5), sized to `budget` coin-worth taken from the daily pot.
 *  Mostly coins; a hint (about 1 parade in 4) or a spin (rare, only in a big first parade) may replace a coin.
 *  Every coin drop is at least 3, so a later parade is smaller but never empty. Index-aligned with the buddies. */
export const TREASURE_MIN_COIN = 3
export function makeTreasure(slots: number, rand: () => number = Math.random, budget = 50, allowSpin = true): Treasure[] {
  const n = Math.max(0, Math.min(TREASURE_DROPS, Math.floor(slots)))
  if (n === 0) return []
  let left = Math.max(n * TREASURE_MIN_COIN, Math.floor(budget))
  const kinds: ('coins' | 'hint' | 'spin')[] = Array.from({ length: n }, () => 'coins')
  const put = (k: 'hint' | 'spin', value: number) => {
    // keep at least 3 coins for every other buddy
    if (left - value < (n - 1 - kinds.filter((x) => x !== 'coins').length) * TREASURE_MIN_COIN) return
    const free = kinds.map((x, i) => (x === 'coins' ? i : -1)).filter((i) => i >= 0)
    if (free.length <= 1) return
    kinds[free[Math.floor(rand() * free.length)]] = k
    left -= value
  }
  if (allowSpin && budget >= 45 && rand() < 0.08) put('spin', 38)
  else if (budget >= 25 && rand() < 0.25) put('hint', 15)
  const coinIdx = kinds.map((x, i) => (x === 'coins' ? i : -1)).filter((i) => i >= 0)
  const w = coinIdx.map(() => 0.7 + 0.6 * rand())
  const wsum = w.reduce((a, b) => a + b, 0)
  const amt = w.map((x) => Math.max(TREASURE_MIN_COIN, Math.round((left * x) / wsum)))
  // never pay more than the budget: trim the biggest drops back toward 3
  let over = amt.reduce((a, b) => a + b, 0) - left
  while (over > 0) {
    let j = 0
    for (let k = 1; k < amt.length; k++) if (amt[k] > amt[j]) j = k
    if (amt[j] <= TREASURE_MIN_COIN) break
    amt[j]--
    over--
  }
  return kinds.map((k, i) => (k === 'coins' ? { kind: 'coins' as const, amount: amt[coinIdx.indexOf(i)] } : { kind: k, amount: 0 }))
}

/** Coin-equivalent worth of a drop (for sizing): a hint is 15, a spin about 38 */
export function treasureValue(t: Treasure): number {
  return t.kind === 'coins' ? t.amount : t.kind === 'hint' ? 15 : 38
}

/** 9.30-s: once the 3 treasure parades of the day are used, every buddy still pays this many coins per tap (small, but never nothing) */
export const CAPPED_TAP_COINS = 2
export function makeCappedTreasure(slots: number): Treasure[] {
  const n = Math.max(0, Math.min(TREASURE_DROPS, Math.floor(slots)))
  return Array.from({ length: n }, () => ({ kind: 'coins' as const, amount: CAPPED_TAP_COINS, fallback: true }))
}
