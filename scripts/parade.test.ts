import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  loadParade,
  newParade,
  paradeDone,
  paradeLengthMs,
  paradeWin,
  pickEvery,
  sanitizeParade,
  saveParade,
} from '../src/game/parade.ts'

test('a cycle is always 5, 6 or 7 wins, and all three come up', () => {
  const seen = new Set<number>()
  for (let i = 0; i < 300; i++) seen.add(pickEvery())
  assert.deepEqual([...seen].sort(), [5, 6, 7])
  assert.equal(pickEvery(() => 0.999999), 7)
  assert.equal(pickEvery(() => 0), 5)
})

test('parade comes due exactly at the cycle count, then a new cycle starts', () => {
  for (const every of [5, 6, 7]) {
    let s = { wins: 0, every, due: false }
    for (let i = 1; i < every; i++) {
      s = paradeWin(s)
      assert.equal(s.due, false)
    }
    s = paradeWin(s)
    assert.equal(s.due, true)
    // more wins while it is owed don't change anything
    assert.deepEqual(paradeWin(s), s)
    s = paradeDone(s)
    assert.equal(s.due, false)
    assert.equal(s.wins, 0)
  }
})

test('long run: parades are 5-7 wins apart, never back to back', () => {
  let s = newParade()
  let since = 0
  const gaps: number[] = []
  for (let win = 0; win < 2000; win++) {
    s = paradeWin(s)
    since++
    if (s.due) {
      gaps.push(since)
      since = 0
      s = paradeDone(s)
    }
  }
  assert.ok(gaps.length > 250)
  assert.ok(gaps.every((g) => g >= 5 && g <= 7))
})

test('length is 12-16 s', () => {
  assert.equal(paradeLengthMs(() => 0), 12000)
  assert.equal(paradeLengthMs(() => 1), 16000)
  for (let i = 0; i < 100; i++) {
    const ms = paradeLengthMs()
    assert.ok(ms >= 12000 && ms <= 16000)
  }
})

test('junk saves become a fresh cycle; good saves round-trip', () => {
  for (const bad of [null, 'x', 7, { every: 99 }, { wins: 'a', every: 'b' }]) {
    const s = sanitizeParade(bad)
    assert.ok(s.every >= 5 && s.every <= 7 && s.wins === 0 && !s.due)
  }
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  saveParade(store, { wins: 4, every: 6, due: false })
  assert.deepEqual(loadParade(store), { wins: 4, every: 6, due: false })
  saveParade(store, { wins: 6, every: 6, due: true })
  assert.deepEqual(loadParade(store), { wins: 6, every: 6, due: true })
  assert.equal(loadParade(null).wins, 0)
})
