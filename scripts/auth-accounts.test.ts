import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { handleAuth, readCaptchaToken, type AuthDeps, type AuthRoute } from '../netlify/lib/authHandler.ts'
import { ABSOLUTE_SHORT_MS, ABSOLUTE_STAY_MS, IDLE_MS, sessionExpired } from '../netlify/lib/sessionClock.ts'
import { DAY, HOUR, MINUTE, accountCheckIpBlocked, emptyLimit, nextLockMs, noteAccountCheck, noteSigninAttempt, noteSigninFailure, noteSignupAttempt, signinIpBlocked, signupIpBlocked } from '../netlify/lib/authLimits.ts'
import { hashCard, hashCode, hashIp, hashUa, scrubMetadata } from '../netlify/lib/authCrypto.ts'
import { COMMON_PASSWORDS } from '../netlify/lib/commonPasswords.ts'
import { hibpRange } from '../netlify/lib/hibp.ts'
import { NAME_FILTER } from '../netlify/lib/nameFilterData.ts'
import { decideName, publicDisplayName } from '../netlify/lib/namePolicy.ts'
import { passwordRejectReason } from '../netlify/lib/passwordPolicy.ts'
import { playerInsert, profileInsert } from '../netlify/lib/authTypes.ts'
import { TURNSTILE_HOSTS, TURNSTILE_SITE_KEY } from '../src/game/turnstileSite.ts'
import { MemoryAuth } from './authMemory.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const TOKEN = '0x4AAAAAAFfTs2hm1baT01HK'
const PASSWORD = 'lantern-river-stone'
const NOW = Date.parse('2026-10-21T16:00:00.000Z')

function deps(backend: MemoryAuth, now = NOW) {
  let cards = 0
  const sent: { email: string; code: string; purpose: string }[] = []
  const authDeps: AuthDeps = {
    now: () => now,
    backend,
    hibp: async (password) => (password.includes('pwned-secret') ? 'pwned' : 'clear'),
    hashIp,
    hashUa,
    hashCode,
    hashCard,
    newCode: () => '654321',
    newCard: () => {
      cards += 1
      return `CARD-NEW${cards}-NEW${cards}-NEW${cards}`
    },
    sendCode: async (email, code, purpose) => {
      sent.push({ email, code, purpose })
    },
  }
  return { authDeps, sent }
}

function call(
  route: AuthRoute,
  body: unknown,
  authDeps: AuthDeps,
  headers: Record<string, string> = {},
  method = 'POST',
) {
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'https://play.romansgame.com',
      'x-nf-client-connection-ip': '203.0.113.10',
      ...headers,
    },
  }
  if (method !== 'GET' && method !== 'OPTIONS') init.body = JSON.stringify(body)
  const req = new Request(`https://play.romansgame.com/api/auth/${route}`, init)
  return handleAuth(req, route, authDeps)
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

test('names normalize, and the filter rejects reserved, leet, and PII', () => {
  const cool = decideName('Cool Kid')
  assert.equal(cool.ok, true)
  if (cool.ok) assert.equal(cool.normalized, 'cool-kid')
  const wide = decideName('Ｃｏｏｌ')
  assert.equal(wide.ok, true)
  if (wide.ok) assert.equal(wide.normalized, 'cool')
  assert.equal(decideName('ab').ok, false)
  assert.equal(decideName('1abc').ok, false)
  assert.equal(decideName('ab_c').ok, false)
  assert.equal(decideName('admin').ok, false)
  assert.equal(decideName('ad-min').ok, false)
  const leet = decideName('sh1t')
  assert.equal(leet.ok, false)
  if (!leet.ok) assert.equal(leet.reason, 'profanity')
  const exact = decideName('a55')
  assert.equal(exact.ok, false)
  assert.equal(decideName('Cassidy').ok, true)
  const phone = decideName('phone-5551234')
  assert.equal(phone.ok, false)
  if (!phone.ok) {
    assert.equal(phone.reason, 'pii')
    assert.equal(phone.normalized, null)
  }
  const handle = decideName('kid@mail.com')
  assert.equal(handle.ok, false)
  if (!handle.ok) assert.equal(handle.normalized, null)
  assert.equal(publicDisplayName('Cool Kid'), 'Cool')
  assert.equal(publicDisplayName('shit head'), '')
})

test('passwords reject length, the player name, and the common list', () => {
  assert.equal(passwordRejectReason('short', []), 'short')
  assert.equal(passwordRejectReason('x'.repeat(129), []), 'long')
  assert.equal(passwordRejectReason('coolkidxxxx', ['Cool Kid', 'cool-kid']), 'name')
  assert.equal(passwordRejectReason('qwertyuiop', []), 'common')
  assert.equal(passwordRejectReason(PASSWORD, ['Cool Kid', 'cool-kid']), null)
  assert.equal(COMMON_PASSWORDS.size, 10000)
})

test('HIBP uses the first five SHA-1 characters and fails open', async () => {
  const sha1 = createHash('sha1').update('secret').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  let called = ''
  const hit = await hibpRange('secret', async (url) => {
    called = String(url)
    return new Response(`${suffix}:10\nABCDE:1\n`)
  })
  assert.equal(hit, 'pwned')
  assert.ok(called.endsWith(`/${prefix}`))
  assert.equal(await hibpRange('secret', async () => { throw new Error('down') }), 'unknown')
})

test('sign-in locks grow from 15 minutes to an hour, and IP and signup windows hold', () => {
  let name = emptyLimit()
  let ip = emptyLimit()
  const start = NOW
  for (let i = 0; i < 4; i++) {
    const noted = noteSigninFailure(name, ip, start + i)
    name = noted.name
    ip = noted.ip
    assert.equal(noted.locked, false)
  }
  const fifth = noteSigninFailure(name, ip, start + 4)
  assert.equal(fifth.locked, true)
  assert.equal(fifth.name.lockedUntil, start + 4 + nextLockMs(0))
  assert.equal(nextLockMs(0), 15 * MINUTE)
  assert.equal(nextLockMs(1), 30 * MINUTE)
  assert.equal(nextLockMs(2), 60 * MINUTE)
  assert.equal(nextLockMs(3), 60 * MINUTE)

  let hits = emptyLimit()
  for (let i = 0; i < 19; i++) hits = noteSigninAttempt(hits, start)
  assert.equal(signinIpBlocked(hits, start), false)
  hits = noteSigninAttempt(hits, start)
  assert.equal(signinIpBlocked(hits, start), true)

  let signups = emptyLimit()
  for (let i = 0; i < 4; i++) signups = noteSignupAttempt(signups, start)
  assert.equal(signupIpBlocked(signups, start), false)
  signups = noteSignupAttempt(signups, start)
  assert.equal(signupIpBlocked(signups, start), true)
})

test('signup returns the face session and the public first word', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const created = await call('signup', { name: 'Cool Kid', password: PASSWORD, email: 'kid@example.com', captchaToken: TOKEN, stay_signed_in: true }, authDeps)
  assert.equal(created.status, 201)
  const body = await json(created)
  const session = body.session as { access_token: string; refresh_token: string }
  assert.equal(typeof session.access_token, 'string')
  assert.equal(typeof session.refresh_token, 'string')
  assert.equal(body.display_name, 'Cool')
  assert.equal(body.stay_signed_in, true)
  const until = Date.parse(String(body.absolute_until))
  assert.equal(until - NOW, 90 * DAY)
  assert.equal(backend.captchaUses.some((use) => use.token === TOKEN), true)

  const again = await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps)
  assert.equal(again.status, 409)
  assert.deepEqual(await json(again), { error: 'name_taken' })
})

test('signup rejects a bad name, a weak password, and a missing captcha token', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const unnamed = await call('signup', { name: 'ab', password: PASSWORD, captchaToken: TOKEN }, authDeps)
  assert.equal(unnamed.status, 422)
  assert.equal((await json(unnamed)).error, 'name_rejected')
  const weak = await call('signup', { name: 'Bright Fox', password: 'short', captchaToken: TOKEN }, authDeps)
  assert.equal(weak.status, 422)
  assert.equal((await json(weak)).error, 'weak_password')
  const bare = await call('signup', { name: 'Bright Fox', password: PASSWORD }, authDeps)
  assert.equal(bare.status, 403)
  assert.equal((await json(bare)).error, 'turnstile_required')
  assert.equal(backend.profiles.size, 0)
})

test('unknown names and wrong passwords return the same body', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  assert.equal((await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps)).status, 201)
  const unknown = await call('signin', { name: 'Other Kid', password: 'not-the-one', captchaToken: TOKEN }, authDeps)
  const wrong = await call('signin', { name: 'Cool Kid', password: 'not-the-one', captchaToken: TOKEN }, authDeps)
  assert.equal(unknown.status, wrong.status)
  assert.equal(unknown.status, 401)
  const unknownBody = await json(unknown)
  const wrongBody = await json(wrong)
  assert.deepEqual(unknownBody, wrongBody)
  assert.deepEqual(wrongBody, { error: 'invalid_credentials' })
  const bareUnknown = await call('signin', { name: 'Other Kid', password: 'not-the-one' }, authDeps)
  const bareWrong = await call('signin', { name: 'Cool Kid', password: PASSWORD }, authDeps)
  assert.equal(bareUnknown.status, 403)
  assert.equal(bareWrong.status, 403)
  assert.deepEqual(await json(bareUnknown), { error: 'turnstile_required' })
  assert.deepEqual(await json(bareWrong), { error: 'turnstile_required' })
})

test('a captcha rejection is not counted as a password failure', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps)
  backend.failCaptcha = true
  const rejected = await call('signin', { name: 'Cool Kid', password: 'not-the-one', turnstile_token: `  ${TOKEN}  ` }, authDeps)
  assert.equal(rejected.status, 403)
  const row = await backend.getLimit('signin_name', 'cool-kid')
  assert.equal(row.failures.length, 0)
  assert.equal(backend.captchaUses.at(-1)?.token, TOKEN)
})

test('stay_signed_in false expires in 12 hours', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const created = await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN, stay_signed_in: false }, authDeps)
  const body = await json(created)
  assert.equal(body.stay_signed_in, false)
  assert.equal(Date.parse(String(body.absolute_until)) - NOW, 12 * HOUR)
})

test('the fifth sign-in failure locks the name', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps)
  let last = 0
  for (let i = 0; i < 5; i++) {
    const res = await call('signin', { name: 'Cool Kid', password: 'not-the-one', captchaToken: TOKEN }, authDeps)
    last = res.status
  }
  assert.equal(last, 429)
  const locked = await call('signin', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps)
  assert.equal(locked.status, 429)
  assert.deepEqual(await json(locked), { error: 'rate_limited' })
})

test('the 21st sign-in from one IP is limited', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  for (let i = 0; i < 20; i++) {
    const res = await call('signin', { name: `player${i}x`, password: 'not-the-one', captchaToken: TOKEN }, authDeps)
    assert.equal(res.status, 401)
  }
  const blocked = await call('signin', { name: 'player99x', password: 'not-the-one', captchaToken: TOKEN }, authDeps)
  assert.equal(blocked.status, 429)
})

test('a recovery card works once and returns a new payload', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const playerId = String(created.user_id)
  const card = 'CARD-ABCD-EFGH-JKLM'
  backend.addCard(playerId, hashCard(card))
  const weak = await call('recover-card', { card_token: card, new_password: 'short', captchaToken: TOKEN }, authDeps)
  assert.equal(weak.status, 422)
  assert.equal(backend.cards[0]?.usedAt, null)
  const ok = await call('recover-card', { card_token: card, new_password: 'river-stone-lantern', turnstile_token: TOKEN }, authDeps)
  assert.equal(ok.status, 200)
  const body = await json(ok)
  assert.equal(typeof body.qr_payload, 'string')
  assert.match(String(body.qr_payload), /^CARD-/)
  const again = await call('recover-card', { card_token: card, new_password: 'river-stone-lantern', captchaToken: TOKEN }, authDeps)
  assert.equal(again.status, 401)
  const rotated = await call('recover-card', { card_token: body.qr_payload, new_password: 'lantern-stone-river', captchaToken: TOKEN }, authDeps)
  assert.equal(rotated.status, 200)
})

test('a parent can reset a linked child and cannot reset anyone else', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const parent = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const child = await json(await call('signup', { name: 'Bright Fox', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const parentId = String(parent.user_id)
  const childId = String(child.user_id)
  const headers = { authorization: `Bearer ${(parent.session as { access_token: string }).access_token}` }
  const missing = await call('recover-parent', { child_user_id: childId, new_password: 'river-stone-lantern', current_password: PASSWORD }, authDeps, headers)
  assert.equal(missing.status, 403)
  assert.deepEqual(await json(missing), { error: 'not_parent' })
  backend.parents.add(`${parentId}:${childId}`)
  const ok = await call('recover-parent', { child_user_id: childId, new_password: 'river-stone-lantern', current_password: PASSWORD, captchaToken: TOKEN }, authDeps, headers)
  assert.equal(ok.status, 200)
  assert.deepEqual(await json(ok), { ok: true })
  assert.equal(backend.passwords.get('bright-fox'), 'river-stone-lantern')
  assert.equal(backend.revokes.some((row) => row.playerId === childId && row.scope === 'global'), true)
})

test('password change revokes other sessions and sign-out is 204', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const access = (created.session as { access_token: string }).access_token
  const headers = { authorization: `Bearer ${access}` }
  const changed = await call('password-change', { current_password: PASSWORD, new_password: 'river-stone-lantern', captchaToken: TOKEN }, authDeps, headers)
  assert.equal(changed.status, 200)
  assert.equal(backend.revokes.some((row) => row.scope === 'others'), true)
  const signedOut = await call('signout', { all_devices: true }, authDeps, headers)
  assert.equal(signedOut.status, 204)
  assert.equal(backend.revokes.some((row) => row.scope === 'global'), true)
  const missing = await call('signout', {}, authDeps)
  assert.equal(missing.status, 401)
})

test('audit rows keep no password, token, or email', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  await call('signup', { name: 'Cool Kid', password: PASSWORD, email: 'kid@example.com', captchaToken: TOKEN }, authDeps)
  const dumped = JSON.stringify(backend.audits)
  assert.equal(dumped.includes(PASSWORD), false)
  assert.equal(dumped.includes(TOKEN), false)
  assert.equal(dumped.includes('kid@example.com'), false)
  assert.deepEqual(scrubMetadata({ password: PASSWORD, email: 'kid@example.com', ok: true, captchaToken: TOKEN }), { ok: true })
})

test('the session clock expires idle stay-signed-in rows and short rows at 12 hours', () => {
  const start = NOW
  assert.equal(sessionExpired({ stay: true, createdAt: start, lastSeenAt: start, absoluteUntil: start + ABSOLUTE_STAY_MS }, start + IDLE_MS - 1), null)
  assert.equal(sessionExpired({ stay: true, createdAt: start, lastSeenAt: start, absoluteUntil: start + ABSOLUTE_STAY_MS }, start + IDLE_MS), 'idle')
  assert.equal(
    sessionExpired({ stay: true, createdAt: start, lastSeenAt: start + 80 * 24 * 60 * 60 * 1000, absoluteUntil: start + ABSOLUTE_STAY_MS }, start + ABSOLUTE_STAY_MS),
    'absolute',
  )
  assert.equal(sessionExpired({ stay: false, createdAt: start, lastSeenAt: start, absoluteUntil: start + ABSOLUTE_SHORT_MS }, start + ABSOLUTE_SHORT_MS - 1), null)
  assert.equal(sessionExpired({ stay: false, createdAt: start, lastSeenAt: start, absoluteUntil: start + ABSOLUTE_SHORT_MS }, start + ABSOLUTE_SHORT_MS), 'absolute')
})

test('refresh moves last_seen_at and revokes an idle or 90-day session', async () => {
  const backend = new MemoryAuth()
  const clock = { now: NOW }
  const { authDeps } = deps(backend, NOW)
  authDeps.now = () => clock.now
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN, stay_signed_in: true }, authDeps))
  const first = created.session as { refresh_token: string }
  const device = [...backend.devices.values()][0]
  assert.ok(device)
  assert.equal(device.createdAt, NOW)
  assert.equal(device.lastSeenAt, NOW)

  clock.now = NOW + 10 * 24 * 60 * 60 * 1000
  const refreshed = await call('refresh', { refresh_token: first.refresh_token }, authDeps)
  assert.equal(refreshed.status, 200)
  const next = await json(refreshed)
  assert.equal(typeof (next.session as { access_token: string }).access_token, 'string')
  assert.equal(device.createdAt, NOW)
  assert.equal(device.lastSeenAt, clock.now)
  const rotated = (next.session as { refresh_token: string }).refresh_token
  assert.notEqual(rotated, first.refresh_token)

  clock.now = NOW + ABSOLUTE_STAY_MS
  const tooOld = await call('refresh', { refresh_token: rotated }, authDeps)
  assert.equal(tooOld.status, 401)
  assert.deepEqual(await json(tooOld), { error: 'session_expired' })
  assert.equal(backend.revokes.some((row) => row.scope === 'local'), true)
})

test('an idle stay-signed-in refresh is revoked before the 90-day cap', async () => {
  const backend = new MemoryAuth()
  const clock = { now: NOW }
  const { authDeps } = deps(backend, NOW)
  authDeps.now = () => clock.now
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const refreshToken = (created.session as { refresh_token: string }).refresh_token
  clock.now = NOW + IDLE_MS
  const idle = await call('refresh', { refresh_token: refreshToken }, authDeps)
  assert.equal(idle.status, 401)
  assert.deepEqual(await json(idle), { error: 'session_expired' })
})

test('stay_signed_in false expires 12 hours after sign-in', async () => {
  const backend = new MemoryAuth()
  const clock = { now: NOW }
  const { authDeps } = deps(backend, NOW)
  authDeps.now = () => clock.now
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN, stay_signed_in: false }, authDeps))
  const refreshToken = (created.session as { refresh_token: string }).refresh_token
  clock.now = NOW + ABSOLUTE_SHORT_MS - 60_000
  const ok = await call('refresh', { refresh_token: refreshToken }, authDeps)
  assert.equal(ok.status, 200)
  const rotated = ((await json(ok)).session as { refresh_token: string }).refresh_token
  clock.now = NOW + ABSOLUTE_SHORT_MS
  const expired = await call('refresh', { refresh_token: rotated }, authDeps)
  assert.equal(expired.status, 401)
  assert.deepEqual(await json(expired), { error: 'session_expired' })
})

test('a bearer auth call rejects an expired session', async () => {
  const backend = new MemoryAuth()
  const clock = { now: NOW }
  const { authDeps } = deps(backend, NOW)
  authDeps.now = () => clock.now
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const access = (created.session as { access_token: string }).access_token
  clock.now = NOW + IDLE_MS
  const changed = await call(
    'password-change',
    { current_password: PASSWORD, new_password: 'river-stone-lantern', captchaToken: TOKEN },
    authDeps,
    { authorization: `Bearer ${access}` },
  )
  assert.equal(changed.status, 401)
  assert.deepEqual(await json(changed), { error: 'session_expired' })
  assert.equal(backend.revokes.some((row) => row.scope === 'local'), true)
})

test('account check says new or existing and never returns an email', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  await call('signup', { name: 'Cool Kid', password: PASSWORD, email: 'kid@example.com', captchaToken: TOKEN }, authDeps)
  const existing = await call('account', { name: 'Cool Kid', email: 'kid@example.com' }, authDeps)
  const fresh = await call('account', { name: 'Other Kid', email: 'other@example.com' }, authDeps)
  assert.equal(existing.status, 200)
  assert.equal(fresh.status, 200)
  assert.deepEqual(await json(existing), { account: 'existing' })
  assert.deepEqual(await json(fresh), { account: 'new' })
  const onlyEmail = await call('account', { email: 'secret@example.com' }, authDeps)
  assert.equal(onlyEmail.status, 422)
  assert.deepEqual(await json(onlyEmail), { error: 'name_rejected' })
  const dumped = JSON.stringify(backend.audits)
  assert.equal(dumped.includes('kid@example.com'), false)
  assert.equal(dumped.includes('secret@example.com'), false)
  assert.equal(dumped.includes('other@example.com'), false)
})

test('account check rate limit is the same response for every name', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  for (let i = 0; i < 30; i++) {
    const res = await call('account', { name: `kidname${i}` }, authDeps)
    assert.equal(res.status, 200)
  }
  const blocked = await call('account', { name: 'Cool Kid', email: 'kid@example.com' }, authDeps)
  assert.equal(blocked.status, 429)
  assert.deepEqual(await json(blocked), { error: 'rate_limited' })
  let row = emptyLimit()
  for (let i = 0; i < 29; i++) row = noteAccountCheck(row, NOW)
  assert.equal(accountCheckIpBlocked(row, NOW), false)
  row = noteAccountCheck(row, NOW)
  assert.equal(accountCheckIpBlocked(row, NOW), true)
})

test('the 13+ answer is stored once and returned on the next sign-in', async () => {
  const backend = new MemoryAuth()
  const { authDeps } = deps(backend)
  const created = await json(await call('signup', {
    name: 'Cool Kid',
    password: PASSWORD,
    captchaToken: TOKEN,
    age_confirmed: true,
    terms_accepted: true,
    terms_version: '2026-10-20',
    marketing_opt_in: false,
  }, authDeps))
  const flags = created.flags as { age_confirmed_at: string; terms_version: string; marketing_opt_in: boolean; marketing_answered_at: string }
  assert.equal(flags.age_confirmed_at, new Date(NOW).toISOString())
  assert.equal(flags.terms_version, '2026-10-20')
  assert.equal(flags.marketing_opt_in, false)
  assert.equal(typeof flags.marketing_answered_at, 'string')
  const again = await json(await call('signin', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  assert.equal((again.flags as { age_confirmed_at: string }).age_confirmed_at, flags.age_confirmed_at)
  const access = (again.session as { access_token: string }).access_token
  const cleared = await call('flags', { age_confirmed: false, marketing_opt_in: true }, authDeps, { authorization: `Bearer ${access}` })
  assert.equal(cleared.status, 200)
  const kept = (await json(cleared)).flags as { age_confirmed_at: string; marketing_opt_in: boolean }
  assert.equal(kept.age_confirmed_at, flags.age_confirmed_at)
  assert.equal(kept.marketing_opt_in, false)
  const open = await call('session', {}, authDeps, { authorization: `Bearer ${access}` })
  assert.equal(open.status, 200)
  const sessionBody = await json(open)
  assert.equal((sessionBody.flags as { age_confirmed_at: string }).age_confirmed_at, flags.age_confirmed_at)
  assert.equal(sessionBody.user_id, created.user_id)
})

test('a session re-check reports an idle login as expired', async () => {
  const backend = new MemoryAuth()
  const clock = { now: NOW }
  const { authDeps } = deps(backend, NOW)
  authDeps.now = () => clock.now
  const created = await json(await call('signup', { name: 'Cool Kid', password: PASSWORD, captchaToken: TOKEN }, authDeps))
  const access = (created.session as { access_token: string }).access_token
  clock.now = NOW + IDLE_MS
  const stale = await call('session', {}, authDeps, { authorization: `Bearer ${access}` })
  assert.equal(stale.status, 401)
  assert.deepEqual(await json(stale), { error: 'session_expired' })
})

test('signup writes no age and no account type', () => {
  assert.deepEqual(Object.keys(playerInsert('id', 'Cool')).sort(), ['display_name', 'id'])
  assert.deepEqual(Object.keys(profileInsert('id', 'Cool Kid', 'cool-kid')).sort(), ['display_name', 'name_normalized', 'player_id'])
})

test('captcha tokens accept either field name', () => {
  assert.equal(readCaptchaToken({ captchaToken: TOKEN }), TOKEN)
  assert.equal(readCaptchaToken({ turnstile_token: ` ${TOKEN} ` }), TOKEN)
  assert.equal(readCaptchaToken({ turnstile_token: 'short' }), undefined)
})

test('migration 009 adds new tables only', () => {
  const raw = read('../supabase/migration-009-accounts-auth.sql')
  const sql = raw.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.equal(/drop table/i.test(sql), false)
  assert.equal(/update public\./i.test(sql), false)
  assert.equal(/\baccount_type\b/.test(sql), false)
  assert.equal(sql.includes('age_13_plus'), false)
  assert.equal(/\bchat\b/i.test(sql), false)
  assert.equal(/\bcurrency\b/i.test(sql), false)
  assert.equal(/\busd\b/i.test(sql), false)
  assert.match(sql, /profiles_name_normalized_uniq/)
  assert.match(sql, /deny_row_change/)
  assert.match(sql, /receive_gifts/)
  assert.match(sql, /request_purchase/)
  assert.match(sql, /request_challenge/)
  assert.match(sql, /request_story/)
  assert.match(sql, /play_hours/)
  const altered = [...sql.matchAll(/alter table public\.([a-z_]+)/g)].map((match) => match[1])
  const allowed = new Set([
    'profiles',
    'account_recovery',
    'recovery_cards',
    'auth_rate_limits',
    'auth_devices',
    'payment_eligibility',
    'carts',
    'cart_items',
    'wallet_ledger',
    'game_saves',
    'account_status',
    'admin_actions',
    'audit_events',
    'parent_restrictions',
  ])
  for (const table of altered) assert.ok(allowed.has(table), table)
  assert.match(raw, /derived_account_type/)
})

test('the auth backend forwards captcha tokens and confirms synthetic mail', () => {
  const source = read('../netlify/lib/authBackend.ts')
  assert.match(source, /email_confirm:\s*true/)
  assert.match(source, /options:\s*\{\s*captchaToken\s*\}/)
  assert.equal(source.includes('age_13_plus'), false)
  assert.equal(source.includes('TURNSTILE_SECRET'), false)
  assert.equal(source.includes('siteverify'), false)
  const filter = JSON.parse(read('../config/name-filter.json')) as unknown
  assert.deepEqual(filter, NAME_FILTER)
  assert.equal(TURNSTILE_SITE_KEY, '0x4AAAAAAFfTs2hm1baT01HK')
  assert.deepEqual([...TURNSTILE_HOSTS], ['romansgame.com', 'play.romansgame.com', 'www.romansgame.com'])
})

test('migration 010 adds account_flags only', () => {
  const raw = read('../supabase/migration-010-account-flags.sql')
  const sql = raw.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(sql, /create table if not exists public\.account_flags/)
  assert.match(sql, /age_confirmed_at/)
  assert.match(sql, /account_flags_keep_confirmations/)
  assert.equal(sql.includes('age_13_plus'), false)
  assert.equal(/drop table/i.test(sql), false)
  assert.equal(sql.includes('derived_account_type'), false)
  assert.equal(sql.includes('deny_row_change'), false)
  const altered = [...sql.matchAll(/alter table public\.([a-z_]+)/g)].map((match) => match[1])
  assert.deepEqual(altered, ['account_flags'])
})

test('logout is global and the saved session is checked on load and focus', () => {
  const source = read('../src/cloud/cloud.ts')
  assert.match(source, /signOut\(\{ scope: 'global' \}\)/)
  assert.match(source, /all_devices: true/)
  assert.match(source, /recheckSession/)
  assert.match(source, /addEventListener\('focus'/)
  assert.match(source, /\/api\/auth\/session/)
  assert.match(read('../src/buildTag.ts'), /build 9\.32-g/)
  assert.match(read('../src/App.tsx'), /signOutEverywhere as cloudSignOut/)
  assert.match(read('../src/cloud/CloudScores.tsx'), /signOutEverywhere\(\)/)
  assert.match(read('../public/_redirects'), /\/api\/auth\/account/)
  assert.match(read('../public/_redirects'), /\/api\/auth\/flags/)
  assert.match(read('../public/_redirects'), /\/api\/auth\/session/)
})

test('the repo has no Turnstile secret and no siteverify call', () => {
  const hits: string[] = []
  const skip = new Set(['node_modules', 'dist', '.git', 'commonPasswords.ts'])
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (name.endsWith('.test.ts')) continue
      if (!/\.(ts|json|sql|toml)$/.test(name)) continue
      const text = readFileSync(path, 'utf8')
      const widgetScript = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      const withoutWidget = text.split(widgetScript).join('')
      if (text.includes('TURNSTILE_SECRET') || text.includes('siteverify') || withoutWidget.includes('challenges.cloudflare.com/turnstile')) hits.push(path)
    }
  }
  walk(new URL('..', import.meta.url).pathname)
  assert.deepEqual(hits, [])
  assert.equal(existsSync(new URL('../netlify/lib/turnstile.ts', import.meta.url)), false)
})
