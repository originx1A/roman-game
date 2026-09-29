import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const { makeTreasure, treasureValue, TREASURE_DROPS } = await import('../src/game/paradeTreasure.ts')
const {
  DAY_BOARDS,
  DAY_COIN_CAP,
  dayActive,
  dayCoins,
  dayKindFor,
  loadDay,
  pickFeatured,
  saveDay,
  sanitizeDay,
  startBuddyDay,
  useDayBoard,
  EMPTY_DAY,
} = await import('../src/game/buddyDay.ts')

test('treasure: 3-5 drops, one per marching buddy, at most one hint and one spin, coins at least 3', () => {
  for (let i = 0; i < 3000; i++) {
    const slots = 1 + (i % 6)
    const t = makeTreasure(slots, Math.random, 20 + (i % 60))
    assert.equal(t.length, Math.min(TREASURE_DROPS, slots))
    assert.ok(t.filter((x) => x.kind === 'hint').length <= 1)
    assert.ok(t.filter((x) => x.kind === 'spin').length <= 1)
    for (const x of t) if (x.kind === 'coins') assert.ok(x.amount >= 3)
  }
  assert.equal(TREASURE_DROPS, 5)
  assert.deepEqual(makeTreasure(0), [])
})

test('treasure never costs more than its budget, and is mostly coins', () => {
  let coinsOnly = 0
  const N = 5000
  for (let i = 0; i < N; i++) {
    const budget = 15 + (i % 40)
    const t = makeTreasure(3 + (i % 3), Math.random, budget)
    const v = t.reduce((a, x) => a + treasureValue(x), 0)
    assert.ok(v <= Math.max(budget, t.length * 3), `value ${v} over budget ${budget}`)
    if (t.every((x) => x.kind === 'coins')) coinsOnly++
  }
  assert.ok(coinsOnly / N > 0.6, 'hints and spins are the rare items')
  // no spin when the day's spin is taken
  for (let i = 0; i < 2000; i++) assert.ok(makeTreasure(4, Math.random, 60, false).every((x) => x.kind !== 'spin'))
})

test('buddy of the day rotates through owned buddies, wraps, and handles none / one', () => {
  assert.equal(pickFeatured([], null), null)
  assert.equal(pickFeatured(['leo'], 'leo'), 'leo')
  assert.equal(pickFeatured(['lupa', 'leo'], null), 'lupa')
  assert.equal(pickFeatured(['lupa', 'leo'], 'lupa'), 'leo')
  assert.equal(pickFeatured(['lupa', 'leo'], 'leo'), 'lupa')
  // owning every buddy: all five come round in order before repeating
  const all = ['lupa', 'aquila', 'leo', 'invictus', 'nox'] as const
  let last: (typeof all)[number] | null = null
  const seen: string[] = []
  for (let i = 0; i < 10; i++) {
    const p = pickFeatured(all, last)!
    seen.push(p)
    last = p
  }
  assert.deepEqual(seen.slice(0, 5), [...all])
  assert.deepEqual(seen.slice(5), [...all])
})

test('perk kinds: hint buddies and guests give a free hint, the others double coins', () => {
  assert.equal(dayKindFor('aquila'), 'hint')
  assert.equal(dayKindFor('nox'), 'hint')
  assert.equal(dayKindFor(null), 'hint')
  assert.equal(dayKindFor('lupa'), 'coins')
  assert.equal(dayKindFor('invictus'), 'coins')
})

test('the perk lasts exactly 3 boards, then stops', () => {
  let d = startBuddyDay(EMPTY_DAY, ['lupa'])
  assert.equal(d.pet, 'lupa')
  assert.ok(dayActive(d))
  const boards: number[] = []
  for (let i = 0; i < 5; i++) {
    const r = useDayBoard(d)
    d = r.day
    if (r.perk) boards.push(r.perk.board)
  }
  assert.deepEqual(boards, [1, 2, 3])
  assert.equal(dayActive(d), false)
  assert.equal(DAY_BOARDS, 3)
})

test('double coins is capped', () => {
  assert.equal(dayCoins(20), 20)
  assert.equal(dayCoins(225), DAY_COIN_CAP)
  assert.equal(dayCoins(-4), 0)
})

test('no buddy owned: a guest is featured and keeps the rotation clean', () => {
  const d = startBuddyDay(EMPTY_DAY, [])
  assert.equal(d.pet, null)
  assert.equal(d.kind, 'hint')
  assert.ok(dayActive(d))
})

test('save / load / junk', () => {
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  const d = startBuddyDay(EMPTY_DAY, ['leo', 'nox'])
  saveDay(store, d)
  assert.deepEqual(loadDay(store), d)
  assert.deepEqual(sanitizeDay('junk'), EMPTY_DAY)
  assert.equal(sanitizeDay({ pet: 'dragon', used: 99 }).pet, null)
  assert.equal(sanitizeDay({ pet: 'leo', used: 99, kind: 'x' }).used, 3)
  assert.equal(loadDay(null).used, 3)
})
