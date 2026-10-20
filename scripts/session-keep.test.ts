import assert from 'node:assert/strict'
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
  expires_at: 1,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'player@example.com' },
}
localStorage.setItem('sb-oelsglmfkpzbueqysvdm-auth-token', JSON.stringify(session))
localStorage.setItem('rg.cloud.profile.v1', JSON.stringify({ userId: 'user-1', email: 'player@example.com', name: 'Roman', publicName: 'Roman' }))
localStorage.setItem('rg.cloud.queue.v1', JSON.stringify([
  { score: 100, level: 5, moves: 3, time_seconds: 20, mode: 'normal', at: '2026-10-20T00:00:00.000Z', dedupeKey: 'guest-win' },
]))

const cloud = await import('../src/cloud/cloud.ts')

test('a saved login is already signed in before any network call', () => {
  const s = cloud.cloudState()
  assert.equal(s.status, 'signed-in')
  assert.equal(s.email, 'player@example.com')
  assert.equal(s.name, 'Roman')
  assert.equal(s.publicName, 'Roman')
})

test('a token refresh cannot delete the saved login', () => {
  cloud.releaseAuthKey(cloud.AUTH_STORAGE_KEY)
  const still = cloud.readStoredSession()
  assert.equal(still?.user.email, 'player@example.com')
  assert.equal(still?.refresh_token, 'refresh')
})

test('guest scores merge onto the account once', () => {
  const moved = cloud.mergeGuestQueue('user-1')
  assert.equal(moved, 1)
  assert.equal(localStorage.getItem('rg.cloud.queue.v1'), null)
  const mine = JSON.parse(localStorage.getItem('rg.cloud.queue.v1.user-1') || '[]')
  assert.equal(mine.length, 1)
  assert.equal(mine[0].dedupeKey, 'guest-win')
  assert.equal(cloud.mergeGuestQueue('user-1'), 0)
})
