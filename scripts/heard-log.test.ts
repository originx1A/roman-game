import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from 'node:module'
import { createHeardLog, heardEnough, HEARD_KEY } from '../src/game/heardLog.ts'
import { createBagSet, leastHeard, memoryBagStore } from '../src/game/lineBag.ts'

register('./ts-resolve.mjs', import.meta.url)

test('heard log counts, saves and reloads (a new build reads the same key)', () => {
  const store = memoryBagStore()
  const a = createHeardLog({ store })
  a.record('x', 100)
  a.record('x', 200)
  a.record('y', 300)
  const b = createHeardLog({ store }) // a reload / a new build
  assert.equal(b.count('x'), 2)
  assert.equal(b.lastAt('x'), 200)
  assert.equal(b.heardOf(['x', 'y', 'z']), 2)
  assert.equal(b.totalPlays(), 3)
  b.reset()
  assert.equal(createHeardLog({ store }).totalPlays(), 0)
  assert.equal(store.get(HEARD_KEY)?.includes('"v":1'), true)
})

test('junk or blocked storage never throws', () => {
  const store = memoryBagStore()
  store.set(HEARD_KEY, '{nope')
  const l = createHeardLog({ store })
  assert.equal(l.count('x'), 0)
  l.record('x')
  assert.equal(l.count('x'), 1)
  const none = createHeardLog({ store: null })
  none.record('q')
  assert.equal(none.count('q'), 1)
  const bad = createHeardLog({ store: { get: () => { throw new Error('no') }, set: () => { throw new Error('no') } } })
  bad.record('z')
  assert.equal(bad.count('z'), 1)
})

test('leastHeard: only the lowest count, never the line just spoken, recent ones wait among ties', () => {
  const counts: Record<string, number> = { a: 2, b: 0, c: 0, d: 1 }
  const count = (x: string) => counts[x] ?? 0
  assert.deepEqual(leastHeard(['a', 'b', 'c', 'd'], count).sort(), ['b', 'c'])
  assert.deepEqual(leastHeard(['a', 'b', 'c', 'd'], count, new Set(), new Set(['b'])).sort(), ['c'])
  assert.deepEqual(leastHeard(['a', 'b', 'c', 'd'], count, new Set(['b'])).sort(), ['c'])
  // recent lines never push a repeat ahead of an unheard line
  assert.deepEqual(leastHeard(['a', 'b'], count, new Set(['b'])).sort(), ['b'])
  // a single line is still offered
  assert.deepEqual(leastHeard(['a'], count, new Set(['a']), new Set(['a'])), ['a'])
})

test('a bag with a heard log plays every line once before any repeats, across "sessions"', () => {
  const store = memoryBagStore()
  const heard = createHeardLog({ store: memoryBagStore() })
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const order: string[] = []
  for (let session = 0; session < 4; session++) {
    // each session is a fresh bag set on the same saved data
    const set = createBagSet({ store, commitOnPlay: true, heard })
    const next = set.bag('t', pool)
    for (let i = 0; i < 5; i++) {
      const pick = next()
      set.markPlayed(pick)
      heard.record(pick)
      order.push(pick)
    }
  }
  for (let c = 0; c + pool.length <= order.length; c += pool.length) assert.equal(new Set(order.slice(c, c + pool.length)).size, pool.length, `pass ${c / pool.length}`)
  assert.equal(new Set(order.slice(0, 7)).size, 7)
})

test('a line that was only requested (not heard) does not count, so it is offered again', () => {
  const heard = createHeardLog({ store: memoryBagStore() })
  const set = createBagSet({ store: memoryBagStore(), commitOnPlay: true, heard })
  const next = set.bag('t', ['a', 'b', 'c'])
  const seen = new Set<string>()
  for (let i = 0; i < 3; i++) {
    const p = next() // asked for, dropped as stale: never recorded
    seen.add(p)
  }
  // with nothing heard yet all three are level, so any may come; once 'a' is heard it drops behind
  heard.record('a')
  for (let i = 0; i < 40; i++) assert.notEqual(next(), 'a')
})

test('heard = finished or 70% played (media time)', () => {
  assert.equal(heardEnough(2.8, 4), true)
  assert.equal(heardEnough(4, 4), true)
  assert.equal(heardEnough(2.7, 4), false)
  assert.equal(heardEnough(0, 4), false)
  assert.equal(heardEnough(1, NaN), false)
  assert.equal(heardEnough(1, 0), false)
})
