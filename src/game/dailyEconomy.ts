/**
 * Daily earn limits (9.30-m economy audit). Nothing here takes coins away or makes the game harder:
 * it only tapers what a busy day pays, so a free-play account can't buy every buddy in days by
 * replaying easy boards or camping on sparks. A normal day (about 5 wins) is paid in full.
 *
 *  - Win coins taper by how many wins were paid today (full, then 70%, 40%, 15%, then a closed till).
 *  - Replaying a board you already cleared today pays less unless it's a new best.
 *  - Spark critters: 8 full catches a day, then only a few coins. At most 2 wheel spins a day (all sources).
 *  - Parade treasure: 3 parades a day. Buddy Hunt: 3 full prizes a day. Roman's Trial pays 2x three times a day.
 * Stars, new bests, the Daily and buddy XP are never tapered. Pure state in, state out; App saves it.
 */
export const ECON_KEY = 'roman.econ.v1'

/** wins today (1-based) → % of the win coins paid */
export const WIN_TIERS: readonly { upTo: number; pct: number }[] = [
  { upTo: 5, pct: 100 },
  { upTo: 8, pct: 70 },
  { upTo: 12, pct: 40 },
  { upTo: 20, pct: 15 },
  { upTo: Infinity, pct: 0 },
]
export const WIN_FLOOR = 5
export const SPARK_FULL_CATCHES = 8
export const SPIN_CAP_PER_DAY = 1
export const SPIN_CAPPED_COINS = 20
export const TREASURE_PARADES_PER_DAY = 3
export const HUNTS_PER_DAY = 3
export const HUNT_EXTRA_PCT = 25
export const TRIAL_DOUBLE_PER_DAY = 3
export const REPEAT_PCT = [100, 60, 30] as const
/** new-best coins (and the repeat-board exemption) work for this many new bests a day */
export const BESTS_PER_DAY = 3
/** each hint on one board costs more after the 3rd (free hints never cost coins); same for Rescue after the 2nd */
export function hintPrice(usedThisBoard: number): number {
  return usedThisBoard < 3 ? 15 : usedThisBoard < 6 ? 25 : 40
}
export function rescuePrice(usedThisBoard: number): number {
  return usedThisBoard < 2 ? 40 : usedThisBoard < 4 ? 60 : 80
}


export interface Ledger {
  /** Toronto date this ledger counts (YYYY-MM-DD) */
  day: string
  /** wins paid or counted today */
  wins: number
  /** win coins actually paid today */
  winCoins: number
  sparks: number
  spins: number
  treasureParades: number
  hunts: number
  bests: number
  trialClears: number
  /** clears of each board today (capped list) */
  boards: Record<string, number>
}

export function emptyLedger(day: string): Ledger {
  return { day, wins: 0, winCoins: 0, sparks: 0, spins: 0, treasureParades: 0, hunts: 0, bests: 0, trialClears: 0, boards: {} }
}

const int = (x: unknown, max = 100000) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0)

/** Saved junk / older build / a new day → a valid ledger for `today` */
export function sanitizeLedger(raw: unknown, today: string): Ledger {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (r.day !== today) return emptyLedger(today)
  const boards: Record<string, number> = {}
  if (r.boards && typeof r.boards === 'object') {
    for (const [k, v] of Object.entries(r.boards as Record<string, unknown>).slice(0, 80)) boards[k.slice(0, 60)] = int(v, 999)
  }
  return {
    day: today,
    wins: int(r.wins, 9999),
    winCoins: int(r.winCoins),
    sparks: int(r.sparks, 9999),
    spins: int(r.spins, 99),
    treasureParades: int(r.treasureParades, 99),
    hunts: int(r.hunts, 99),
    bests: int(r.bests, 99),
    trialClears: int(r.trialClears, 99),
    boards,
  }
}

export function loadLedger(store: Pick<Storage, 'getItem'> | null, today: string): Ledger {
  try {
    const raw = store?.getItem(ECON_KEY)
    return sanitizeLedger(raw ? JSON.parse(raw) : null, today)
  } catch {
    return emptyLedger(today)
  }
}
export function saveLedger(store: Pick<Storage, 'setItem'> | null, l: Ledger): void {
  try {
    store?.setItem(ECON_KEY, JSON.stringify(l))
  } catch {
    /* extras: never block play */
  }
}
/** The ledger for `today` (a new day starts fresh) */
export function rollLedger(l: Ledger, today: string): Ledger {
  return l.day === today ? l : emptyLedger(today)
}

/** % of win coins paid for the Nth win of the day (1-based) */
export function winTaper(winNumber: number): number {
  const n = Math.max(1, Math.floor(winNumber))
  return (WIN_TIERS.find((t) => n <= t.upTo) ?? WIN_TIERS[WIN_TIERS.length - 1]).pct
}
/** % for clearing the same board again today (0 = first clear). A new best pays in full. */
export function repeatPct(clearsBefore: number, newBest: boolean): number {
  if (newBest) return 100
  return REPEAT_PCT[Math.min(REPEAT_PCT.length - 1, Math.max(0, Math.floor(clearsBefore)))]
}

export interface WinPay {
  coins: number
  /** combined % of the full win coins paid */
  pct: number
  ledger: Ledger
  /** plain words for the win screen, empty when paid in full */
  note: string
  /** the new-best coins are paid (only the first few new bests a day) */
  bestPays: boolean
}

/**
 * Pay for one win. `base` = the full win coins (already doubled for a Trial). The Daily Challenge is
 * never tapered (it is once a day anyway) but it still counts as a win of the day.
 */
export function payWin(l: Ledger, base: number, o: { boardId: string; newBest: boolean; daily?: boolean }): WinPay {
  const winNumber = l.wins + 1
  const bestPays = o.newBest && l.bests < BESTS_PER_DAY
  const seen = l.boards[o.boardId] ?? 0
  const tier = o.daily ? 100 : winTaper(winNumber)
  const rep = o.daily ? 100 : repeatPct(seen, bestPays)
  const pct = Math.round((tier * rep) / 100)
  let coins = Math.floor((base * pct) / 100)
  if (tier > 0 && pct > 0) coins = Math.max(WIN_FLOOR, coins)
  if (tier === 0) coins = 0
  const boards = { ...l.boards }
  if (Object.keys(boards).length < 80 || boards[o.boardId] != null) boards[o.boardId] = seen + 1
  const ledger: Ledger = { ...l, wins: winNumber, winCoins: l.winCoins + coins, bests: l.bests + (bestPays ? 1 : 0), boards }
  let note = ''
  if (tier === 0) note = 'Coin purse closed for today (stars, records and buddy XP still count)'
  else if (pct < 100) note = rep < 100 && tier === 100 ? `Repeat board pays ${pct}%` : `Busy day: wins pay ${pct}%`
  return { coins, pct, ledger, note, bestPays }
}

/** The critter visits until you have caught 8 today, then it rests until tomorrow */
export function sparksOpen(l: Ledger): boolean {
  return l.sparks < SPARK_FULL_CATCHES
}
/** Can another wheel spin be earned today (spark stash, parade treasure)? */
export function canEarnSpin(l: Ledger): boolean {
  return l.spins < SPIN_CAP_PER_DAY
}
export function canTreasure(l: Ledger): boolean {
  return l.treasureParades < TREASURE_PARADES_PER_DAY
}
/** Roman's Trial pays 2x for the first three clears of the day, 1x after */
export function trialMultiplier(l: Ledger): number {
  return l.trialClears < TRIAL_DOUBLE_PER_DAY ? 2 : 1
}
/** Buddy Hunt coin scale (%) for the next hunt today */
export function huntPct(l: Ledger): number {
  return l.hunts < HUNTS_PER_DAY ? 100 : HUNT_EXTRA_PCT
}

/** Plain-words counters for the Rewards card */
export function ledgerSummary(l: Ledger): { winsFull: number; winsFullMax: number; winsToday: number; sparks: number; sparksMax: number; spins: number; spinsMax: number } {
  const fullMax = WIN_TIERS[0].upTo
  return {
    winsFull: Math.min(l.wins, fullMax),
    winsFullMax: fullMax,
    winsToday: l.wins,
    sparks: Math.min(l.sparks, SPARK_FULL_CATCHES),
    sparksMax: SPARK_FULL_CATCHES,
    spins: Math.min(l.spins, SPIN_CAP_PER_DAY),
    spinsMax: SPIN_CAP_PER_DAY,
  }
}
