/**
 * 9.33-b: one name, and Save respects the real session.
 * Covers the pure pieces of the fix: name derivation priority, the local sign-in
 * seeding/backfill (this is also the cloud bridge's profile creation — App calls
 * signInWithEmail(cloud.email, cloud.name) verbatim, so the guest-progress merge
 * tested here IS the bridge merge), and remembered consent incl. the Terms box.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)

// storage.ts and cloud.ts read the global localStorage: swap in a fresh in-memory
// one per test so cases can't leak into each other.
function freshStorage() {
  const mem = new Map<string, string>()
  const st = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  }
  ;(globalThis as { localStorage?: unknown }).localStorage = st
  return mem
}

const S = await import('../src/game/storage.ts')
const C = await import('../src/cloud/cloud.ts')

const clear = (puzzleId: string, bestScore = 100) => ({
  puzzleId,
  bestMs: 60_000,
  bestScore,
  clears: 1,
  hintsOnBest: 0,
  clearedAt: '2026-11-04T00:00:00.000Z',
  lastClearedAt: '2026-11-04T00:00:00.000Z',
})

test('deriveDisplayName: server public name wins, then server name, device name, profile name', () => {
  assert.equal(
    S.deriveDisplayName({ publicName: 'Alex02', cloudName: 'Alex', playerName: 'Al', profileName: 'Alexander' }),
    'Alex02',
  )
  assert.equal(S.deriveDisplayName({ publicName: undefined, cloudName: 'Alex', playerName: 'Al' }), 'Alex')
  assert.equal(S.deriveDisplayName({ cloudName: null, playerName: 'Al', profileName: 'Alexander' }), 'Al')
  assert.equal(S.deriveDisplayName({ profileName: 'Alexander' }), 'Alexander')
  assert.equal(S.deriveDisplayName({}), '')
})

test('deriveDisplayName: blank and whitespace values count as missing', () => {
  assert.equal(S.deriveDisplayName({ publicName: '  ', cloudName: '', playerName: ' Sam ' }), 'Sam')
  assert.equal(S.deriveDisplayName({ publicName: null, cloudName: null, playerName: null, profileName: null }), '')
})

test('bridge merge: guest clears move into the profile signInWithEmail creates', () => {
  freshStorage()
  S.saveGuestProgress({ clears: [clear('lvl-1'), clear('lvl-2', 250)], totalScore: 350 })
  const p = S.signInWithEmail('bridge@example.com', 'Bridge Name')
  assert.equal(p.email, 'bridge@example.com')
  assert.equal(p.clears.length, 2, 'guest clears carried into the new profile')
  assert.equal(p.totalScore, 350)
  assert.equal(S.getProgress().clears.length, 2, 'progress source now reads the merged clears')
  assert.equal(S.loadProfile()?.email, 'bridge@example.com')
})

test('sign-in seeding: an existing device name beats the email-prefix guess', () => {
  freshStorage()
  S.saveSettings({ ...S.loadSettings(), playerName: 'Zoe' })
  const p = S.signInWithEmail('someone.else@example.com')
  assert.equal(p.displayName, 'Zoe')
})

test('sign-in seeding: an explicit name (the cloud name, via the bridge) beats the device name', () => {
  freshStorage()
  S.saveSettings({ ...S.loadSettings(), playerName: 'Zoe' })
  const p = S.signInWithEmail('zoe@example.com', 'Zoe Online')
  assert.equal(p.displayName, 'Zoe Online')
})

test('sign-in seeding: no name anywhere falls back to the email prefix', () => {
  freshStorage()
  const p = S.signInWithEmail('sam.river@example.com')
  assert.equal(p.displayName, 'Sam River')
})

test('sign-in backfill: an empty device name is filled from the new profile', () => {
  freshStorage()
  S.signInWithEmail('sam.river@example.com')
  assert.equal(S.loadSettings().playerName, 'Sam River')
})

test('sign-in backfill: an existing device name is never overwritten', () => {
  freshStorage()
  S.saveSettings({ ...S.loadSettings(), playerName: 'Zoe' })
  S.signInWithEmail('zoe@example.com', 'Zoe Online')
  assert.equal(S.loadSettings().playerName, 'Zoe')
})

test('same-email sign-in returns the existing profile untouched (bridge never re-stamps)', () => {
  freshStorage()
  const first = S.signInWithEmail('sam@example.com', 'Sam')
  S.recordClear({ puzzleId: 'lvl-9', elapsedMs: 42_000, score: 500, hintsUsed: 0 })
  const again = S.signInWithEmail('sam@example.com', 'A Different Name')
  assert.equal(again.displayName, 'Sam')
  assert.equal(again.createdAt, first.createdAt)
  assert.equal(S.getProgress().clears.some((c) => c.puzzleId === 'lvl-9'), true, 'recorded clears survive')
})

test('consent: the Terms choice round-trips with the other two boxes', () => {
  freshStorage()
  C.saveConsent({ age13: true, optIn: true, terms: true })
  assert.deepEqual(C.loadConsent(), { age13: true, optIn: true, terms: true })
  C.saveConsent({ age13: true, optIn: false, terms: false })
  assert.deepEqual(C.loadConsent(), { age13: true, optIn: false, terms: false })
})

test('consent: older saves without a Terms field load with terms = false', () => {
  const mem = freshStorage()
  mem.set('rg.cloud.consent.v1', JSON.stringify({ age13: true, optIn: true }))
  assert.deepEqual(C.loadConsent(), { age13: true, optIn: true, terms: false })
})

test('consent: a blob without a boolean age13 is still rejected', () => {
  const mem = freshStorage()
  mem.set('rg.cloud.consent.v1', JSON.stringify({ optIn: true, terms: true }))
  assert.equal(C.loadConsent(), null)
  mem.set('rg.cloud.consent.v1', 'not json')
  assert.equal(C.loadConsent(), null)
})
