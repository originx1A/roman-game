/**
 * 9.30-j: the spark critter's visit clock. It used to restart on every board, so once boards were
 * solved faster than ~35-70 s the critter never showed up (no catches, no spins, no wheel).
 * Now play time adds up across boards (and reloads); the first visit is at 20-35 s of total play,
 * then one every 30-50 s. Pure, so it can be tested and simulated.
 */
export interface CritterClock {
  /** total ms of play counted so far */
  played: number
  /** play time (ms) at which the next visit is due */
  nextAt: number
}

export const CRITTER_FIRST_MS = [25000, 40000] as const
export const CRITTER_GAP_MS = [45000, 75000] as const
/** never appear in the first seconds of a board */
export const CRITTER_BOARD_GRACE_MS = 3000
/** one tick never counts more than this (a paused tab or a slow timer can't fast-forward the clock) */
export const CRITTER_TICK_CAP_MS = 2000

const span = (r: readonly [number, number], rand: () => number) => r[0] + rand() * (r[1] - r[0])

export function newCritterClock(rand: () => number = Math.random): CritterClock {
  return { played: 0, nextAt: span(CRITTER_FIRST_MS, rand) }
}

/** Count `dtMs` of play. `boardMs` = how long this board has been running. spawn = show the critter now. */
export function tickCritterClock(
  c: CritterClock,
  dtMs: number,
  boardMs: number,
  rand: () => number = Math.random,
): { clock: CritterClock; spawn: boolean } {
  const played = c.played + Math.max(0, Math.min(dtMs, CRITTER_TICK_CAP_MS))
  if (played >= c.nextAt && boardMs >= CRITTER_BOARD_GRACE_MS) {
    return { clock: { played, nextAt: played + span(CRITTER_GAP_MS, rand) }, spawn: true }
  }
  return { clock: { played, nextAt: c.nextAt }, spawn: false }
}

export const CRITTER_CLOCK_KEY = 'roman.critterclock.v1'

export function loadCritterClock(store: Pick<Storage, 'getItem'> | null, rand: () => number = Math.random): CritterClock {
  try {
    const raw = store?.getItem(CRITTER_CLOCK_KEY)
    if (raw) {
      const j = JSON.parse(raw) as Partial<CritterClock>
      if (typeof j.played === 'number' && typeof j.nextAt === 'number' && Number.isFinite(j.played) && Number.isFinite(j.nextAt) && j.played >= 0) {
        return { played: j.played, nextAt: j.nextAt }
      }
    }
  } catch {
    /* fall through to a fresh clock */
  }
  return newCritterClock(rand)
}

export function saveCritterClock(store: Pick<Storage, 'setItem'> | null, c: CritterClock): void {
  try {
    store?.setItem(CRITTER_CLOCK_KEY, JSON.stringify(c))
  } catch {
    /* storage can be full or blocked; the clock just restarts next time */
  }
}
