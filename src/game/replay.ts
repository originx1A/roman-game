/**
 * Replay challenge: personal bests, ghost pace, skill scoring (combo + undo cost), stars,
 * Roman's Trial and the Daily Challenge. Pure logic (no DOM, no storage) so it can be tested;
 * storage.ts loads/saves the blob under a versioned key.
 */

export type RunMode = 'normal' | 'trial'

export interface Targets {
  /** Beat this for the 2nd star (and the 3rd) */
  timeMs: number
  /** Score needed (with the target time and zero undos) for the 3rd star */
  score3: number
}

/** Target time per board size. A careful but steady solve beats it; the 3rd star needs pace + combos. */
const TARGET_SEC: Record<number, number> = { 5: 40, 6: 70, 7: 110, 8: 170 }
const DIFF_FACTOR: Record<string, number> = { easy: 1, medium: 1, hard: 1, expert: 1 }

export function targetsFor(p: { size: number; difficulty?: string }): Targets {
  const sec = TARGET_SEC[p.size] ?? Math.round(p.size * p.size * 1.8 + 10)
  const timeMs = Math.round(sec * (DIFF_FACTOR[p.difficulty ?? 'easy'] ?? 1)) * 1000
  const s = p.size
  // base + perfect + time bonus for finishing at 75% of the target + a steady x1.5 combo on buddies + X's
  const score3 = s * 200 + PERFECT_BONUS + Math.round(s * 100 * (1 - 0.75 / 2)) + s * BUDDY_POINTS * 1.5 + s * s * 3
  return { timeMs, score3: Math.round(score3 / 10) * 10 }
}

/** Trial countdown: a little over the target time */
export function trialTimeLimitMs(t: Targets): number {
  return Math.round((t.timeMs * 1.2) / 1000) * 1000
}
export const TRIAL_HEARTS = 2

// ---------- scoring ----------
export const BUDDY_POINTS = 40
export const X_POINTS = 4
export const UNDO_COST = 25
export const HINT_COST_PTS = 40
export const PERFECT_BONUS = 150
/** A gap longer than this between good moves drops the combo */
export const COMBO_WINDOW_MS = 4000

export interface ComboState {
  streak: number
  lastGoodAt: number
  points: number
  bestMult: number
  /** cells already rewarded (so painting/erasing the same X's can't farm points) */
  seenX: number[]
  seenBuddy: number[]
}

export function newCombo(): ComboState {
  return { streak: 0, lastGoodAt: 0, points: 0, bestMult: 1, seenX: [], seenBuddy: [] }
}

export function comboMult(streak: number): number {
  return Math.min(3, 1 + 0.5 * Math.floor(streak / 3))
}

/** Live multiplier (drops to x1 once the combo window has passed) */
export function liveMult(c: ComboState, now: number): number {
  if (!c.streak || now - c.lastGoodAt > COMBO_WINDOW_MS) return 1
  return comboMult(c.streak)
}

export type MoveKind = 'x' | 'buddy' | 'bad' | 'undo' | 'other'

/** Apply one move. Returns the new state, the points it earned and whether the multiplier went up a tier. */
export function comboMove(c: ComboState, kind: MoveKind, index: number, now: number): { combo: ComboState; gained: number; tierUp: boolean } {
  if (kind === 'bad' || kind === 'undo') {
    return { combo: { ...c, streak: 0, lastGoodAt: now, points: c.points - (kind === 'undo' ? UNDO_COST : 0) }, gained: kind === 'undo' ? -UNDO_COST : 0, tierUp: false }
  }
  if (kind === 'other') return { combo: c, gained: 0, tierUp: false }
  const seen = kind === 'x' ? c.seenX : c.seenBuddy
  if (seen.includes(index)) return { combo: c, gained: 0, tierUp: false }
  const idle = !c.streak || now - c.lastGoodAt > COMBO_WINDOW_MS
  const before = idle ? 1 : comboMult(c.streak)
  const streak = (idle ? 0 : c.streak) + 1
  const mult = comboMult(streak)
  const gained = Math.round((kind === 'x' ? X_POINTS : BUDDY_POINTS) * mult)
  const next: ComboState = {
    ...c,
    streak,
    lastGoodAt: now,
    points: c.points + gained,
    bestMult: Math.max(c.bestMult, mult),
    seenX: kind === 'x' ? [...c.seenX, index] : c.seenX,
    seenBuddy: kind === 'buddy' ? [...c.seenBuddy, index] : c.seenBuddy,
  }
  return { combo: next, gained, tierUp: mult > before && mult > 1 }
}

export function scoreRunV2(o: {
  size: number
  targetMs: number
  elapsedMs: number
  hintsUsed: number
  perfect: boolean
  /** combo points already net of undo costs */
  comboPoints: number
}): number {
  const base = o.size * 200
  const timeBonus = Math.round(o.size * 100 * Math.min(1, Math.max(0, 1 - o.elapsedMs / (2 * o.targetMs))))
  const score = base + timeBonus + (o.perfect ? PERFECT_BONUS : 0) + o.comboPoints - o.hintsUsed * HINT_COST_PTS
  return Math.max(50, Math.round(score))
}

export function starsFor(run: { ms: number; score: number; undos: number }, t: Targets): number {
  if (run.ms > t.timeMs) return 1
  if (run.score >= t.score3 && run.undos === 0) return 3
  return 2
}

// ---------- ghost pace ----------
/** Ghost times for each buddy count; old records without splits get an even pace. */
export function ghostSplits(bestMs: number, size: number, splits?: number[]): number[] {
  if (splits && splits.length === size && splits.every((n) => Number.isFinite(n))) return splits
  return Array.from({ length: size }, (_, k) => Math.round((bestMs * (k + 1)) / size))
}

/**
 * Pace against the ghost in ms: negative = ahead, positive = behind.
 * `mine[k-1]` is when you first had k buddies down; `correct` is how many you have now.
 */
export function paceDelta(mine: number[], ghost: number[], correct: number, elapsedMs: number): number {
  const k = Math.min(correct, ghost.length)
  const reached = k > 0 ? (mine[k - 1] ?? elapsedMs) - ghost[k - 1] : 0
  const late = k < ghost.length ? elapsedMs - ghost[k] : Number.NEGATIVE_INFINITY
  return Math.max(reached, late)
}

/** Ghost's progress (0..1) at this moment */
export function ghostProgress(ghost: number[], elapsedMs: number): number {
  let k = 0
  while (k < ghost.length && ghost[k] <= elapsedMs) k++
  if (k >= ghost.length) return 1
  const prev = k ? ghost[k - 1] : 0
  const frac = (elapsedMs - prev) / Math.max(1, ghost[k] - prev)
  return (k + Math.min(1, Math.max(0, frac))) / ghost.length
}

export function formatDelta(ms: number): string {
  const s = Math.abs(ms) / 1000
  const txt = s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)}s`
  return `${Math.abs(ms) < 50 ? '±' : ms < 0 ? '−' : '+'}${txt}`
}

// ---------- records ----------
export interface BestSet {
  bestMs?: number
  bestScore?: number
  /** ghost splits of the fastest run */
  splits?: number[]
  clears: number
  /** Buddy on the best run (future feature). null = solo */
  buddy?: string | null
}

export interface LevelRecord extends BestSet {
  stars: number
  plays: number
  trial?: BestSet
}

export interface DailyDay {
  puzzleId: string
  status: 'started' | 'won' | 'lost'
  score?: number
  ms?: number
  /** Buddy on the scored run (future feature). null = solo */
  buddy?: string | null
}

export interface DailyState {
  streak: number
  bestStreak: number
  lastWon?: string
  days: Record<string, DailyDay>
}

export interface RecordsBlob {
  v: 1
  levels: Record<string, LevelRecord>
  daily: DailyState
}

export const RECORDS_VERSION = 1

export function emptyRecords(): RecordsBlob {
  return { v: 1, levels: {}, daily: { streak: 0, bestStreak: 0, days: {} } }
}

const num = (n: unknown): number | undefined => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined)
function cleanBest(b: Partial<BestSet> | undefined): BestSet {
  const splits = Array.isArray(b?.splits) && b!.splits.every((n) => typeof n === 'number') ? b!.splits : undefined
  return { bestMs: num(b?.bestMs), bestScore: num(b?.bestScore), splits, clears: num(b?.clears) ?? 0, buddy: typeof b?.buddy === 'string' ? b.buddy : null }
}

/**
 * Parse the saved blob; anything missing or broken falls back safely. With no blob yet, seed it
 * from the older clear list (best time/score per board), so earlier progress still counts.
 */
export function migrateRecords(
  raw: unknown,
  legacyClears: { puzzleId: string; bestMs: number; bestScore: number; clears: number }[],
  boardInfo: (id: string) => { size: number; difficulty?: string } | undefined,
): RecordsBlob {
  const out = emptyRecords()
  const r = raw as Partial<RecordsBlob> | null
  if (r && typeof r === 'object' && r.v === 1) {
    for (const [id, lv] of Object.entries(r.levels ?? {})) {
      if (!lv || typeof lv !== 'object') continue
      const base = cleanBest(lv)
      out.levels[id] = {
        ...base,
        stars: Math.min(3, Math.max(0, Math.floor(num(lv.stars) ?? 0))),
        plays: num(lv.plays) ?? base.clears,
        trial: lv.trial ? cleanBest(lv.trial) : undefined,
      }
    }
    const d = r.daily
    if (d && typeof d === 'object') {
      out.daily = {
        streak: num(d.streak) ?? 0,
        bestStreak: num(d.bestStreak) ?? 0,
        lastWon: typeof d.lastWon === 'string' ? d.lastWon : undefined,
        days: typeof d.days === 'object' && d.days ? d.days : {},
      }
    }
  }
  // Fill in boards cleared before this feature (or cleared on a device before the blob existed)
  for (const c of legacyClears ?? []) {
    if (!c || out.levels[c.puzzleId]) continue
    const info = boardInfo(c.puzzleId)
    if (!info || !num(c.bestMs)) continue
    const t = targetsFor(info)
    out.levels[c.puzzleId] = {
      bestMs: c.bestMs,
      bestScore: num(c.bestScore),
      clears: num(c.clears) ?? 1,
      plays: num(c.clears) ?? 1,
      stars: c.bestMs <= t.timeMs ? 2 : 1,
      buddy: null,
    }
  }
  return out
}

export interface RunResult {
  firstClear: boolean
  newBestTime: boolean
  newBestScore: boolean
  prevBestMs?: number
  prevBestScore?: number
  starsBefore: number
  starsAfter: number
  runStars: number
  trialUnlockedNow: boolean
  /** ms slower than the best time, when close but not a record */
  nearMissMs?: number
}

export function hasBest(blob: RecordsBlob, id: string, mode: RunMode): BestSet | undefined {
  const lv = blob.levels[id]
  const b = mode === 'trial' ? lv?.trial : lv
  return b && b.bestMs != null ? b : undefined
}

export function trialUnlocked(blob: RecordsBlob, id: string): boolean {
  return (blob.levels[id]?.stars ?? 0) >= 3
}

export function notePlay(blob: RecordsBlob, id: string): RecordsBlob {
  const lv = blob.levels[id] ?? { stars: 0, plays: 0, clears: 0 }
  return { ...blob, levels: { ...blob.levels, [id]: { ...lv, plays: lv.plays + 1 } } }
}

export function recordRun(
  blob: RecordsBlob,
  run: { puzzleId: string; mode: RunMode; ms: number; score: number; undos: number; splits: number[]; targets: Targets; buddy?: string | null },
): { blob: RecordsBlob; result: RunResult } {
  const lv: LevelRecord = blob.levels[run.puzzleId] ?? { stars: 0, plays: 1, clears: 0 }
  const cur: BestSet = run.mode === 'trial' ? lv.trial ?? { clears: 0 } : lv
  const firstClear = cur.bestMs == null
  const newBestTime = !firstClear && run.ms < cur.bestMs!
  const newBestScore = !firstClear && cur.bestScore != null && run.score > cur.bestScore
  const fastest = firstClear || newBestTime
  const updated: BestSet = {
    bestMs: fastest ? run.ms : cur.bestMs,
    bestScore: cur.bestScore == null || run.score > cur.bestScore ? run.score : cur.bestScore,
    splits: fastest ? run.splits : cur.splits,
    clears: cur.clears + 1,
    buddy: fastest ? run.buddy ?? null : cur.buddy ?? null,
  }
  const runStars = run.mode === 'normal' ? starsFor(run, run.targets) : 0
  const starsBefore = lv.stars
  const starsAfter = Math.max(starsBefore, runStars)
  const next: LevelRecord =
    run.mode === 'trial'
      ? { ...lv, trial: updated }
      : { ...lv, ...updated, stars: starsAfter }
  const slower = !firstClear && !newBestTime ? run.ms - cur.bestMs! : undefined
  const nearMissMs = slower != null && slower > 0 && slower <= Math.max(3000, cur.bestMs! * 0.15) ? slower : undefined
  return {
    blob: { ...blob, levels: { ...blob.levels, [run.puzzleId]: next } },
    result: {
      firstClear,
      newBestTime,
      newBestScore,
      prevBestMs: cur.bestMs,
      prevBestScore: cur.bestScore,
      starsBefore,
      starsAfter,
      runStars,
      trialUnlockedNow: run.mode === 'normal' && starsBefore < 3 && starsAfter >= 3,
      nearMissMs,
    },
  }
}

// ---------- coins ----------
export const STAR_COINS = [0, 10, 20, 40]
export const NEW_BEST_COINS = 20
export const TRIAL_FIRST_CLEAR_COINS = 50

export function replayCoins(r: RunResult, mode: RunMode): { coins: number; parts: string[] } {
  let coins = 0
  const parts: string[] = []
  let starCoins = 0
  for (let s = r.starsBefore + 1; s <= r.starsAfter; s++) starCoins += STAR_COINS[s] ?? 0
  if (starCoins) {
    coins += starCoins
    parts.push(`+${starCoins} new star${r.starsAfter - r.starsBefore > 1 ? 's' : ''}`)
  }
  if (r.newBestTime || r.newBestScore) {
    coins += NEW_BEST_COINS
    parts.push(`+${NEW_BEST_COINS} new best`)
  }
  if (mode === 'trial' && r.firstClear) {
    coins += TRIAL_FIRST_CLEAR_COINS
    parts.push(`+${TRIAL_FIRST_CLEAR_COINS} first Trial clear`)
  }
  return { coins, parts }
}

export function dailyCoins(streak: number): number {
  return 40 + 10 * Math.min(Math.max(streak, 1), 6)
}

// ---------- daily challenge ----------
/** Today's date in Toronto as YYYY-MM-DD */
export function torontoDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function prevDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) - 86_400_000)
  return dt.toISOString().slice(0, 10)
}

/** Same board for everyone on a given date (FNV-1a hash of the date) */
export function dailyIndex(key: string, count: number): number {
  let h = 0x811c9dc5
  for (const ch of `roman-daily:${key}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % count
}

/** Streak still alive today (won today or yesterday) */
export function liveStreak(d: DailyState, today: string): number {
  if (!d.lastWon) return 0
  return d.lastWon === today || d.lastWon === prevDateKey(today) ? d.streak : 0
}

/** Starting the daily: only the first attempt of the day scores */
export function startDaily(d: DailyState, today: string, puzzleId: string): { daily: DailyState; firstAttempt: boolean } {
  if (d.days[today]) return { daily: d, firstAttempt: false }
  const days = { ...d.days, [today]: { puzzleId, status: 'started' as const } }
  // keep ~2 months of history
  const keys = Object.keys(days).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete days[k]
  return { daily: { ...d, days }, firstAttempt: true }
}

export function finishDaily(
  d: DailyState,
  today: string,
  won: boolean,
  run?: { score: number; ms: number; buddy?: string | null },
): { daily: DailyState; counted: boolean; streak: number } {
  const day = d.days[today]
  if (!day || day.status !== 'started') return { daily: d, counted: false, streak: liveStreak(d, today) }
  const done: DailyDay = { ...day, status: won ? 'won' : 'lost', score: run?.score, ms: run?.ms, buddy: run?.buddy ?? null }
  let streak = d.streak
  let lastWon = d.lastWon
  if (won) {
    streak = d.lastWon === prevDateKey(today) ? d.streak + 1 : d.lastWon === today ? d.streak : 1
    lastWon = today
  } else {
    streak = 0
  }
  return {
    daily: { ...d, streak, lastWon, bestStreak: Math.max(d.bestStreak, streak), days: { ...d.days, [today]: done } },
    counted: true,
    streak,
  }
}

// ---------- share text ----------
/**
 * Buddy slot in share text (9.30-a): "with Lupa the Wolf Pup", or "Solo run, no buddy" for null.
 * Undefined (a share without run info, e.g. an older best) adds nothing.
 */
export function buddyShareText(buddy: string | null | undefined): string {
  if (buddy === undefined) return ''
  return buddy && buddy.trim() ? `with ${buddy.trim()}` : 'Solo run, no buddy'
}

function shareTime(ms: number): string {
  const sec = Math.floor(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * Share text for a score: "<Name> scored 12,400 on Level 7 (Dawn) — 3 stars ⭐⭐⭐ — New best! —
 * beat my time (0:42) in Roman's Game". With no name set it reads "I scored…" (never "Roman's score").
 */
export function scoreShareText(o: {
  name?: string
  score: number
  levelLabel: string
  stars?: number
  timeMs?: number
  newBest?: boolean
  /** Buddy on this run (display name). null = Solo run, undefined = unknown (adds nothing) */
  buddy?: string | null
}): string {
  const who = o.name && o.name.trim() ? `${o.name.trim()} scored` : 'I scored'
  const parts = [`${who} ${Math.round(o.score).toLocaleString('en-US')} on ${o.levelLabel}`]
  const buddyPart = buddyShareText(o.buddy)
  if (buddyPart) parts.push(buddyPart)
  if (o.stars && o.stars > 0) parts.push(`${o.stars} star${o.stars === 1 ? '' : 's'} ${'⭐'.repeat(Math.min(3, o.stars))}`)
  if (o.newBest) parts.push('New best!')
  parts.push(o.timeMs != null ? `beat my time (${shareTime(o.timeMs)}) in Roman's Game` : "beat my score in Roman's Game")
  return parts.join(' — ')
}

