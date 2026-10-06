/**
 * Buddy Hunt bonus round: perfect wins fill a meter; a full meter opens a short
 * find-the-buddies round with a small prize. Pure logic (no DOM / storage) so it can be tested.
 */

/** Perfect wins needed to open Buddy Hunt. Change to 2 or 5 to tune. */
export const BUDDY_HUNT_PERFECT_WINS = 3
export const BUDDY_HUNT_GRID = 4
export const BUDDY_HUNT_BUDDIES = 3
export const BUDDY_HUNT_TAPS = 5

/** Coins for 1 / 2 / 3 buddies found. All three also win a bonus heart (or a free hint). */
export const BUDDY_HUNT_COINS: Readonly<Record<number, number>> = { 0: 0, 1: 8, 2: 15, 3: 15 }

export interface BuddyMeter {
  /** Filled notches toward the next hunt (0 .. BUDDY_HUNT_PERFECT_WINS-1 unless pending). */
  notches: number
  /** A full meter earned a hunt that hasn't been played yet. */
  pending: boolean
}

export const EMPTY_METER: BuddyMeter = { notches: 0, pending: false }

export interface WinRecord {
  hintsUsed: number
  /** A wrong buddy (even one a shield blocked), a rescue, or a revive on this attempt. */
  flawed: boolean
  livesLost: number
}

/** Perfect = no hints, no rescue, no wrong buddies, no hearts lost on this attempt. */
export function isPerfectWin(w: WinRecord): boolean {
  return w.hintsUsed === 0 && !w.flawed && w.livesLost <= 0
}

export function sanitizeMeter(raw: unknown, goal = BUDDY_HUNT_PERFECT_WINS): BuddyMeter {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BuddyMeter>
  const n = Number.isFinite(r.notches) ? Math.floor(r.notches as number) : 0
  return { notches: Math.max(0, Math.min(goal - 1, n)), pending: r.pending === true }
}

/**
 * Record a win. A perfect win fills one notch; a full meter resets to 0 and marks a hunt pending.
 * A non-perfect win changes nothing. While a hunt is still pending, perfect wins don't fill
 * notches (one bonus at a time).
 */
export function recordWin(
  meter: BuddyMeter,
  perfect: boolean,
  goal = BUDDY_HUNT_PERFECT_WINS,
): { meter: BuddyMeter; filledNow: boolean } {
  if (!perfect || meter.pending) return { meter, filledNow: false }
  const notches = meter.notches + 1
  if (notches >= goal) return { meter: { notches: 0, pending: true }, filledNow: true }
  return { meter: { notches, pending: false }, filledNow: false }
}

/** Opening the hunt spends it (a reload can't replay it). */
export function startHunt(meter: BuddyMeter): BuddyMeter {
  return { ...meter, pending: false }
}

/**
 * Spin prize. 9.30-j: it used to hide on every win while a hunt was pending, so a player who kept
 * tapping Next never saw the wheel again. Now it hides only on the win that just earned the hunt
 * (that win shows the big Buddy Hunt button); every other win with a spin in the wallet shows both.
 */
export function showSpinPrize(spins: number, _huntPending: boolean, huntJustEarned = false): boolean {
  return spins > 0 && !huntJustEarned
}

/** Pick the hidden buddy tiles. */
export function placeBuddies(rng: () => number = Math.random, grid = BUDDY_HUNT_GRID, count = BUDDY_HUNT_BUDDIES): number[] {
  const cells = Array.from({ length: grid * grid }, (_, i) => i)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return cells.slice(0, count).sort((a, b) => a - b)
}

export interface HuntWallet {
  coins: number
  freeHints: number
  bonusHearts?: number
}

export interface HuntPrize {
  coins: number
  freeHints: number
  bonusHearts: number
  label: string
}

/** Prize for `found` buddies. All three: a saved bonus heart unless that stash is full, then a free hint. */
export function huntPrize(found: number, wallet: HuntWallet, maxBonusHearts: number): HuntPrize {
  const f = Math.max(0, Math.min(BUDDY_HUNT_BUDDIES, Math.floor(found)))
  const coins = BUDDY_HUNT_COINS[f] ?? 0
  if (f === 0) return { coins: 0, freeHints: 0, bonusHearts: 0, label: 'No buddies this time — no prize.' }
  if (f < BUDDY_HUNT_BUDDIES) {
    return { coins, freeHints: 0, bonusHearts: 0, label: `+${coins} coins` }
  }
  const heart = (wallet.bonusHearts ?? 0) < maxBonusHearts
  return heart
    ? { coins, freeHints: 0, bonusHearts: 1, label: `+${coins} coins and a bonus heart for your next board!` }
    : { coins, freeHints: 1, bonusHearts: 0, label: `+${coins} coins and a free hint!` }
}

export function applyHuntPrize<W extends HuntWallet>(wallet: W, prize: HuntPrize): W {
  return {
    ...wallet,
    coins: wallet.coins + prize.coins,
    freeHints: wallet.freeHints + prize.freeHints,
    bonusHearts: (wallet.bonusHearts ?? 0) + prize.bonusHearts,
  }
}
