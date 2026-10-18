import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const E = await import('../src/game/economy.ts')
const P = await import('../src/game/pets.ts')

test('economy config: one set of numbers for guests and signed-in players', () => {
  assert.equal(E.winBaseCoins(1800), 45)
  assert.equal(E.winBaseCoins(0), 10)
  assert.equal(E.winBaseCoins(99999), 80)
  assert.equal(E.dailyChallengeCoins(1), 25)
  assert.equal(E.dailyChallengeCoins(9), 50)
  assert.deepEqual(E.BUDDY_PRICES, { lupa: 2500, aquila: 4500, leo: 7500, invictus: 15000, nox: 3500 })
  assert.deepEqual(E.WELCOME_BUDDY_IDS, ['lupa', 'aquila', 'leo'])
  assert.equal(E.isWelcomeBuddy('invictus'), false)
  assert.equal(E.isWelcomeBuddy('nox'), false)
  assert.equal(E.TREAT_OFFERS.snack.cost, 35)
  assert.equal(E.TREAT_OFFERS.feast.cost, 100)
  assert.equal(E.TREAT_OFFERS.banquet.cost, 250)
  assert.equal(E.ECONOMY.maxFeedsPerDay, 3)
  assert.equal(E.ECONOMY.moodDecayPerHour, 3)
  assert.equal(E.ECONOMY.fountainCoins, 20)
  assert.equal(E.ECONOMY.fountainHold, 2)
  assert.equal(E.ECONOMY.weeklySpendCapCadCents, 5000)
  assert.equal(E.ECONOMY.snackCoinSwap, false)
  assert.deepEqual(E.DAILY_GIFTS.map((g) => g.coins), [40, 50, 60, 70, 80, 90, 150])
  for (const id of ['lupa', 'aquila', 'leo', 'invictus', 'nox'] as const) {
    assert.equal(P.petById(id)!.price, E.BUDDY_PRICES[id])
  }
})

test('mood never zeroes an ability, and a missed gift day pauses', () => {
  assert.equal(E.scaleAbility(0, 0.75), 0)
  assert.equal(E.scaleAbility(6, 0.75), 5)
  assert.equal(E.moodTier(90).name, 'Joyful')
  assert.equal(E.moodTier(20).strength, 0.75)
  const paused = E.claimDailyGift({ v: 1, next: 2, lastClaim: '2026-10-01' }, '2026-10-05', () => '2026-10-04')
  assert.equal(paused.paused, true)
  assert.equal(paused.state.next, 3)
  assert.equal(paused.reward?.coins, 60)
  const held = E.claimDailyGift(paused.state, '2026-10-05', () => '2026-10-04')
  assert.equal(held.already, true)
  assert.equal(held.state.next, 3)
})

test('fountain holds two charges and field treats are capped', () => {
  const start = E.emptyFountain(0)
  const banked = E.accrueFountain(start, E.ECONOMY.fountainIntervalMs * 5)
  assert.equal(banked.stored, 2)
  const claimed = E.claimFountain(banked, E.ECONOMY.fountainIntervalMs * 5)
  assert.equal(claimed.coins, 40)
  assert.equal(claimed.state.stored, 0)
  let day = E.emptyTreatDay('d')
  let got = 0
  for (let i = 0; i < 8; i++) {
    const t = E.takeFieldTreats(day, 'd', 'win', 5)
    day = t.day
    got += t.granted
  }
  assert.equal(got, 5)
  const defense = E.takeFieldTreats(day, 'd', 'defense', 99)
  assert.equal(defense.granted, 10)
})

test('weekly cap is CA$50 and welcome buddies exclude Invictus and Nox', () => {
  assert.equal(E.canSpend(0, 699).ok, true)
  assert.equal(E.canSpend(4500, 699).ok, false)
  assert.match(E.canSpend(4500, 699).reason || '', /CA\$50/)
  const free = P.claimFreePet(P.emptyPets(), 'invictus', Date.UTC(2026, 9, 18))
  assert.equal(free.ok, false)
  const nox = P.claimFreePet(P.emptyPets(), 'nox', Date.UTC(2026, 9, 18))
  assert.equal(nox.ok, false)
  const lupa = P.claimFreePet(P.emptyPets(), 'lupa', Date.UTC(2026, 9, 18))
  assert.equal(lupa.ok, true)
})
