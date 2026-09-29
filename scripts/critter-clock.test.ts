import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CRITTER_BOARD_GRACE_MS,
  CRITTER_CLOCK_KEY,
  loadCritterClock,
  newCritterClock,
  saveCritterClock,
  tickCritterClock,
} from '../src/game/critterClock.ts'

test('first visit lands at 25-40 s of total play, spread over boards', () => {
  for (const r of [0, 0.5, 0.999]) {
    const c = newCritterClock(() => r)
    assert.ok(c.nextAt >= 25000 && c.nextAt <= 40000)
  }
  // 10 s boards (a fast player) still meet the critter on the third
  let c = newCritterClock(() => 0)
  let spawned = -1
  for (let board = 0; board < 3; board++) {
    for (let s = 1; s <= 10; s++) {
      const r = tickCritterClock(c, 1000, s * 1000)
      c = r.clock
      if (r.spawn && spawned < 0) spawned = board
    }
  }
  assert.equal(spawned, 2)
})

test('later visits are 45-75 s of play apart', () => {
  let c = newCritterClock(() => 0)
  const times: number[] = []
  for (let t = 1; t <= 200; t++) {
    const r = tickCritterClock(c, 1000, 10000, () => 0.5)
    c = r.clock
    if (r.spawn) times.push(t)
  }
  assert.equal(times[0], 25)
  assert.equal(times[1] - times[0], 60)
})

test('no visit in the first seconds of a board; it waits and shows up after', () => {
  const c = { played: 25000, nextAt: 20000 }
  assert.equal(tickCritterClock(c, 1000, CRITTER_BOARD_GRACE_MS - 1).spawn, false)
  assert.equal(tickCritterClock(c, 1000, CRITTER_BOARD_GRACE_MS).spawn, true)
})

test('a huge tick counts at most 2 s', () => {
  const r = tickCritterClock({ played: 0, nextAt: 100000 }, 600000, 10000)
  assert.equal(r.clock.played, 2000)
})

test('saves and loads; junk falls back to a fresh clock', () => {
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  saveCritterClock(store, { played: 12345, nextAt: 30000 })
  assert.deepEqual(loadCritterClock(store), { played: 12345, nextAt: 30000 })
  mem.set(CRITTER_CLOCK_KEY, '{nope')
  assert.equal(loadCritterClock(store, () => 0).nextAt, 25000)
  assert.equal(loadCritterClock(null, () => 0).played, 0)
})
