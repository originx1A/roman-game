import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const A = await import('../netlify/lib/ownerAuth.ts')
const S = await import('../netlify/lib/analytics.ts')

const env = { ROMAN_OWNER_KEY: 'correct horse battery' }
const ID = 'b'.repeat(32)
const ID2 = 'c'.repeat(32)

test('admin lock: nothing passes without the password or a valid token', () => {
  assert.equal(A.credentialsOk([], env), false)
  assert.equal(A.credentialsOk(['nope'], env), false)
  assert.equal(A.credentialsOk(['correct horse battery'], env), true, 'password works (older owner pages send {key})')
  assert.equal(A.credentialsOk(['correct horse battery'], {}), false, 'no env var → locked')
})

test('admin lock: login token is signed, expires, and dies when the password changes or on log out everywhere', () => {
  const now = Date.UTC(2026, 9, 9, 22)
  const t = A.makeOwnerToken(env, now)!
  assert.ok(t.token.startsWith(A.TOKEN_PREFIX))
  assert.ok(!t.token.includes('correct horse'), 'token never carries the password')
  assert.ok(A.verifyOwnerToken(t.token, env, now + 1000))
  assert.ok(A.credentialsOk([t.token], env, now + 1000))
  assert.equal(A.verifyOwnerToken(t.token, env, now + 31 * 86_400_000), null, 'expired after 30 days')
  assert.equal(A.verifyOwnerToken(t.token, { ROMAN_OWNER_KEY: 'new pw' }, now + 1000), null, 'new password logs every device out')
  assert.equal(A.verifyOwnerToken(t.token, env, now + 1000, now + 1), null, 'log out everywhere')
  const [body, sig] = t.token.slice(A.TOKEN_PREFIX.length).split('.')
  const forged = Buffer.from(JSON.stringify({ v: 1, iat: now, exp: now + 999 * 86_400_000 })).toString('base64url')
  assert.equal(A.verifyOwnerToken(`${A.TOKEN_PREFIX}${forged}.${sig}`, env, now), null, 'edited token rejected')
  assert.equal(A.verifyOwnerToken(`${A.TOKEN_PREFIX}${body}.`, env, now), null)
  assert.equal(A.credentialsOk([`${A.TOKEN_PREFIX}${body}.x`], env, now), false)
})

test('admin lock: credentials come from token, key or a Bearer header', () => {
  const req = new Request('https://x/api/a', { method: 'POST', headers: { authorization: 'Bearer abc' } })
  assert.deepEqual(A.credentialsOf(req, { token: 't', key: 'k' }), ['t', 'k', 'abc'])
  assert.deepEqual(A.credentialsOf(null, null), [])
})

test('admin lock: every owner function goes through the gate; the owner page has no password-free mode', () => {
  for (const f of ['gift-create', 'analytics-stats', 'analytics-manage', 'owner-purchases', 'bug-list', 'bug-resolve']) {
    const src = readFileSync(new URL(`../netlify/functions/${f}.ts`, import.meta.url), 'utf8')
    assert.match(src, /await ownerGate\(req\)/, `${f} is gated`)
    assert.match(src, /if \(gate\.res\) return gate\.res/, `${f} stops when the gate says no`)
  }
  const page = readFileSync(new URL('../src/components/OwnerGifts.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /makeLocalGiftCode/, 'no local gift codes without the server')
  assert.doesNotMatch(page, /status === 'offline' \? \(\s*<p className="owner-warn">🎁 Free mode/, 'no free mode')
  assert.match(page, /\(status === 'ready' && unlocked\) \? |status === 'ready' && unlocked \? \(\s*<div className="owner-card" data-testid="owner-gifts">/)
  assert.doesNotMatch(readFileSync(new URL('../src/components/OwnerGifts.tsx', import.meta.url), 'utf8'), /ROMAN_OWNER_KEY\s*=|correct horse/)
})

test('stats: sessions give who played and for how long, with daily totals', () => {
  const ev = (t: string, id: string, e: string, extra: Record<string, unknown> = {}) => ({ t, id, ev: e, city: 'Toronto', region: 'Ontario', country: 'CA', ...extra }) as never
  const events = [
    ev('2026-10-09T14:00:00.000Z', ID, 'app_open'),
    ev('2026-10-09T14:05:00.000Z', ID, 'level_clear', { size: 5, ms: 60000 }),
    ev('2026-10-09T14:10:00.000Z', ID, 'session_end', { ms: 600_000 }),
    ev('2026-10-09T15:00:00.000Z', ID2, 'app_open'),
    ev('2026-10-09T15:02:00.000Z', ID2, 'session_end', { ms: 120_000 }),
    ev('2026-10-08T15:00:00.000Z', ID, 'app_open'),
    ev('2026-10-08T15:30:00.000Z', ID, 'session_end', { ms: 1_800_000 }),
    ev('2026-10-09T15:03:00.000Z', ID2, 'level_abandon', { size: 7 }),
    ev('2026-10-09T15:04:00.000Z', ID2, 'share'),
  ]
  const s = S.aggregate(events, 7)
  assert.equal(s.uniquePlayers, 2)
  assert.equal(s.sessionsCounted, 3)
  assert.equal(s.totalPlaySec, 600 + 120 + 1800)
  assert.equal(s.avgSessionSec, 840)
  assert.equal(s.shares, 1)
  assert.deepEqual(s.abandonsBySize, [{ size: 7, count: 1 }])
  assert.deepEqual(s.daily.map((d) => [d.day, d.players, d.sessions, d.playSec, d.levels]), [
    ['2026-10-09', 2, 2, 720, 1],
    ['2026-10-08', 1, 1, 1800, 0],
  ])
  const p1 = s.players.find((p) => p.player === ID.slice(0, 8))!
  assert.equal(p1.playSec, 2400)
  assert.equal(p1.days, 2)
  assert.equal(p1.levels, 1)
  assert.equal(s.players[0].player, ID2.slice(0, 8), 'most recently seen first')
  assert.equal(s.recentSessions[0].sec, 120)
  assert.ok(!JSON.stringify(s).includes(ID), 'full device ids never leave the server')
})

test('stats: session_end needs a real length; silly lengths are capped', () => {
  assert.equal(S.buildEvent({ id: ID, ev: 'session_end', ms: 10 }, undefined), null)
  assert.equal(S.buildEvent({ id: ID, ev: 'session_end' }, undefined), null)
  assert.equal(S.buildEvent({ id: ID, ev: 'session_end', ms: 99 * 3_600_000 }, undefined)!.ms, S.SESSION_MAX_MS)
  assert.equal(S.buildEvent({ id: ID, ev: 'story_end' }, undefined)!.ev, 'story_end')
  assert.equal(S.buildEvent({ id: ID, ev: 'level_abandon', size: 6 }, undefined)!.size, 6)
})
