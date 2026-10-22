/** Server rules for turning payments on and for the parent's sticky off switch. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function receiptEmailOk(email: unknown): email is string {
  if (typeof email !== 'string') return false
  const clean = email.trim().toLowerCase()
  if (clean.length < 6 || clean.length > 120) return false
  if (!EMAIL_RE.test(clean)) return false
  if (clean.endsWith('@link.romansgame.invalid') || clean.endsWith('@romansgame.invalid')) return false
  return true
}

export function cleanReceiptEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type EnableDecision =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Payments turn on only after an adult attestation, a receipt email, and the terms tick.
 * A parent lock is sticky: this call cannot clear it.
 * age_13_plus is read from players and is not written here.
 */
export function enablePaymentsDecision(input: {
  adult: boolean
  terms: boolean
  email: unknown
  age13Plus: boolean | null
  parentLocked: boolean
}): EnableDecision {
  if (input.parentLocked) {
    return { ok: false, status: 403, error: 'A parent turned payments off. They have to turn them back on.' }
  }
  if (input.age13Plus !== true) return { ok: false, status: 403, error: 'Payments stay off on this account.' }
  if (input.adult !== true) {
    return { ok: false, status: 400, error: 'Payments can be turned on only by an adult who holds the card.' }
  }
  if (input.terms !== true) return { ok: false, status: 400, error: 'Accept the terms to turn payments on.' }
  if (!receiptEmailOk(input.email)) return { ok: false, status: 400, error: 'Add an email for receipts.' }
  return { ok: true }
}

export type ParentSwitchResult =
  | { ok: true; parentLocked: boolean; paymentsEnabled: boolean }
  | { ok: false; status: number; error: string }

/**
 * Only a linked parent can flip the switch. Off sticks until that parent turns it on.
 * The child account cannot call this successfully.
 */
export function parentSwitch(input: {
  callerIsParent: boolean
  action: 'off' | 'on'
  attested: boolean
}): ParentSwitchResult {
  if (!input.callerIsParent) return { ok: false, status: 403, error: 'Only a linked parent can change this.' }
  if (input.action === 'off') return { ok: true, parentLocked: true, paymentsEnabled: false }
  return { ok: true, parentLocked: false, paymentsEnabled: input.attested }
}

export function parentSlotsLeft(activeOrPending: number): boolean {
  return activeOrPending < 2
}

export const PROFILE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export function parseSaveBody(body: unknown): { ok: true; profileId: string; blob: Record<string, unknown>; chapters: string[]; videos: string[]; cards: string[] } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing save.' }
  const raw = body as Record<string, unknown>
  const profileId = typeof raw.profileId === 'string' ? raw.profileId : ''
  if (!PROFILE_ID_RE.test(profileId)) return { ok: false, error: 'Missing profile.' }
  if (!raw.blob || typeof raw.blob !== 'object' || Array.isArray(raw.blob)) return { ok: false, error: 'Missing save.' }
  const blob = raw.blob as Record<string, unknown>
  const encoded = JSON.stringify(blob)
  if (encoded.length > 262144) return { ok: false, error: 'That save is too big.' }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(encoded)) return { ok: false, error: 'Keep email out of the save.' }
  const chapters = idList(raw.chapters)
  const videos = idList(raw.videos)
  const cards = idList(raw.cards)
  if (!chapters || !videos || !cards) return { ok: false, error: 'Missing save.' }
  return { ok: true, profileId, blob, chapters, videos, cards }
}

function idList(value: unknown): string[] | null {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 200) return null
  const ids: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0 && item.length <= 80) ids.push(item)
    else return null
  }
  return ids
}
