/**
 * Server-side purchase PIN.
 * The working store is Netlify Blobs (no Supabase write).
 * A SQL copy of the hash runs only when ACCOUNT_LEDGER_ENABLED=1.
 * That flag is off until supabase/migration-005-coin-ledger.sql is applied.
 * This file never logs the PIN, the hash, or secrets.
 */
import { randomBytes } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { hashPin, pinMatches } from './pinHash.ts'
import {
  PIN_GRANT_MS,
  PIN_RESET_MS,
  emptyPinFails,
  isFourDigitPin,
  lockMessage,
  noteRightPin,
  noteWrongPin,
  pinLocked,
  resetStillOpen,
  resetUnlockedByEmail,
  type PinFailState,
} from '../../src/game/purchasePin.ts'

export const PIN_STORE = 'roman-purchase-pin'

interface PinRecord extends PinFailState {
  hash: string
  resetRequestedAt: number | null
}

interface GrantRecord {
  userId: string
  exp: number
  used: boolean
}

type BlobStore = {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown): Promise<unknown>
}

function store(): BlobStore {
  return getStore({ name: PIN_STORE, consistency: 'strong' }) as unknown as BlobStore
}

function pinKey(userId: string): string {
  return `pin/${userId}`
}

function grantKey(id: string): string {
  return `grant/${id}`
}

function asRecord(raw: unknown): PinRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PinRecord>
  if (typeof r.hash !== 'string' || !r.hash.startsWith('scrypt$')) return null
  return {
    hash: r.hash,
    fails: typeof r.fails === 'number' ? r.fails : 0,
    lockedUntil: typeof r.lockedUntil === 'number' ? r.lockedUntil : null,
    resetRequestedAt: typeof r.resetRequestedAt === 'number' ? r.resetRequestedAt : null,
  }
}

async function readPin(userId: string): Promise<PinRecord | null> {
  return asRecord(await store().get(pinKey(userId), { type: 'json' }))
}

async function writePin(userId: string, rec: PinRecord): Promise<void> {
  await store().setJSON(pinKey(userId), rec)
  await writeSqlPin(userId, rec)
}

export interface PinStatus {
  hasPin: boolean
  locked: boolean
  retryInMs: number
  resetReady: boolean
}

export async function pinStatus(userId: string, lastSignInAt: number | null, now = Date.now()): Promise<PinStatus> {
  const rec = await readPin(userId)
  if (!rec) return { hasPin: false, locked: false, retryInMs: 0, resetReady: false }
  const lock = pinLocked(rec, now)
  return {
    hasPin: true,
    locked: lock.locked,
    retryInMs: lock.retryInMs,
    resetReady: resetUnlockedByEmail(rec.resetRequestedAt, lastSignInAt, now),
  }
}

export type PinResult = { ok: true; grant?: string } | { ok: false; status: number; error: string }

function badPin(): PinResult {
  return { ok: false, status: 400, error: 'Choose a 4-digit PIN.' }
}

async function issueGrant(userId: string, now: number): Promise<string> {
  const id = randomBytes(32).toString('base64url')
  const grant: GrantRecord = { userId, exp: now + PIN_GRANT_MS, used: false }
  await store().setJSON(grantKey(id), grant)
  return id
}

export async function createPurchasePin(userId: string, pin: string, again: string, now = Date.now()): Promise<PinResult> {
  if (!isFourDigitPin(pin) || pin !== again) {
    return pin === again ? badPin() : { ok: false, status: 400, error: 'Those PINs did not match. Type the same 4 digits twice.' }
  }
  const existing = await readPin(userId)
  if (existing) return { ok: false, status: 409, error: 'A purchase PIN is already set. Enter it, or email a reset link.' }
  const rec: PinRecord = { hash: await hashPin(pin), ...emptyPinFails(), resetRequestedAt: null }
  await writePin(userId, rec)
  return { ok: true, grant: await issueGrant(userId, now) }
}

export async function verifyPurchasePin(userId: string, pin: string, now = Date.now()): Promise<PinResult> {
  const rec = await readPin(userId)
  if (!rec) return { ok: false, status: 404, error: 'Set a purchase PIN first.' }
  const lock = pinLocked(rec, now)
  if (lock.locked) return { ok: false, status: 429, error: lockMessage(lock.retryInMs) }
  if (!isFourDigitPin(pin) || !(await pinMatches(pin, rec.hash))) {
    const next = noteWrongPin(rec, now)
    await writePin(userId, { ...rec, ...next })
    const after = pinLocked(next, now)
    if (after.locked) return { ok: false, status: 429, error: lockMessage(after.retryInMs) }
    return { ok: false, status: 403, error: 'That PIN did not match.' }
  }
  await writePin(userId, { ...rec, ...noteRightPin(), resetRequestedAt: rec.resetRequestedAt })
  return { ok: true, grant: await issueGrant(userId, now) }
}

export async function requestPinReset(userId: string, email: string, redirectTo: string, send: (email: string, redirectTo: string) => Promise<boolean>, now = Date.now()): Promise<PinResult> {
  if (!email) return { ok: false, status: 400, error: "This account has no sign-in email." }
  const rec = await readPin(userId)
  if (!rec) return { ok: false, status: 404, error: 'Set a purchase PIN first.' }
  if (rec.resetRequestedAt != null && now >= rec.resetRequestedAt && now - rec.resetRequestedAt < 60_000) {
    return { ok: true }
  }
  const sent = await send(email, redirectTo)
  if (!sent) return { ok: false, status: 503, error: "Couldn't send the reset email. Try again in a minute." }
  await writePin(userId, { ...rec, resetRequestedAt: now })
  return { ok: true }
}

export async function resetPurchasePin(userId: string, pin: string, again: string, lastSignInAt: number | null, now = Date.now()): Promise<PinResult> {
  if (!isFourDigitPin(pin) || pin !== again) {
    return pin === again ? badPin() : { ok: false, status: 400, error: 'Those PINs did not match. Type the same 4 digits twice.' }
  }
  const rec = await readPin(userId)
  if (!rec || !resetStillOpen(rec.resetRequestedAt, now)) {
    return { ok: false, status: 403, error: 'That reset link has expired. Ask for a new one.' }
  }
  if (!resetUnlockedByEmail(rec.resetRequestedAt, lastSignInAt, now)) {
    return { ok: false, status: 403, error: 'Open the link in the sign-in email before choosing a new PIN.' }
  }
  await writePin(userId, { hash: await hashPin(pin), ...emptyPinFails(), resetRequestedAt: null })
  return { ok: true }
}

/** One checkout, then the grant is dead. A new purchase asks for the PIN again. */
export async function consumePinGrant(userId: string, grantId: string, now = Date.now()): Promise<boolean> {
  if (!grantId || grantId.length < 20 || grantId.length > 120) return false
  const key = grantKey(grantId)
  const raw = (await store().get(key, { type: 'json' })) as Partial<GrantRecord> | null
  if (!raw || raw.userId !== userId || raw.used === true) return false
  if (typeof raw.exp !== 'number' || raw.exp < now) return false
  await store().setJSON(key, { userId, exp: raw.exp, used: true })
  return true
}

export function resetRedirect(siteBase: string): string {
  return `${siteBase.replace(/\/$/, '')}/?purchase-pin=reset`
}

export const RESET_WINDOW_MS = PIN_RESET_MS

/**
 * Optional SQL copy of the hash. Off unless ACCOUNT_LEDGER_ENABLED=1.
 * The table is in supabase/migration-005-coin-ledger.sql, which is NOT APPLIED.
 */
async function writeSqlPin(userId: string, rec: PinRecord): Promise<void> {
  if (process.env.ACCOUNT_LEDGER_ENABLED !== '1') return
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return
  try {
    await fetch('https://oelsglmfkpzbueqysvdm.supabase.co/rest/v1/purchase_pins?on_conflict=user_id', {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        pin_hash: rec.hash,
        fails: rec.fails,
        locked_until: rec.lockedUntil ? new Date(rec.lockedUntil).toISOString() : null,
      }),
    })
  } catch {
    /* The blob already holds the hash. */
  }
}
