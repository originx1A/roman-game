/** Sliding windows for name+password auth. Times are milliseconds. */

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export type LimitRow = {
  hits: number[]
  failures: number[]
  lockedUntil: number | null
  lockStep: number
}

export function emptyLimit(): LimitRow {
  return { hits: [], failures: [], lockedUntil: null, lockStep: 0 }
}

export function within(times: number[], now: number, windowMs: number): number[] {
  return times.filter((time) => now - time < windowMs && time <= now)
}

export function prune(row: LimitRow, now: number): LimitRow {
  return {
    hits: within(row.hits, now, DAY),
    failures: within(row.failures, now, DAY),
    lockedUntil: row.lockedUntil,
    lockStep: row.lockStep,
  }
}

/** First lock is 15 minutes, then 30, then 60. Never longer than an hour. */
export function nextLockMs(lockStep: number): number {
  const step = Math.max(0, lockStep)
  return Math.min(15 * MINUTE * 2 ** step, 60 * MINUTE)
}

export function signinIpBlocked(ip: LimitRow, now: number): boolean {
  return within(ip.hits, now, 15 * MINUTE).length >= 20
}

export function nameLocked(name: LimitRow, now: number): boolean {
  return name.lockedUntil != null && name.lockedUntil > now
}

export function noteSigninAttempt(ip: LimitRow, now: number): LimitRow {
  const next = prune(ip, now)
  next.hits = [...next.hits, now]
  return next
}

/**
 * Count a failed sign-in. The fifth failure inside 15 minutes locks the name.
 * The lock starts at 15 minutes and doubles, capped at one hour.
 */
export function noteSigninFailure(name: LimitRow, ip: LimitRow, now: number): { name: LimitRow; ip: LimitRow; locked: boolean } {
  const nextName = prune(name, now)
  const nextIp = prune(ip, now)
  if (nextName.lockedUntil != null && nextName.lockedUntil <= now) nextName.lockedUntil = null
  nextName.failures = [...within(nextName.failures, now, 15 * MINUTE), now]
  nextIp.failures = [...within(nextIp.failures, now, 15 * MINUTE), now]
  let locked = false
  if (nextName.failures.length >= 5) {
    const wait = nextLockMs(nextName.lockStep)
    nextName.lockedUntil = now + wait
    nextName.lockStep += 1
    nextName.failures = []
    locked = true
  }
  return { name: nextName, ip: nextIp, locked }
}

export function signupIpBlocked(ip: LimitRow, now: number): boolean {
  const hits = within(ip.hits, now, DAY)
  const hour = hits.filter((time) => now - time < HOUR)
  return hour.length >= 5 || hits.length >= 20
}

export function noteSignupAttempt(ip: LimitRow, now: number): LimitRow {
  const next = prune(ip, now)
  next.hits = [...next.hits, now]
  return next
}

export function recoverNameBlocked(name: LimitRow, now: number): boolean {
  return within(name.hits, now, HOUR).length >= 3
}

export function recoverIpBlocked(ip: LimitRow, now: number): boolean {
  return within(ip.hits, now, HOUR).length >= 10
}

export function noteRecoverAttempt(row: LimitRow, now: number): LimitRow {
  const next = prune(row, now)
  next.hits = [...next.hits, now]
  return next
}

export function passwordChangeBlocked(row: LimitRow, now: number): boolean {
  return within(row.hits, now, HOUR).length >= 5
}

export function notePasswordChange(row: LimitRow, now: number): LimitRow {
  const next = prune(row, now)
  next.hits = [...next.hits, now]
  return next
}
