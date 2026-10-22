import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadParade,
  newParade,
  paradeDone,
  paradeLengthMs,
  paradeMarch,
  paradeSpanMs,
  paradeWin,
  pickEvery,
  sanitizeParade,
  saveParade,
} from '../src/game/parade.ts'

import { PARADE_MAX_GAP_MS, PARADE_MIN_GAP_MS, paradeHint, paradeReady } from '../src/game/parade.ts'

const MIN = 60000

test('a cycle is always 8 or 9 wins, and both come up', () => {
  const seen = new Set<number>()
  for (let i = 0; i < 300; i++) seen.add(pickEvery())
  assert.deepEqual([...seen].sort(), [8, 9])
  assert.equal(pickEvery(() => 0.999999), 9)
  assert.equal(pickEvery(() => 0), 8)
})

test('parade comes due at the cycle count AND only shows once 20-30 min have passed (whichever is later)', () => {
  for (const every of [8, 9]) {
    let s = { wins: 0, every, due: false, lastAt: 1000, gapMs: 25 * MIN }
    for (let i = 1; i < every; i++) {
      s = paradeWin(s)
      assert.equal(s.due, false)
    }
    s = paradeWin(s)
    assert.equal(s.due, true)
    assert.deepEqual(paradeWin(s), s)
    // fast player: wins done but only 10 min passed -> not yet
    assert.equal(paradeReady(s, 1000 + 10 * MIN), false)
    assert.equal(paradeReady(s, 1000 + 25 * MIN), true)
    s = paradeDone(s, Math.random, 5000)
    assert.equal(s.due, false)
    assert.equal(s.wins, 0)
    assert.equal(s.lastAt, 5000)
  }
})

test('slow player: 8 wins in an hour still get the parade, and 3 fit in a normal session', () => {
  // 1 win every 6 min: 9 wins = 54 min. Time is never the limit for a slow player, the win count is.
  let s = newParade(Math.random, 0)
  let t = 0
  let parades = 0
  for (let win = 0; win < 40; win++) {
    t += 6 * MIN
    s = paradeWin(s)
    if (paradeReady(s, t)) {
      parades++
      s = paradeDone(s, Math.random, t)
    }
  }
  assert.ok(parades >= 3, `slow player got ${parades}`)
})

test('fast player: 1 win a minute -> parades are >= 8 wins and >= 20 min apart, never more than 1 per 20 min', () => {
  let s = newParade(Math.random, 0)
  let t = 0
  let sinceWins = 0
  let lastT = 0
  const gaps: number[] = []
  for (let win = 0; win < 600; win++) {
    t += MIN
    sinceWins++
    s = paradeWin(s)
    if (paradeReady(s, t)) {
      assert.ok(sinceWins >= 8, 'at least 8 wins')
      gaps.push(t - lastT)
      lastT = t
      sinceWins = 0
      s = paradeDone(s, Math.random, t)
    }
  }
  assert.ok(gaps.length > 15)
  assert.ok(gaps.every((g) => g >= PARADE_MIN_GAP_MS && g <= PARADE_MAX_GAP_MS + MIN))
})

test('hint text: wins left, then minutes left, then ready', () => {
  const s = { wins: 5, every: 8, due: false, lastAt: 0, gapMs: 20 * MIN }
  assert.equal(paradeHint(s, 30 * MIN).text, 'Next parade: 3 more wins')
  assert.equal(paradeHint({ ...s, wins: 7 }, 30 * MIN).text, 'Next parade: 1 more win')
  assert.equal(paradeHint({ ...s, wins: 8, due: true }, 12 * MIN).text, 'Next parade: in about 8 min')
  assert.equal(paradeHint({ ...s, wins: 8, due: true }, 21 * MIN).ready, true)
})

test('each buddy crosses in 1.5–2.5s, gaps stay short, and the parade ends under 10s', () => {
  const slow = paradeMarch(5, () => 0)
  const fast = paradeMarch(5, () => 1)
  assert.equal(slow[0].crossMs, 1500)
  assert.equal(fast[0].crossMs, 2500)
  assert.equal(slow[1].delayMs - slow[0].delayMs, 260)
  assert.equal(fast[1].delayMs - fast[0].delayMs, 420)
  assert.equal(paradeLengthMs(() => 0), paradeSpanMs(slow))
  assert.equal(paradeLengthMs(() => 1), paradeSpanMs(fast))
  assert.ok(paradeSpanMs(fast) < 10000)
  for (let n = 1; n <= 12; n++) {
    for (let i = 0; i < 30; i++) {
      const march = paradeMarch(n)
      const span = paradeSpanMs(march)
      assert.ok(span < 10000, `roster ${n} ran ${span}ms`)
      assert.ok(march.every((b) => b.crossMs >= 1500 && b.crossMs <= 2500))
      for (let k = 1; k < march.length; k++) assert.ok(march[k].delayMs >= march[k - 1].delayMs)
    }
  }
  const pulls = [0, 0.1, 0.1, 0.3, 1, 0.9, 0.9, 0.3, 0.5, 0.4, 0.4]
  let n = 0
  const mixed = paradeMarch(3, () => pulls[n++])
  assert.equal(mixed[0].crossMs, 1500)
  assert.equal(mixed[1].crossMs, 2500)
  assert.ok(mixed[0].delayMs < mixed[1].delayMs && mixed[1].delayMs < mixed[2].delayMs)
})

test('junk saves become a fresh cycle; good saves round-trip; an old 5-7 cycle becomes 8-9 (wins kept)', () => {
  for (const bad of [null, 'x', 7, { every: 99 }, { wins: 'a', every: 'b' }]) {
    const s = sanitizeParade(bad)
    assert.ok(s.every >= 8 && s.every <= 9 && s.wins === 0 && !s.due)
  }
  const old = sanitizeParade({ wins: 6, every: 6, due: true })
  assert.ok(old.every >= 8 && old.wins === 6 && !old.due)
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  const good = { wins: 4, every: 8, due: false, lastAt: 1000, gapMs: 25 * MIN }
  saveParade(store, good)
  assert.deepEqual(loadParade(store), good)
  assert.equal(loadParade(null).wins, 0)
})
