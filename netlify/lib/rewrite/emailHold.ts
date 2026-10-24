/** How long a not-yet-confirmed email stays reserved for one account. */
export const EMAIL_HOLD_MS = 24 * 60 * 60 * 1000

export interface EmailHold {
  playerId: string
  until: number
}

export function emailHoldKey(email: string): string {
  return `rate:email-hold:${email.trim().toLowerCase()}`
}

/**
 * Who else already has this address.
 * A confirmed address (auth user or verified recovery email) stays taken.
 * A pending address counts only until its hold time, then it is free.
 * An unexpired rate row is the only pending hold; older recovery rows are ignored while it is live.
 */
export function emailHeldBy(input: {
  exceptId: string | null
  authId: string | null
  verifiedId: string | null
  pendingId: string | null
  pendingUntil: number | null
  rateId: string | null
  rateUntil: number | null
  now: number
}): string | null {
  for (const id of [input.authId, input.verifiedId]) {
    if (id && id !== input.exceptId) return id
  }
  const rateLive = input.rateId != null && input.rateUntil != null && input.rateUntil > input.now
  if (rateLive && input.rateId !== input.exceptId) return input.rateId
  if (
    !rateLive &&
    input.pendingId &&
    input.pendingId !== input.exceptId &&
    input.pendingUntil != null &&
    input.pendingUntil > input.now
  ) {
    return input.pendingId
  }
  return null
}
