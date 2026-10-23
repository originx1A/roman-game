/**
 * Buddy Parade scheduler (9.30-j). Every 8-9 wins AND at least 20-30 minutes after the last one (whichever
 * is later, 9.30-t) the next "Next board" tap shows a short parade first. Pure: state in, state out. App keeps it in
 * localStorage. Two parades never come back to back.
 */
export const PARADE_MIN_WINS = 8
export const PARADE_MAX_WINS = 9
/** 9.30-t: and at least 20-30 minutes since the last parade (a random gap each cycle): whichever comes later */
export const PARADE_MIN_GAP_MS = 20 * 60000
export const PARADE_MAX_GAP_MS = 30 * 60000
/** Each buddy crosses the screen in this range (9.32-k). The old 12–16s march was too slow to watch. */
export const PARADE_CROSS_MIN_MS = 1500
export const PARADE_CROSS_MAX_MS = 2500
/** Short gap between one buddy starting and the next. */
export const PARADE_GAP_MIN_MS = 260
export const PARADE_GAP_MAX_MS = 420
/** Beat after the last buddy leaves, before the summary. The whole parade stays under 10s. */
export const PARADE_TAIL_MS = 400
export const PARADE_MAX_MS = 9000
export const PARADE_KEY = 'roman.parade.v1'

export interface BuddyMarch {
  /** How long this buddy takes to cross, 1.5–2.5s */
  crossMs: number
  /** When this buddy starts, after the parade opens */
  delayMs: number
  /** Slight vertical bob, in px, so a tap is not a flat glide */
  bobPx: number
  bobMs: number
}

export interface ParadeState {
  /** wins since the last parade */
  wins: number
  /** this cycle's length (8-9 wins) */
  every: number
  /** the win count is reached (the parade also needs the gap below to pass) */
  due: boolean
  /** when the last parade was shown (ms since 1970; 0 = never) */
  lastAt: number
  /** this cycle's minimum gap since lastAt (20-30 min) */
  gapMs: number
}

export function pickEvery(rand: () => number = Math.random): number {
  return PARADE_MIN_WINS + Math.min(PARADE_MAX_WINS - PARADE_MIN_WINS, Math.floor(rand() * (PARADE_MAX_WINS - PARADE_MIN_WINS + 1)))
}
export function pickGapMs(rand: () => number = Math.random): number {
  return Math.round(PARADE_MIN_GAP_MS + rand() * (PARADE_MAX_GAP_MS - PARADE_MIN_GAP_MS))
}

export function newParade(rand: () => number = Math.random, lastAt = 0): ParadeState {
  return { wins: 0, every: pickEvery(rand), due: false, lastAt, gapMs: pickGapMs(rand) }
}

export function sanitizeParade(raw: unknown, rand: () => number = Math.random, now = Date.now()): ParadeState {
  const r = (raw && typeof raw === 'object' ? raw : null) as Partial<ParadeState> | null
  if (!r) return newParade(rand)
  const oldEvery = Number.isFinite(r.every) ? Math.round(r.every as number) : NaN
  const ok = oldEvery >= PARADE_MIN_WINS && oldEvery <= PARADE_MAX_WINS
  // an older build's 5-7 win cycle becomes a fresh 8-9 cycle; the wins already counted are kept
  const every = ok ? oldEvery : pickEvery(rand)
  const wins = Number.isFinite(r.wins) ? Math.max(0, Math.min(every, Math.floor(r.wins as number))) : 0
  const lastAt = Number.isFinite(r.lastAt) ? Math.max(0, Math.min(now, Math.floor(r.lastAt as number))) : 0
  const gap = Number.isFinite(r.gapMs) ? Math.round(r.gapMs as number) : NaN
  const gapMs = gap >= PARADE_MIN_GAP_MS && gap <= PARADE_MAX_GAP_MS ? gap : (Number.isFinite(gap) && gap >= 0 && gap < PARADE_MIN_GAP_MS ? gap : pickGapMs(rand))
  return { wins, every, due: ok ? r.due === true && wins >= every : wins >= every, lastAt, gapMs }
}

/** A win was scored. `due` flips on when this cycle's count is reached. */
export function paradeWin(s: ParadeState): ParadeState {
  if (s.due) return s
  const wins = s.wins + 1
  return { ...s, wins, due: wins >= s.every }
}

/** Show the parade now? Only when the win count is reached AND the gap since the last parade has passed. */
export function paradeReady(s: ParadeState, now = Date.now()): boolean {
  return s.due && now - s.lastAt >= s.gapMs
}

/** The parade was shown, skipped or switched off: start a new cycle (the gap counts from `now`). */
export function paradeDone(_s: ParadeState, rand: () => number = Math.random, now = Date.now()): ParadeState {
  return newParade(rand, now)
}

/** "Next parade: 3 more wins" / "Next parade: in about 12 min" / ready */
export function paradeHint(s: ParadeState, now = Date.now()): { winsLeft: number; minLeft: number; ready: boolean; text: string } {
  const winsLeft = Math.max(0, s.every - s.wins)
  const minLeft = Math.max(0, Math.ceil((s.lastAt + s.gapMs - now) / 60000))
  const ready = winsLeft === 0 && minLeft === 0
  const text = ready
    ? 'Next parade: right after your next board!'
    : winsLeft > 0
      ? `Next parade: ${winsLeft} more win${winsLeft === 1 ? '' : 's'}`
      : `Next parade: in about ${minLeft} min`
  return { winsLeft, minLeft, ready, text }
}

/**
 * One crossing per buddy, each 1.5–2.5s, with a short stagger. A huge roster squeezes the gaps
 * so the last buddy is gone before 9s; the crossing speed itself stays in range.
 */
export function paradeMarch(count: number, rand: () => number = Math.random): BuddyMarch[] {
  const n = Math.max(1, Math.min(24, Math.floor(count) || 1))
  const buddies: BuddyMarch[] = []
  let delay = 0
  for (let i = 0; i < n; i++) {
    const crossMs = Math.round(PARADE_CROSS_MIN_MS + rand() * (PARADE_CROSS_MAX_MS - PARADE_CROSS_MIN_MS))
    buddies.push({
      crossMs,
      delayMs: Math.round(delay),
      bobPx: Math.round(8 + rand() * 8),
      bobMs: Math.round(380 + rand() * 320),
    })
    if (i < n - 1) delay += PARADE_GAP_MIN_MS + rand() * (PARADE_GAP_MAX_MS - PARADE_GAP_MIN_MS)
  }
  const end = buddies.reduce((m, b) => Math.max(m, b.delayMs + b.crossMs), 0)
  const cap = PARADE_MAX_MS - PARADE_TAIL_MS
  const lastDelay = buddies[n - 1].delayMs
  if (end > cap && lastDelay > 0) {
    const slowest = buddies.reduce((m, b) => Math.max(m, b.crossMs), 0)
    const scale = Math.max(0, cap - slowest) / lastDelay
    for (const b of buddies) b.delayMs = Math.round(b.delayMs * scale)
  }
  return buddies
}

/** How long the overlay stays up: last buddy off the screen, plus a short beat, always under 10s. */
export function paradeSpanMs(march: BuddyMarch[]): number {
  const end = march.reduce((m, b) => Math.max(m, b.delayMs + b.crossMs), 0)
  return Math.min(PARADE_MAX_MS, end + PARADE_TAIL_MS)
}

/** Parade length for a roster of `count` buddies (5 when the caller does not know yet). */
export function paradeLengthMs(rand: () => number = Math.random, count = 5): number {
  return paradeSpanMs(paradeMarch(count, rand))
}

export function loadParade(store: Pick<Storage, 'getItem'> | null): ParadeState {
  try {
    const raw = store?.getItem(PARADE_KEY)
    return sanitizeParade(raw ? JSON.parse(raw) : null)
  } catch {
    return newParade()
  }
}

export function saveParade(store: Pick<Storage, 'setItem'> | null, s: ParadeState): void {
  try {
    store?.setItem(PARADE_KEY, JSON.stringify(s))
  } catch {
    /* blocked or full: the counter just restarts */
  }
}
