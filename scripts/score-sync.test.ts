import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}

const store = memoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true })

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: 9_999_999_999,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'player@example.com' },
}
localStorage.setItem('sb-oelsglmfkpzbueqysvdm-auth-token', JSON.stringify(session))
localStorage.setItem('rg.cloud.profile.v1', JSON.stringify({
  userId: 'user-1',
  email: 'player@example.com',
  name: "Roman's Game Official",
}))
localStorage.setItem('roman.settings.v1', JSON.stringify({ playerName: 'Romansgameofficial' }))
localStorage.setItem('rg.cloud.queue.v1', JSON.stringify([
  { score: 60, level: 5, moves: 3, time_seconds: 20, mode: 'normal', at: '2026-10-20T00:00:00.000Z', dedupeKey: 'guest-60' },
  { score: 61, level: 5, moves: 4, time_seconds: 21, mode: 'remix', at: '2026-10-20T00:01:00.000Z', dedupeKey: 'guest-61' },
]))

const cloud = await import('../src/cloud/cloud.ts')

test('a signed-in player never sees the guest save prompt, even with no account name yet', () => {
  const s = cloud.cloudState()
  assert.equal(s.status, 'signed-in')
  assert.equal(s.pending, 2)
  assert.equal(cloud.accountNameFromDevice(), 'Romansgameofficial')
  const label = cloud.scoreSaveLabel({ status: 'signed-in', pending: 61 })
  assert.equal(label.includes('Save my score'), false)
  assert.match(label, /Saving 61 scores/)
  assert.equal(cloud.scoreSaveLabel({ status: 'signed-in', pending: 0 }), '☁ Scores saved')
  assert.match(cloud.scoreSaveLabel({ status: 'signed-out', pending: 60 }), /Save my scores \(60 waiting\)/)
})

test('phone header keeps the name Roman beside the sun', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
  assert.match(app, /data-testid="brand-roman">Roman</)
  assert.doesNotMatch(css, /\.topbar-slim \.brand-name \{\s*display:\s*none/)
  assert.match(css, /\.brand-name-short \{\s*display: inline/)
})

test('queued games upload to the account with no manual save, including the next finished game', async () => {
  const scoreInserts: Array<Record<string, unknown>[]> = []
  let playerName = ''
  let setSessionCalls = 0
  const sb = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      setSession: async () => {
        setSessionCalls += 1
        return { data: { session }, error: null }
      },
    },
    from(table: string) {
      const builder = {
        select() { return builder },
        eq() { return builder },
        maybeSingle: async () => ({ data: null, error: null }),
        insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(payload) ? payload : [payload]
          let result: { data: { display_name: string; public_name: string } | null; error: { code?: string; message?: string } | null }
          if (table === 'players') {
            playerName = String(rows[0]?.display_name ?? '')
            result = { data: { display_name: playerName, public_name: playerName }, error: null }
          } else {
            scoreInserts.push(rows)
            const remix = rows.length === 1 && rows[0]?.mode === 'remix'
            const batch = rows.length > 1
            result = remix || batch
              ? { data: null, error: { code: '23514', message: 'check constraint mode' } }
              : { data: null, error: null }
          }
          const pending = Promise.resolve(result)
          const next = {
            select() { return next },
            single: () => pending,
            maybeSingle: () => pending,
            then: (ok: (v: typeof result) => unknown, err?: (e: unknown) => unknown) => pending.then(ok, err),
          }
          return next
        },
      }
      return builder
    },
    rpc: async () => ({ data: null, error: null }),
  }
  cloud.useCloudClientForTests(sb as never)
  await cloud.flushScores()
  assert.equal(setSessionCalls, 1)
  assert.equal(playerName, 'Romansgameofficial')
  assert.equal(localStorage.getItem('rg.cloud.queue.v1.user-1'), null)
  assert.equal(cloud.cloudState().pending, 0)
  assert.equal(cloud.cloudState().publicName, 'Romansgameofficial')
  assert.equal(cloud.scoreSaveLabel(cloud.cloudState()).includes('Save my score'), false)
  const modes = scoreInserts.flat().map((row) => row.mode)
  assert.ok(modes.includes('other'), 'a remix row the server rejects is sent as other')
  assert.equal(modes.includes('remix'), true)

  cloud.saveScore({ score: 62, level: 5, moves: 5, time_seconds: 22, mode: 'normal', dedupeKey: 'win-62' })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(localStorage.getItem('rg.cloud.queue.v1'), null)
  assert.equal(localStorage.getItem('rg.cloud.queue.v1.user-1'), null)
  assert.equal(cloud.cloudState().pending, 0)
  assert.ok(scoreInserts.flat().some((row) => row.score === 62))
})
