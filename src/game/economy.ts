/**
 * Stage 1 economy tuning for every player (guest and signed-in).
 * One file so payouts, prices, caps, and refills stay in step.
 *
 * Existing coins, owned buddies, and badges are kept. New prices apply
 * only to the next purchase. Nothing a player already owns is taken away.
 */

export const ECONOMY = {
  win: { divisor: 40, min: 10, max: 80 },
  daily: { base: 20, perStreak: 5, streakSteps: 6 },
  firstWinBonus: 30,
  fieldTreatsPerWin: 1,
  fieldTreatsPerDay: 5,
  defenseTreatsPerDay: 10,
  defenseCatchMin: 2,
  defenseCatchMax: 3,
  defenseStreakMax: 2,
  defenseScareTreats: 1,
  sparkCatchesPerDay: 5,
  sparkCoinMin: 5,
  sparkCoinMax: 10,
  paradePot: 60,
  /** Lower than the old 15 so a 60-coin pot still fills three parades. */
  paradeMinBudget: 8,
  badgeCoinPctCap: 25,
  fountainCoins: 20,
  fountainIntervalMs: 6 * 3_600_000,
  fountainHold: 2,
  maxFeedsPerDay: 3,
  moodDecayPerHour: 3,
  moodFloor: 20,
  happyCoins: 4,
  joyfulCoins: 6,
  jackpotBonusSnacks: 10,
  weeklySpendCapCadCents: 5000,
  snackCoinSwap: false,
} as const

export const BUDDY_PRICES = {
  lupa: 2500,
  aquila: 4500,
  leo: 7500,
  invictus: 15000,
  nox: 3500,
} as const

export const WELCOME_BUDDY_IDS = ['lupa', 'aquila', 'leo'] as const
export type WelcomeBuddyId = (typeof WELCOME_BUDDY_IDS)[number]

export function isWelcomeBuddy(id: string): id is WelcomeBuddyId {
  return (WELCOME_BUDDY_IDS as readonly string[]).includes(id)
}

export const TREAT_OFFERS = {
  snack: { cost: 35, xp: 30, mood: 20 },
  feast: { cost: 100, xp: 120, mood: 45 },
  banquet: { cost: 250, xp: 250, mood: 100, perDay: 1 },
} as const

/** CAD list used for the weekly cap. Stripe still charges the existing USD amount until Tony approves CAD checkout. */
export const PACK_CAD_CENTS: Record<string, number> = {
  coins_500: 699,
  coins_1200: 1399,
  coins_3000: 2799,
}

export function packCadCents(packId: string): number {
  return PACK_CAD_CENTS[packId] ?? 0
}

/** clamp(score / 40, 10, 80). A normal board lands near 45 coins before the daily taper. */
export function winBaseCoins(score: number): number {
  const raw = Math.floor(Math.max(0, score) / ECONOMY.win.divisor)
  return Math.max(ECONOMY.win.min, Math.min(ECONOMY.win.max, raw))
}

/** 20 + 5 × streak, capped at 50. */
export function dailyChallengeCoins(streak: number): number {
  const steps = Math.min(ECONOMY.daily.streakSteps, Math.max(1, Math.floor(streak) || 1))
  return ECONOMY.daily.base + ECONOMY.daily.perStreak * steps
}

export type MoodName = 'Hungry' | 'Okay' | 'Happy' | 'Joyful'

export interface MoodTier {
  name: MoodName
  strength: number
  extraCoins: number
}

/** Abilities scale from 75% to 150%. They never drop to zero. */
export function moodTier(mood: number): MoodTier {
  if (mood >= 85) return { name: 'Joyful', strength: 1.5, extraCoins: ECONOMY.joyfulCoins }
  if (mood >= 60) return { name: 'Happy', strength: 1.25, extraCoins: ECONOMY.happyCoins }
  if (mood >= 35) return { name: 'Okay', strength: 1, extraCoins: 0 }
  return { name: 'Hungry', strength: 0.75, extraCoins: 0 }
}

/** Scale a perk number. Zero stays zero. Anything else stays at least 1. */
export function scaleAbility(base: number, strength: number): number {
  if (base <= 0) return 0
  return Math.max(1, Math.round(base * strength))
}

export function defenseCatchTreats(rand: () => number = Math.random): number {
  const span = ECONOMY.defenseCatchMax - ECONOMY.defenseCatchMin + 1
  return ECONOMY.defenseCatchMin + Math.floor(rand() * span)
}

export function defenseStreakBonus(streak: number): number {
  return Math.min(ECONOMY.defenseStreakMax, Math.max(0, Math.floor(streak) - 1))
}

export function sparkCoinReward(rand: () => number = Math.random): number {
  const span = ECONOMY.sparkCoinMax - ECONOMY.sparkCoinMin + 1
  return ECONOMY.sparkCoinMin + Math.floor(rand() * span)
}

export interface TreatDay {
  day: string
  wins: number
  defense: number
}

export function emptyTreatDay(day: string): TreatDay {
  return { day, wins: 0, defense: 0 }
}

export function sanitizeTreatDay(raw: unknown, today: string): TreatDay {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (r.day !== today) return emptyTreatDay(today)
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
  return { day: today, wins: n(r.wins), defense: n(r.defense) }
}

/** Wins: 1 treat, max 5 a day. Defense: the catch amount, max 10 a day. */
export function takeFieldTreats(day: TreatDay, today: string, source: 'win' | 'defense', want: number): { day: TreatDay; granted: number } {
  const d = day.day === today ? day : emptyTreatDay(today)
  const ask = Math.max(0, Math.floor(want))
  if (source === 'win') {
    const room = Math.max(0, ECONOMY.fieldTreatsPerDay - d.wins)
    const granted = Math.min(ECONOMY.fieldTreatsPerWin, room, ask)
    return { day: { ...d, wins: d.wins + granted }, granted }
  }
  const room = Math.max(0, ECONOMY.defenseTreatsPerDay - d.defense)
  const granted = Math.min(room, ask)
  return { day: { ...d, defense: d.defense + granted }, granted }
}

export interface FountainState {
  v: 1
  stored: number
  updatedAt: number
}

export function emptyFountain(now: number): FountainState {
  return { v: 1, stored: 0, updatedAt: now }
}

export function sanitizeFountain(raw: unknown, now: number): FountainState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const stored = typeof r.stored === 'number' && Number.isFinite(r.stored) ? Math.max(0, Math.min(ECONOMY.fountainHold, Math.floor(r.stored))) : 0
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : now
  return accrueFountain({ v: 1, stored, updatedAt }, now)
}

/** Bank up to 2 charges. Coins do not pile up past that while you are away. */
export function accrueFountain(state: FountainState, now: number): FountainState {
  if (now < state.updatedAt) return { ...state, updatedAt: now }
  if (state.stored >= ECONOMY.fountainHold) return state
  const elapsed = now - state.updatedAt
  const gained = Math.floor(elapsed / ECONOMY.fountainIntervalMs)
  if (gained <= 0) return state
  const stored = Math.min(ECONOMY.fountainHold, state.stored + gained)
  const updatedAt = state.updatedAt + gained * ECONOMY.fountainIntervalMs
  return { v: 1, stored, updatedAt }
}

export function claimFountain(state: FountainState, now: number): { state: FountainState; coins: number } {
  const ready = accrueFountain(state, now)
  if (ready.stored <= 0) return { state: ready, coins: 0 }
  return {
    state: { v: 1, stored: 0, updatedAt: now },
    coins: ready.stored * ECONOMY.fountainCoins,
  }
}

export function fountainNextMs(state: FountainState, now: number): number | null {
  const ready = accrueFountain(state, now)
  if (ready.stored >= ECONOMY.fountainHold) return null
  return ready.updatedAt + ECONOMY.fountainIntervalMs - now
}

export interface GiftReward {
  coins: number
  snack?: number
  feast?: number
  badge?: string
}

/** 7-day calendar. Missing a day pauses on the next unclaimed day. It does not jump back to day 1. */
export const DAILY_GIFTS: readonly GiftReward[] = [
  { coins: 40 },
  { coins: 50 },
  { coins: 60, snack: 1 },
  { coins: 70 },
  { coins: 80, feast: 1 },
  { coins: 90 },
  { coins: 150, badge: 'daily_gift' },
]

export interface GiftCalendar {
  v: 1
  /** Next day to claim, 0–6. */
  next: number
  lastClaim: string | null
}

export function emptyGiftCalendar(): GiftCalendar {
  return { v: 1, next: 0, lastClaim: null }
}

export function sanitizeGiftCalendar(raw: unknown): GiftCalendar {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const next = typeof r.next === 'number' && Number.isFinite(r.next) ? Math.max(0, Math.min(DAILY_GIFTS.length - 1, Math.floor(r.next))) : 0
  const lastClaim = typeof r.lastClaim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastClaim) ? r.lastClaim : null
  return { v: 1, next, lastClaim }
}

export interface GiftClaim {
  state: GiftCalendar
  reward: GiftReward | null
  /** True when at least one calendar day was missed. The day number did not reset. */
  paused: boolean
  already: boolean
}

export function claimDailyGift(cal: GiftCalendar, today: string, prevDay: (day: string) => string): GiftClaim {
  if (cal.lastClaim === today) return { state: cal, reward: null, paused: false, already: true }
  const missed = cal.lastClaim != null && cal.lastClaim !== prevDay(today)
  const reward = DAILY_GIFTS[cal.next] ?? DAILY_GIFTS[0]
  const state: GiftCalendar = {
    v: 1,
    next: (cal.next + 1) % DAILY_GIFTS.length,
    lastClaim: today,
  }
  return { state, reward, paused: missed, already: false }
}

export interface SpendCharge {
  at: number
  cadCents: number
  id: string
}

const WEEK_MS = 7 * 86_400_000

export function spentInWindow(charges: readonly SpendCharge[], now: number, windowMs = WEEK_MS): number {
  return charges.reduce((sum, c) => (now - c.at < windowMs && now >= c.at ? sum + Math.max(0, c.cadCents) : sum), 0)
}

export function canSpend(spentCadCents: number, nextCadCents: number, cap = ECONOMY.weeklySpendCapCadCents): { ok: boolean; reason?: string } {
  if (nextCadCents <= 0) return { ok: false, reason: 'That pack is not sold on the website.' }
  if (spentCadCents + nextCadCents > cap) {
    return { ok: false, reason: 'Weekly spending limit reached (CA$50). Try again next week.' }
  }
  return { ok: true }
}
