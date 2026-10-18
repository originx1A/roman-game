import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

register('./ts-resolve.mjs', import.meta.url)

const N = await import('../src/game/parentNotice.ts')
const D = await import('../src/game/accountDelete.ts')
const P = await import('../src/game/accountProgress.ts')
const sql = await import('../netlify/lib/accountDeleteSql.ts')
const store = await import('../netlify/lib/parentNoticeStore.ts')

const sheet = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migration-007-account-deletion.sql', import.meta.url), 'utf8')
const sqlSrc = readFileSync(new URL('../netlify/lib/accountDeleteSql.ts', import.meta.url), 'utf8')
const deleteFn = readFileSync(new URL('../netlify/functions/delete-account.ts', import.meta.url), 'utf8')

const USER = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'ab'.repeat(32)
const ORIGIN = 'https://play.example'
const CREATED = Date.parse('2026-10-18T15:00:00.000Z')

function notice(patch: Partial<N.ParentNotice> = {}): N.ParentNotice {
  return {
    userId: USER,
    email: 'parent@example.com',
    nickname: 'Brave Owl',
    createdAt: CREATED,
    confirmSentAt: null,
    followUpSentAt: null,
    cancelToken: TOKEN,
    cancelledAt: null,
    databaseDeleted: false,
    ...patch,
  }
}

test('parent confirmation is immediate and the follow-up is one day later', () => {
  assert.equal(N.PARENT_FOLLOW_UP_MS, 24 * 60 * 60 * 1000)
  assert.equal(N.followUpAt(CREATED), CREATED + N.PARENT_FOLLOW_UP_MS)
  assert.deepEqual(N.dueParentMails(notice(), CREATED), ['confirm'])
  assert.deepEqual(N.dueParentMails(notice(), CREATED + N.PARENT_FOLLOW_UP_MS - 1), ['confirm'])
  const dayLater = notice({ confirmSentAt: CREATED })
  assert.deepEqual(N.dueParentMails(dayLater, CREATED + N.PARENT_FOLLOW_UP_MS - 1), [])
  assert.deepEqual(N.dueParentMails(dayLater, CREATED + N.PARENT_FOLLOW_UP_MS), ['followup'])
  assert.deepEqual(N.dueParentMails(notice({ cancelledAt: CREATED }), CREATED + N.PARENT_FOLLOW_UP_MS), [])
  assert.equal(N.safeNickname('Brave Owl'), 'Brave Owl')
  assert.equal(N.safeNickname('Alex'), null)
})

test('parent emails match the policy and include a cancel link', () => {
  const link = N.cancelUrl(ORIGIN, TOKEN)
  assert.equal(link, `${ORIGIN}/api/parent-notice?cancel=${TOKEN}`)
  assert.equal(N.cancelUrl('not a url', TOKEN), null)
  assert.equal(N.cancelUrl(ORIGIN, 'short'), null)
  const confirm = N.parentConfirmLetter('Brave Owl', link!)
  const follow = N.parentFollowUpLetter(link!)
  assert.match(confirm.text, /We send you a confirmation email, then a follow-up a day later, so you can cancel if it wasn't you\./)
  assert.match(confirm.text, /This is that confirmation/)
  assert.match(confirm.text, /Brave Owl/)
  assert.match(confirm.text, /Account → Delete account/)
  assert.match(confirm.text, /support@romansgame\.com/)
  assert.match(confirm.text, new RegExp(link!.replace(/[?]/g, '\\?')))
  assert.match(follow.subject, /A day later/)
  assert.match(follow.text, /follow-up a day later, so you can cancel if it wasn't you/)
  assert.match(follow.text, /Account → Delete account/)
  assert.doesNotMatch(follow.text, /parent@example\.com/)
  const html = N.parentNoticeHtml(confirm.text, link!)
  assert.match(html, /href="https:\/\/play\.example\/api\/parent-notice\?cancel=/)
  assert.match(N.parentNoticeHtml('Hello <script>', 'https://play.example/x'), /&lt;script&gt;/)
  assert.match(N.parentCancelPage('deleted'), /kept for 6 years/)
  assert.match(N.parentCancelPage('kept-row'), /stays until deletion is turned on/)
  assert.match(N.parentCancelPage('missing'), /doesn't match an account/)
  assert.equal(N.parentMailEnabled(undefined, 'key'), false)
  assert.equal(N.parentMailEnabled('1', ''), false)
  assert.equal(N.parentMailEnabled('1', 'key'), true)
})

test('day-later sender does nothing while the ledger flag is off', async () => {
  assert.notEqual(process.env.ACCOUNT_LEDGER_ENABLED, '1')
  const result = await store.deliverDueParentNotices(ORIGIN, CREATED + N.PARENT_FOLLOW_UP_MS)
  assert.deepEqual(result, { sent: 0, mail: false })
  assert.equal(await store.cancelParentNotice('nope'), 'missing')
})

test('delete account keeps the tax ledger and is off without the flag', async () => {
  assert.equal(D.accountDeleteSqlEnabled(undefined, true), false)
  assert.equal(D.accountDeleteSqlEnabled('1', false), false)
  assert.equal(D.accountDeleteSqlEnabled('1', true), true)
  assert.equal(D.consentRetainUntil(CREATED), '2029-10-18T15:00:00.000Z')
  assert.ok(D.SERVER_KEPT.includes('coin_ledger'))
  assert.ok(!D.DEVICE_PROGRESS_KEYS.includes('roman.stripe.sessions.v1'))
  assert.ok(!D.DEVICE_PROGRESS_KEYS.includes('roman.settings.v1'))
  assert.ok(D.DEVICE_PROGRESS_KEYS.includes('roman.profile.v1'))
  assert.doesNotMatch(sqlSrc, /rest\/v1\/coin_ledger/)
  assert.doesNotMatch(deleteFn, /rest\/v1\/coin_ledger/)
  assert.match(migration, /NOT APPLIED/)
  assert.match(migration, /oelsglmfkpzbueqysvdm/)
  assert.match(migration, /wnczzbjxohharwnjrdia/)
  assert.match(migration, /account_deletions/)
  assert.match(migration, /3 years/)
  let called = false
  const blocked = (async () => {
    called = true
    throw new Error('live database')
  }) as typeof fetch
  assert.equal(await sql.deleteAccountDatabase(USER, {
    fetchImpl: blocked,
    env: { ACCOUNT_LEDGER_ENABLED: undefined, SUPABASE_SERVICE_ROLE_KEY: 'secret' },
    now: CREATED,
  }), false)
  assert.equal(called, false)

  const calls: { url: string; method: string; body: string }[] = []
  const ok = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : '' })
    if (method === 'GET') {
      return new Response(JSON.stringify([{
        privacy_version: '2026-10-18',
        terms_version: '2026-10-18',
        policy_consented_at: '2026-10-18T15:00:00.000Z',
        guardian_consent: true,
        consent_type: 'terms_privacy_parent',
      }]), { status: 200 })
    }
    return new Response(null, { status: 204 })
  }) as typeof fetch
  assert.equal(await sql.deleteAccountDatabase(USER, {
    fetchImpl: ok,
    env: { ACCOUNT_LEDGER_ENABLED: '1', SUPABASE_SERVICE_ROLE_KEY: 'secret' },
    now: CREATED,
  }), true)
  assert.ok(calls.every((c) => !c.url.includes('coin_ledger')))
  assert.ok(calls.some((c) => c.method === 'POST' && c.url.includes('/account_deletions')))
  const kept = calls.find((c) => c.url.includes('/account_deletions'))
  assert.match(kept?.body ?? '', /2029-10-18T15:00:00.000Z/)
  assert.doesNotMatch(kept?.body ?? '', /@/)
  assert.doesNotMatch(kept?.body ?? '', /display_name|email/)
  for (const table of ['scores?', 'player_saves?', 'purchase_pins?', 'players?']) {
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.includes(table)))
  }
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.includes('/auth/v1/admin/users/')))

  const stopped: string[] = []
  const missing = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    stopped.push(`${init?.method ?? 'GET'} ${url}`)
    if (url.includes('account_deletions')) return new Response('missing', { status: 404 })
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  assert.equal(await sql.deleteAccountDatabase(USER, {
    fetchImpl: missing,
    env: { ACCOUNT_LEDGER_ENABLED: '1', SUPABASE_SERVICE_ROLE_KEY: 'secret' },
    now: CREATED,
  }), false)
  assert.equal(stopped.some((line) => line.startsWith('DELETE')), false)
})

test('forgetting an account drops that snapshot and leaves the other one', () => {
  const blob = { wallet: { coins: 3 }, pets: null, records: null, clears: [] }
  const other = { wallet: { coins: 9 }, pets: null, records: null, clears: [] }
  const next = P.forgetAccount({
    owner: USER,
    parked: null,
    guest: { wallet: null, pets: null, records: null, clears: [] },
    accounts: { [USER]: blob, 'other-id': other },
  }, USER)
  assert.equal(next.owner, null)
  assert.equal(next.accounts[USER], undefined)
  assert.equal(next.accounts['other-id']?.wallet?.coins, 9)
})

test('Account has a confirm step and parent sign-up schedules the day-later email', () => {
  assert.match(sheet, /<h3>Account<\/h3>/)
  assert.match(sheet, /Delete account/)
  assert.match(sheet, /Keep account/)
  assert.match(sheet, /setSheet\('delete'\)/)
  assert.match(sheet, /confirmDelete/)
  assert.match(sheet, /Purchase and tax records are kept for 6 years/)
  assert.match(cloud, /if \(consent\.policy\?\.guardian\) void scheduleParentNotice/)
  assert.match(cloud, /clearDeletedAccountOnDevice\(userId\)/)
  assert.match(cloud, /await signOut\(\)/)
})
