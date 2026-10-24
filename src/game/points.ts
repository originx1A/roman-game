import { torontoDate } from './generate.ts'
import { boardSteps } from './thrones.ts'

/** 5×5 easy. Each step up in size or difficulty adds POINTS_PER_STEP. */
export const POINTS_BASE = 100
export const POINTS_PER_STEP = 25
export const POINTS_PERFECT = 50
export const POINTS_STREAK = 10
export const POINTS_STREAK_CAP = 7

/** Points for one win. Streak is the day count after today's win is counted, capped at 7. */
export function pointsForWin(size: number, difficulty: number, perfect: boolean, streak: number): number {
  const steps = boardSteps(size, difficulty)
  const days = Math.max(0, Math.min(POINTS_STREAK_CAP, Math.floor(streak)))
  return POINTS_BASE + POINTS_PER_STEP * steps + (perfect ? POINTS_PERFECT : 0) + POINTS_STREAK * days
}

/** Same week key the account already uses for weekly coins. */
export function pointsWeekKey(now = new Date()): string {
  const day = torontoDate(now)
  const date = new Date(`${day}T12:00:00Z`)
  const onejan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7)
  return `${date.getUTCFullYear()}-W${week}`
}
