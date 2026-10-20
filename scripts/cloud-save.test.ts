import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => {
      m.set(k, String(v))
    },
    removeItem: (k) => {
      m.delete(k)
    },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  }
}

const store = memoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true })

const { saveScore, scoreRowsForServer } = await import('../src/cloud/cloud.ts')

const base = {
  score: 2030,
  level: 5,
  moves: 8,
  time_seconds: 12,
  mode: 'normal' as const,
  puzzle_id: 'dawn',
}

function queued(): Array<{ dedupeKey?: string; score: number; at?: string }> {
  return JSON.parse(localStorage.getItem('rg.cloud.queue.v1') || '[]')
}

test('a win is queued once; the same result is not saved again', () => {
  localStorage.removeItem('rg.cloud.queue.v1')
  saveScore({ ...base, dedupeKey: 'win:dawn:once' })
  saveScore({ ...base, dedupeKey: 'win:dawn:once' })
  saveScore({ ...base, dedupeKey: 'win:dawn:once', score: 9999 })
  const q = queued()
  assert.equal(q.length, 1)
  assert.equal(q[0].score, 2030)
  assert.equal(q[0].dedupeKey, 'win:dawn:once')
})

test('a later win with a new key is saved', () => {
  saveScore({ ...base, score: 1500, dedupeKey: 'win:dawn:again' })
  const q = queued()
  assert.equal(q.length, 2)
  assert.deepEqual(q.map((row) => row.dedupeKey), ['win:dawn:once', 'win:dawn:again'])
})

test('queued rows sent to the server drop the local dedupe key', () => {
  const rows = scoreRowsForServer([
    { ...base, at: '2026-10-19T00:00:00.000Z', dedupeKey: 'win:dawn:once', daily_date: '2020-01-01' },
  ])
  assert.equal(rows.length, 1)
  assert.equal('dedupeKey' in rows[0], false)
  assert.equal('at' in rows[0], false)
  assert.equal(rows[0].daily_date, undefined)
  assert.equal(rows[0].score, 2030)
})
