import assert from 'node:assert/strict'
import { test } from 'node:test'
import { VOICE_BAGS_KEY, createBagSet, memoryBagStore } from '../src/game/lineBag.ts'

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

test('every line plays once before any line in the category repeats', () => {
  for (let seed = 1; seed < 60; seed++) {
    const next = createBagSet({ store: memoryBagStore(), rng: seeded(seed) }).bag('t', POOL)
    const draws = Array.from({ length: POOL.length * 6 }, () => next())
    for (let c = 0; c < 6; c++) {
      const cycle = draws.slice(c * POOL.length, (c + 1) * POOL.length)
      assert.equal(new Set(cycle).size, POOL.length, `seed ${seed} cycle ${c}: ${cycle}`)
    }
  }
})

test('a new shuffle never starts with the line that just played', () => {
  for (const pool of [['x', 'y'], ['x', 'y', 'z'], POOL]) {
    for (let seed = 1; seed < 40; seed++) {
      const next = createBagSet({ store: memoryBagStore(), rng: seeded(seed) }).bag('t', pool)
      const draws = Array.from({ length: pool.length * 50 }, () => next())
      for (let i = 1; i < draws.length; i++) assert.notEqual(draws[i], draws[i - 1], `seed ${seed} at ${i}`)
    }
  }
})

test('bag position survives a reload / new session', () => {
  const store = memoryBagStore()
  const first = createBagSet({ store, rng: seeded(7) }).bag('old.wrong', POOL)
  const before = [first(), first(), first()]
  assert.ok(store.data.has(VOICE_BAGS_KEY))
  // "reload": a brand-new bag set reading the same storage
  const again = createBagSet({ store, rng: seeded(99) }).bag('old.wrong', POOL)
  const after = Array.from({ length: POOL.length - 3 }, () => again())
  const cycle = [...before, ...after]
  assert.equal(new Set(cycle).size, POOL.length, `lines came back early after reload: ${cycle}`)
  // and the next line (a new cycle) still isn't the last one heard before it
  const third = createBagSet({ store, rng: seeded(5) }).bag('old.wrong', POOL)
  assert.notEqual(third(), cycle[cycle.length - 1])
})

test('a line shared by two categories never plays twice in a row', () => {
  for (let seed = 1; seed < 80; seed++) {
    const set = createBagSet({ store: memoryBagStore(), rng: seeded(seed) })
    const wrong = set.bag('wrong', ['shared', 'w1', 'w2'])
    const miss = set.bag('miss', ['shared', 'm1'])
    const heard: string[] = []
    const r = seeded(seed + 1000)
    for (let i = 0; i < 200; i++) heard.push(r() < 0.5 ? wrong() : miss())
    for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1], `seed ${seed} at ${i}`)
  }
})

test('the last-heard line is remembered across categories after a reload', () => {
  const store = memoryBagStore()
  const a = createBagSet({ store, rng: seeded(3) })
  const shared = a.bag('one', ['s'])
  assert.equal(shared(), 's')
  const b = createBagSet({ store, rng: seeded(4) })
  assert.equal(b.last(), 's')
  const other = b.bag('two', ['s', 't'])
  assert.equal(other(), 't')
})

test('lines added in an update join the rest of the current bag', () => {
  const store = memoryBagStore()
  const v1 = createBagSet({ store, rng: seeded(11) }).bag('idle', ['a', 'b', 'c', 'd'])
  const heard = [v1(), v1()]
  const v2 = createBagSet({ store, rng: seeded(12) }).bag('idle', ['a', 'b', 'c', 'd', 'e', 'f'])
  const rest = Array.from({ length: 4 }, () => v2())
  assert.equal(new Set([...heard, ...rest]).size, 6, `${heard} | ${rest}`)
})

test('broken saved data or no storage still works', () => {
  const store = memoryBagStore()
  store.set(VOICE_BAGS_KEY, '{not json')
  const next = createBagSet({ store }).bag('x', POOL)
  assert.equal(new Set(Array.from({ length: POOL.length }, () => next())).size, POOL.length)
  store.set(VOICE_BAGS_KEY, JSON.stringify({ last: 5, bags: { x: { order: 'nope', pos: 'x' } } }))
  const again = createBagSet({ store }).bag('x', POOL)
  assert.equal(new Set(Array.from({ length: POOL.length }, () => again())).size, POOL.length)
  const none = createBagSet({ store: null }).bag('y', ['only'])
  assert.equal(none(), 'only')
  assert.equal(none(), 'only')
})
