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
}

export const TREASURE_COIN_CHOICES = [6, 8, 10, 12, 15] as const
export const TREASURE_HINT_CHANCE = 0.3
export const TREASURE_SPIN_CHANCE = 0.1
/** every parade has this many drops (one per marching buddy, up to this many) */
export const TREASURE_DROPS = 4

export function treasureLabel(t: Treasure): string {
  return t.kind === 'coins' ? `+${t.amount}` : t.kind === 'hint' ? '+1 hint' : '+1 spin'
}
export function treasureIcon(t: Treasure): string {
  return t.kind === 'coins' ? '🪙' : t.kind === 'hint' ? '💡' : '🎡'
}

/** Drops for one parade: `slots` marching buddies each carry one (max 4). Index-aligned with the buddies. */
export function makeTreasure(slots: number, rand: () => number = Math.random): Treasure[] {
  const n = Math.max(0, Math.min(TREASURE_DROPS, Math.floor(slots)))
  const out: Treasure[] = []
  let hint = false
  let spin = false
  for (let i = 0; i < n; i++) {
    const r = rand()
    if (!spin && r < TREASURE_SPIN_CHANCE / 2) {
      // a spin is rare: about one parade in ten (the chance is spread over the drops)
      spin = true
      out.push({ kind: 'spin', amount: 0 })
    } else if (!hint && rand() < TREASURE_HINT_CHANCE / 2) {
      hint = true
      out.push({ kind: 'hint', amount: 0 })
    } else {
      out.push({ kind: 'coins', amount: TREASURE_COIN_CHOICES[Math.min(TREASURE_COIN_CHOICES.length - 1, Math.floor(rand() * TREASURE_COIN_CHOICES.length))] })
    }
  }
  return out
}

/** Coin-equivalent worth of a drop (for sizing): a hint is 15, a spin about 38 */
export function treasureValue(t: Treasure): number {
  return t.kind === 'coins' ? t.amount : t.kind === 'hint' ? 15 : 38
}

/** 9.30-s: once the 3 treasure parades of the day are used, every buddy still pays this many coins per tap (small, but never nothing) */
export const CAPPED_TAP_COINS = 2
export function makeCappedTreasure(slots: number): Treasure[] {
  const n = Math.max(0, Math.min(TREASURE_DROPS, Math.floor(slots)))
  return Array.from({ length: n }, () => ({ kind: 'coins' as const, amount: CAPPED_TAP_COINS }))
}
