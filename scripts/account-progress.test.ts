import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const A = await import('../src/game/accountProgress.ts')

const guest = {
  wallet: { coins: 80 },
  pets: { owned: { lupa: { xp: 10 } } },
  records: null,
  clears: [{ puzzleId: 'dawn', bestMs: 1000, bestScore: 50, clears: 1 }],
}

test('a new account adopts guest progress instead of resetting it', () => {
  const out = A.adoptOnSignIn(A.emptyStoredProgress(), 'user-a', guest)
  assert.equal(out.adoptedGuest, true)
  assert.equal(out.active.wallet?.coins, 80)
  assert.equal(out.active.pets?.owned?.lupa?.xp, 10)
  assert.equal(out.active.clears[0].puzzleId, 'dawn')
  assert.equal(out.stored.owner, 'user-a')
})

test('the same account keeps the richer save', () => {
  const first = A.adoptOnSignIn(A.emptyStoredProgress(), 'user-a', guest)
  const parked = A.parkOnSignOut(first.stored, first.active)
  const richer = { ...guest, wallet: { coins: 120 }, clears: [{ puzzleId: 'dawn', bestMs: 800, bestScore: 90, clears: 2 }] }
  const back = A.adoptOnSignIn(parked, 'user-a', richer)
  assert.equal(back.adoptedGuest, false)
  assert.equal(back.active.wallet?.coins, 120)
  assert.equal(back.active.clears[0].bestScore, 90)
  assert.equal(back.active.clears[0].clears, 2)
})

test('a different account does not inherit the previous coins', () => {
  const first = A.adoptOnSignIn(A.emptyStoredProgress(), 'user-a', guest)
  const parked = A.parkOnSignOut(first.stored, first.active)
  const other = A.adoptOnSignIn(parked, 'user-b', guest)
  assert.equal(other.active.wallet, null)
  assert.equal(other.stored.accounts['user-a'].wallet?.coins, 80)
})
