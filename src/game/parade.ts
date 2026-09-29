/**
 * Buddy Parade scheduler (9.30-j). Every 5-7 wins (a random number each cycle) the next
 * "Next board" tap shows a short parade first. Pure: state in, state out. App keeps it in
 * localStorage. Because a cycle needs at least 5 wins, two parades never come back to back.
 */
export const PARADE_MIN_WINS = 5
export const PARADE_MAX_WINS = 7
export const PARADE_MIN_MS = 5000
export const PARADE_MAX_MS = 10000
export const PARADE_KEY = 'roman.parade.v1'

export interface ParadeState {
  /** wins since the last parade */
  wins: number
  /** this cycle's length (5-7) */
  every: number
  /** the parade is owed: show it at the next "Next board" */
  due: boolean
}

export function pickEvery(rand: () => number = Math.random): number {
  return PARADE_MIN_WINS + Math.min(PARADE_MAX_WINS - PARADE_MIN_WINS, Math.floor(rand() * (PARADE_MAX_WINS - PARADE_MIN_WINS + 1)))
}

export function newParade(rand: () => number = Math.random): ParadeState {
  return { wins: 0, every: pickEvery(rand), due: false }
}

export function sanitizeParade(raw: unknown, rand: () => number = Math.random): ParadeState {
  const r = (raw && typeof raw === 'object' ? raw : null) as Partial<ParadeState> | null
  if (!r) return newParade(rand)
  const every = Number.isFinite(r.every) ? Math.round(r.every as number) : NaN
  if (!(every >= PARADE_MIN_WINS && every <= PARADE_MAX_WINS)) return newParade(rand)
  const wins = Number.isFinite(r.wins) ? Math.max(0, Math.min(every, Math.floor(r.wins as number))) : 0
  return { wins, every, due: r.due === true && wins >= every }
}

/** A win was scored. `due` flips on when this cycle's count is reached. */
export function paradeWin(s: ParadeState): ParadeState {
  if (s.due) return s
  const wins = s.wins + 1
  return { ...s, wins, due: wins >= s.every }
}

/** The parade was shown, skipped or switched off: start a new cycle. */
export function paradeDone(_s: ParadeState, rand: () => number = Math.random): ParadeState {
  return newParade(rand)
}

/** 5-10 s */
export function paradeLengthMs(rand: () => number = Math.random): number {
  return Math.round(PARADE_MIN_MS + rand() * (PARADE_MAX_MS - PARADE_MIN_MS))
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
