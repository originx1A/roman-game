/**
 * 9.30-i Remix boards + Endless mode. Pure logic (no DOM, no storage) so it can be tested.
 *
 * Remix boards: a set of 4 boards (5×5, 6×6, 7×7, 8×8), the same for everyone. A new set starts
 * every 3 days at midnight Toronto time: set = floor(days since REMIX_EPOCH / 3). Each board is
 * rebuilt from its seed by the board generator (which checks it has exactly one solution), so no
 * level data ships. If a seed finds no board, the next seed in a fixed list is tried, so every
 * phone still lands on the same board. IDs are stable (rmx-<set>-<size>) so bests, stars, the
 * Trial and challenge links work like catalog boards.
 */
import type { Difficulty, Puzzle } from './types'
import { difficultyForSize, generateRandomPuzzle } from './generatePuzzle'
import { torontoDateKey } from './replay'

/** Toronto date of day 0 (set 0 = Sep 28–30, 2026) */
export const REMIX_EPOCH = '2026-09-28'
export const REMIX_DAYS = 3
export const REMIX_SIZES = [5, 6, 7, 8] as const
export type RemixSize = (typeof REMIX_SIZES)[number]
/** Fixed fallback seeds per board (the generator usually succeeds on the first) */
export const REMIX_FALLBACK_SEEDS = 24

const DAY_MS = 86_400_000

function utcOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function keyOfUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Days from REMIX_EPOCH to a Toronto date key (negative before it) */
export function remixDay(key: string): number {
  return Math.round((utcOfKey(key) - utcOfKey(REMIX_EPOCH)) / DAY_MS)
}

/** Which remix set is live on a Toronto date */
export function remixSetForKey(key: string): number {
  return Math.floor(remixDay(key) / REMIX_DAYS)
}

export function remixSetNow(now: Date = new Date()): number {
  return remixSetForKey(torontoDateKey(now))
}

/** First Toronto date of a set */
export function remixSetStartKey(set: number): string {
  return keyOfUtc(utcOfKey(REMIX_EPOCH) + set * REMIX_DAYS * DAY_MS)
}

/** The instant a Toronto date starts (midnight Toronto; offsets are whole hours) */
export function torontoMidnightMs(key: string): number {
  const base = utcOfKey(key)
  for (let h = 0; h <= 14; h++) {
    const t = base + h * 3_600_000
    if (torontoDateKey(new Date(t)) === key) return t
  }
  return base + 5 * 3_600_000
}

/** When the live set ends (the next set starts), as epoch ms */
export function remixEndsAtMs(now: Date = new Date()): number {
  return torontoMidnightMs(remixSetStartKey(remixSetNow(now) + 1))
}

/** "2d 5h", "5h 12m", "12m" */
export function remixCountdownLabel(ms: number): string {
  if (!(ms > 0)) return 'a moment'
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function remixId(set: number, size: number): string {
  return `rmx-${set}-${size}`
}

export function parseRemixId(id: string): { set: number; size: RemixSize } | null {
  const m = /^rmx-(-?\d+)-([5-8])$/.exec(id)
  return m ? { set: Number(m[1]), size: Number(m[2]) as RemixSize } : null
}

/** FNV-1a: the same seed on every device */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function remixSeed(set: number, size: number, attempt: number): number {
  return fnv1a(`roman-remix:${set}:${size}:${attempt}`)
}

const REMIX_NAMES: Record<RemixSize, string> = { 5: 'Remix A', 6: 'Remix B', 7: 'Remix C', 8: 'Remix D' }

/**
 * Build one remix board (deterministic). 5–7 take milliseconds; the 8×8 can take a second or more
 * on a phone, so the app builds it in a worker, only when it is opened.
 */
export function buildRemixBoard(set: number, size: RemixSize): Puzzle | null {
  const difficulty = difficultyForSize(size)
  for (let attempt = 0; attempt < REMIX_FALLBACK_SEEDS; attempt++) {
    const p = generateRandomPuzzle(difficulty, remixSeed(set, size, attempt))
    if (p && p.size === size) {
      return { ...p, id: remixId(set, size), name: `${REMIX_NAMES[size]} · ${p.name}`, difficulty }
    }
  }
  return null
}

/** Endless: a brand-new board (random seed); null lets the caller fall back */
export function buildEndlessBoard(difficulty: Difficulty, seed: number): Puzzle | null {
  for (let i = 0; i < 4; i++) {
    const p = generateRandomPuzzle(difficulty, (seed + i * 0x9e3779b1) >>> 0)
    if (p) return p
  }
  return null
}

/** Next remix board to offer after a win: the next uncleared size in the set, else null */
export function nextRemixSize(current: RemixSize, cleared: (size: RemixSize) => boolean): RemixSize | null {
  const order = [...REMIX_SIZES.filter((s) => s > current), ...REMIX_SIZES.filter((s) => s < current)]
  return order.find((s) => !cleared(s)) ?? null
}
