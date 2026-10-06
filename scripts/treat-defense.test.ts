import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const P = await import('../src/game/pets.ts')

test('earnFieldTreats adds to the pile, floored and capped', () => {
  let s = P.emptyPets()
  assert.equal(s.fieldTreats, 0)
  s = P.earnFieldTreats(s, 12)
  assert.equal(s.fieldTreats, 12)
  s = P.earnFieldTreats(s, -5)
  assert.equal(s.fieldTreats, 12, 'negative ignored')
  s = P.earnFieldTreats(s, 1e9)
  assert.equal(s.fieldTreats, P.MAX_FIELD_TREATS, 'capped')
})

test('stealFieldTreats never takes more than the pile, safe stash untouched', () => {
  const s = { ...P.emptyPets(), fieldTreats: 12, treats: { snack: 5, feast: 2 } }
  const r = P.stealFieldTreats(s, 50)
  assert.equal(r.stolen, 12)
  assert.equal(r.state.fieldTreats, 0)
  assert.deepEqual(r.state.treats, { snack: 5, feast: 2 }, 'safe stash untouched')
  const r2 = P.stealFieldTreats(r.state, 5)
  assert.equal(r2.stolen, 0, 'empty pile steals nothing')
})

test('claimFieldTreats moves pile to snack stash up to MAX_TREAT_STOCK, leftover stays', () => {
  const s = { ...P.emptyPets(), fieldTreats: 20, treats: { snack: 0, feast: 0 } }
  const c = P.claimFieldTreats(s)
  assert.equal(c.claimed, P.MAX_TREAT_STOCK)
  assert.equal(c.state.treats.snack, P.MAX_TREAT_STOCK)
  assert.equal(c.state.fieldTreats, 20 - P.MAX_TREAT_STOCK, 'leftover stays in the pile')
  const c2 = P.claimFieldTreats(c.state)
  assert.equal(c2.claimed, 0, 'stash full claims nothing')
})

test('swapTreatsToCoins converts snacks at the rate, errors when short', () => {
  const s = { ...P.emptyPets(), treats: { snack: 7, feast: 1 } }
  const ok = P.swapTreatsToCoins(s, 100, 7)
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.coins, 100 + 7 * P.SNACK_COIN_RATE)
    assert.equal(ok.gained, 7 * P.SNACK_COIN_RATE)
    assert.equal(ok.state.treats.snack, 0)
    assert.equal(ok.state.treats.feast, 1, 'feasts never swapped')
  }
  const short = P.swapTreatsToCoins(s, 100, 99)
  assert.equal(short.ok, false)
})

test('sanitizePets keeps fieldTreats from old saves (default 0)', () => {
  const old = P.sanitizePets({ v: 1, owned: {}, treats: { snack: 3, feast: 1 } })
  assert.equal(old.fieldTreats, 0)
  const kept = P.sanitizePets({ v: 1, owned: {}, treats: { snack: 0, feast: 0 }, fieldTreats: 42 })
  assert.equal(kept.fieldTreats, 42)
})

test('weaponFor returns the best earned tier, null below 5', () => {
  assert.equal(P.weaponFor(1), null)
  assert.equal(P.weaponFor(4), null)
  assert.equal(P.weaponFor(5)?.name, 'Wooden Sword')
  assert.equal(P.weaponFor(17)?.name, "Hunter's Bow")
  assert.equal(P.weaponFor(30)?.name, 'Golden Trident')
  assert.equal(P.weaponFor(99)?.name, 'Golden Trident', 'caps at top tier')
})
