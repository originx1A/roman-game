/**
 * Purchase PIN rules. The digits are checked on the server.
 * This file has no hashing and no storage.
 *
 * A 4-digit PIN is a parent gate, not a password. The server stores a slow
 * hash, locks the account after 5 wrong tries, and never returns the digits.
 */

export const PIN_LENGTH = 4
export const PIN_MAX_FAILS = 5
export const PIN_LOCK_MS = 15 * 60 * 1000
export const PIN_RESET_MS = 30 * 60 * 1000
export const PIN_GRANT_MS = 2 * 60 * 1000
/** Clock skew allowed when the reset email signs them in. */
export const PIN_RESET_SKEW_MS = 2_000

export function isFourDigitPin(pin: string): boolean {
  return typeof pin === 'string' && /^\d{4}$/.test(pin)
}

/**
 * A purchase PIN can be set or reset only after the sign-in email is verified.
 * Magic-link sign-in sets this when the player opens the email.
 */
export function emailIsVerified(email: string, confirmedAt: unknown, emailConfirmedAt: unknown): boolean {
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false
  const raw = typeof emailConfirmedAt === 'string' && emailConfirmedAt ? emailConfirmedAt : confirmedAt
  if (typeof raw !== 'string' || !raw) return false
  return Number.isFinite(Date.parse(raw))
}

export interface PinFailState {
  fails: number
  lockedUntil: number | null
}

export function emptyPinFails(): PinFailState {
  return { fails: 0, lockedUntil: null }
}

/** A finished lock starts the 5 tries over. */
export function normalizePinFails(state: PinFailState, now: number): PinFailState {
  if (state.lockedUntil != null && state.lockedUntil <= now) return emptyPinFails()
  return {
    fails: Math.max(0, Math.floor(state.fails) || 0),
    lockedUntil: state.lockedUntil,
  }
}

export function pinLocked(state: PinFailState, now: number): { locked: boolean; retryInMs: number } {
  const clean = normalizePinFails(state, now)
  if (clean.lockedUntil != null && clean.lockedUntil > now) {
    return { locked: true, retryInMs: clean.lockedUntil - now }
  }
  return { locked: false, retryInMs: 0 }
}

/** The 5th miss starts the lock. Further misses while locked do not extend it. */
export function noteWrongPin(state: PinFailState, now: number): PinFailState {
  const clean = normalizePinFails(state, now)
  const locked = pinLocked(clean, now)
  if (locked.locked) return clean
  const fails = clean.fails + 1
  if (fails >= PIN_MAX_FAILS) return { fails, lockedUntil: now + PIN_LOCK_MS }
  return { fails, lockedUntil: null }
}

export function noteRightPin(): PinFailState {
  return emptyPinFails()
}

export function resetStillOpen(requestedAt: number | null, now: number): boolean {
  return requestedAt != null && now >= requestedAt && now - requestedAt < PIN_RESET_MS
}

/**
 * The reset email has to sign this account in after the request.
 * An already-open session is not enough.
 */
export function resetUnlockedByEmail(requestedAt: number | null, lastSignInAt: number | null, now: number): boolean {
  if (!resetStillOpen(requestedAt, now)) return false
  if (lastSignInAt == null || requestedAt == null) return false
  return lastSignInAt + PIN_RESET_SKEW_MS >= requestedAt
}

export function lockMessage(retryInMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryInMs / 60_000))
  return minutes === 1
    ? 'Too many tries. Try again in 1 minute.'
    : `Too many tries. Try again in ${minutes} minutes.`
}
