import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BUDDY_HUNT_BUDDIES,
  BUDDY_HUNT_COINS,
  BUDDY_HUNT_PERFECT_WINS,
  EMPTY_METER,
  applyHuntPrize,
  huntPrize,
  isPerfectWin,
  placeBuddies,
  recordWin,
  sanitizeMeter,
  showSpinPrize,
  startHunt,
} from '../src/game/buddyHunt.ts'
import { HINT_COST } from '../src/game/rewards.ts'

test('goal is 3 perfect wins', () => assert.equal(BUDDY_HUNT_PERFECT_WINS, 3))

test('perfect = no hints, no flaws, no hearts lost', () => {
  assert.equal(isPerfectWin({ hintsUsed: 0, flawed: false, livesLost: 0 }), true)
  assert.equal(isPerfectWin({ hintsUsed: 1, flawed: false, livesLost: 0 }), false)
  assert.equal(isPerfectWin({ hintsUsed: 0, flawed: true, livesLost: 0 }), false)
  assert.equal(isPerfectWin({ hintsUsed: 0, flawed: false, livesLost: 1 }), false)
})

test('three perfect wins fill the meter, which resets and marks a hunt pending', () => {
  let m = EMPTY_METER
  let r = recordWin(m, true)
  assert.deepEqual(r.meter, { notches: 1, pending: false })
  assert.equal(r.filledNow, false)
  r = recordWin(r.meter, true)
  assert.deepEqual(r.meter, { notches: 2, pending: false })
  r = recordWin(r.meter, true)
  assert.deepEqual(r.meter, { notches: 0, pending: true })
  assert.equal(r.filledNow, true)
  m = startHunt(r.meter)
  assert.deepEqual(m, { notches: 0, pending: false })
})

test('non-perfect wins leave the meter alone', () => {
  const m = { notches: 2, pending: false }
  assert.deepEqual(recordWin(m, false).meter, m)
})

test('perfect wins do not stack while a hunt is pending', () => {
  const m = { notches: 0, pending: true }
  const r = recordWin(m, true)
  assert.deepEqual(r.meter, m)
  assert.equal(r.filledNow, false)
})

test('goal constant is tunable', () => {
  let m = EMPTY_METER
  m = recordWin(m, true, 2).meter
  const r = recordWin(m, true, 2)
  assert.equal(r.filledNow, true)
})

test('saved meter is sanitized', () => {
  assert.deepEqual(sanitizeMeter(null), EMPTY_METER)
  assert.deepEqual(sanitizeMeter({ notches: 9, pending: 'yes' }), { notches: 2, pending: false })
  assert.deepEqual(sanitizeMeter({ notches: -3, pending: true }), { notches: 0, pending: true })
  assert.deepEqual(sanitizeMeter({ notches: 1.7 }), { notches: 1, pending: false })
})

test('spin prize hides only on the win that just earned the hunt', () => {
  assert.equal(showSpinPrize(2, true, true), false)
  // a pending hunt from an earlier win no longer hides the wheel
  assert.equal(showSpinPrize(2, true, false), true)
  assert.equal(showSpinPrize(2, true), true)
  assert.equal(showSpinPrize(2, false), true)
  assert.equal(showSpinPrize(0, false), false)
})

test('buddies: 3 distinct tiles on a 4x4 grid', () => {
  for (let k = 0; k < 200; k++) {
    const b = placeBuddies()
    assert.equal(b.length, BUDDY_HUNT_BUDDIES)
    assert.equal(new Set(b).size, BUDDY_HUNT_BUDDIES)
    b.forEach((i) => assert.ok(i >= 0 && i < 16))
  }
  let seed = 1
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const a = placeBuddies(rng)
  seed = 1
  assert.deepEqual(placeBuddies(rng), a)
})

test('prizes scale with buddies found', () => {
  const w = { coins: 100, freeHints: 0, bonusHearts: 0 }
  const p0 = huntPrize(0, w, 3)
  assert.deepEqual([p0.coins, p0.freeHints, p0.bonusHearts], [0, 0, 0])
  const p1 = huntPrize(1, w, 3)
  const p2 = huntPrize(2, w, 3)
  const p3 = huntPrize(3, w, 3)
  assert.ok(p1.coins > 0 && p2.coins > p1.coins && p3.coins >= p2.coins)
  assert.deepEqual([p1.freeHints, p1.bonusHearts, p2.freeHints, p2.bonusHearts], [0, 0, 0, 0])
  assert.equal(p3.bonusHearts, 1)
  assert.equal(p3.freeHints, 0)
})

test('all three with a full heart stash wins a free hint instead', () => {
  const p = huntPrize(3, { coins: 0, freeHints: 0, bonusHearts: 3 }, 3)
  assert.equal(p.bonusHearts, 0)
  assert.equal(p.freeHints, 1)
})

test('coin prizes stay small (a best hunt pays less than a board win minimum of 20)', () => {
  assert.ok(BUDDY_HUNT_COINS[3] < 20)
  assert.ok(BUDDY_HUNT_COINS[1] < HINT_COST)
})

test('applying a prize adds to the wallet and keeps other fields', () => {
  const w = { coins: 10, freeHints: 1, bonusHearts: 0, spins: 2 }
  const next = applyHuntPrize(w, huntPrize(3, w, 3))
  assert.deepEqual(next, { coins: 25, freeHints: 1, bonusHearts: 1, spins: 2 })
  assert.equal(huntPrize(7, w, 3).coins, BUDDY_HUNT_COINS[3])
})
