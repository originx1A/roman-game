import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const P = await import('../src/game/pets.ts')
const G = await import('../netlify/lib/gifts.ts')

const NOW = Date.UTC(2026, 8, 28, 16) // Sep 28 2026, noon Toronto
const DAY = P.DAY_MS

test('economy: prices sit where the spec wants them, measured from the reward code', () => {
  const e = P.estimateEconomy()
  assert.ok(e.perWin >= 150 && e.perWin <= 320, `per win ${e.perWin}`)
  assert.ok(e.net >= 900 && e.net <= 1600, `net/day ${e.net}`)
  const days = (id: string) => P.daysToAfford(P.petById(id)!.price, e.net)
  assert.ok(days('lupa') >= 2 && days('lupa') <= 4, `common ${days('lupa')} days`)
  assert.ok(days('aquila') > days('lupa') && days('leo') > days('aquila'))
  assert.ok(days('invictus') >= 14, `legendary ${days('invictus')} days`)
  // a casual player (3 wins/day) still gets a common inside a week
  assert.ok(P.daysToAfford(3600, P.estimateEconomy({ winsPerDay: 3 }).net) <= 7)
})

test('perks: one small perk each, growing modestly with level', () => {
  assert.equal(P.perkFor('lupa', 1).coins, 6)
  assert.equal(P.perkFor('lupa', 10).coins, 15)
  assert.equal(P.perkFor('aquila', 5).hints, 1)
  assert.equal(P.perkFor('aquila', 6).hints, 2)
  assert.equal(P.perkFor('leo', 1).hearts, 1)
  assert.equal(P.perkFor('leo', 4).coins, 0)
  assert.equal(P.perkFor('leo', 5).coins, 3)
  assert.equal(P.perkFor('invictus', 1).coinPct, 10)
  assert.equal(P.perkFor('invictus', 10).coinPct, 19)
  assert.equal(P.perkFor('nox', 1).rescues, 1)
  assert.equal(P.petWinCoins(250, P.perkFor('invictus', 1)), 25)
  assert.equal(P.petWinCoins(250, null), 0)
  for (const p of P.PETS) for (let l = 1; l <= 10; l++) assert.ok(P.perkFor(p.id, l).label.length > 5)
})

test('levels: growth bar, max level 10', () => {
  assert.deepEqual(P.levelInfo(0), { level: 1, into: 0, need: 30, max: false })
  assert.equal(P.levelInfo(30).level, 2)
  assert.equal(P.levelInfo(10_000).level, 10)
  assert.equal(P.levelInfo(10_000).max, true)
  let s = P.emptyPets()
  const b = P.buyPet(s, 5000, 'lupa', NOW)
  assert.ok(b.ok)
  s = b.state
  const r = P.addPetXp(s, 'lupa', P.winXp({ perfect: true, record: true }) + 10, NOW)
  assert.equal(r.levelUp, 2)
  assert.equal(P.addPetXp(s, 'aquila', 20, NOW).state, s, 'no XP for a buddy you do not have')
})

test('buying: coins only, owned forever, auto-equips, no double buy', () => {
  let s = P.emptyPets()
  assert.equal(P.buyPet(s, 100, 'lupa', NOW).ok, false)
  const b = P.buyPet(s, 4000, 'lupa', NOW)
  assert.ok(b.ok && b.coins === 400 && b.spent === 3600)
  s = b.state
  assert.equal(P.activePet(s, NOW), 'lupa')
  assert.equal(P.buyPet(s, 99999, 'lupa', NOW).ok, false)
  s = P.equip(s, null, NOW)
  assert.equal(P.activePet(s, NOW), null, 'Solo')
  assert.equal(P.equip(s, 'leo', NOW).active, null, 'cannot equip a locked buddy')
  assert.ok(P.sanitizePets(JSON.parse(JSON.stringify(s))).owned.lupa, 'survives save/load')
})

test('coupons: 20% streak, 30% trial clear, best one used, one per purchase, they expire', () => {
  let s = P.emptyPets()
  assert.equal(P.awardStreakCoupon(s, 6, NOW).coupon, null)
  const st = P.awardStreakCoupon(s, 7, NOW)
  assert.equal(st.coupon?.pct, 20)
  assert.equal(st.coupon?.pet, 'lupa', 'cheapest locked buddy')
  assert.equal(P.awardStreakCoupon(st.state, 7, NOW).coupon, null, 'once per streak milestone')
  s = st.state
  const tc = P.awardTrialClearCoupon(s, NOW, () => 0)
  assert.equal(tc.coupon?.pct, 30)
  s = tc.state
  assert.equal(P.couponFor(s, 'lupa', NOW)?.pct, 30, 'best coupon wins')
  const b = P.buyPet(s, 3600, 'lupa', NOW)
  assert.ok(b.ok)
  assert.equal(b.spent, 2520)
  assert.equal(b.state.coupons.length, 1, 'only one coupon used')
  assert.equal(b.state.coupons[0].pct, 20)
  // expiry
  assert.equal(P.couponFor(s, 'lupa', NOW + 8 * DAY), null)
  assert.equal(P.priceWith(3600, null), 3600)
  // cap
  let many = P.emptyPets()
  for (let i = 0; i < 10; i++) many = P.awardTrialClearCoupon(many, NOW + i, () => 0.5).state
  assert.equal(many.coupons.length, P.MAX_COUPONS)
})

test('trial buddies: 24h, then gone with a 25% coupon for that buddy', () => {
  let s = P.emptyPets()
  const g = P.grantTrial(s, NOW, () => 0.99)
  assert.ok(g.pet)
  s = g.state
  assert.equal(P.activePet(s, NOW + 23 * 3600e3), g.pet)
  assert.ok(P.activePerk(s, NOW))
  assert.equal(P.expireTrial(s, NOW + 23 * 3600e3).expired, null)
  assert.equal(P.activePet(s, NOW + P.TRIAL_MS + 1), null, 'no perk after 24h even before expiry runs')
  const e = P.expireTrial(s, NOW + P.TRIAL_MS + 1)
  assert.equal(e.expired, g.pet)
  assert.equal(e.state.trial, null)
  assert.equal(e.state.active, null)
  const c = P.couponFor(e.state, g.pet!, NOW + P.TRIAL_MS + 2)
  assert.equal(c?.pct, 25)
  assert.equal(c?.source, 'trial-end')
  // buying during the trial keeps its growth
  const t2 = P.addPetXp(g.state, g.pet!, 40, NOW).state
  const b = P.buyPet(t2, 99999, g.pet!, NOW)
  assert.ok(b.ok && b.state.owned[g.pet!]!.xp === 40 && b.state.trial === null)
})

test('holiday buddy: on sale Oct 15 - Nov 2 (Toronto), kept forever with a Limited badge', () => {
  const owl = P.petById('nox')!
  assert.equal(owl.tier, 'limited')
  const at = (m: number, d: number, h = 12) => Date.UTC(2026, m - 1, d, h + 4)
  assert.equal(P.onSale(owl, at(10, 14)), false)
  assert.equal(P.onSale(owl, at(10, 15, 0)), true)
  assert.equal(P.onSale(owl, at(11, 2, 23)), true)
  assert.equal(P.onSale(owl, at(11, 3)), false)
  assert.equal(P.buyPet(P.emptyPets(), 99999, 'nox', NOW).ok, false)
  const b = P.buyPet(P.emptyPets(), 99999, 'nox', at(10, 20))
  assert.ok(b.ok)
  assert.equal(P.activePet(b.state, at(12, 25)), 'nox', 'kept after the window')
  assert.ok(!P.lockedForSale(P.emptyPets(), NOW).some((p) => p.id === 'nox'), 'no coupons/trials for an off-season owl')
})

test('migration: older saves and junk load as Solo with no buddies', () => {
  for (const raw of [undefined, null, 42, 'x', {}, { owned: 5 }, { active: 'leo' }, { coupons: [{ pct: 500 }] }]) {
    const s = P.sanitizePets(raw)
    assert.equal(s.active, null)
    assert.deepEqual(s.owned, {})
    assert.equal(s.coupons.length, 0)
  }
  const s = P.sanitizePets({ owned: { lupa: { xp: 99, gift: true }, bogus: { xp: 1 } }, active: 'lupa', coupons: [{ id: 'a', pct: 20, pet: 'leo', source: 'streak', expires: NOW + 1 }] })
  assert.equal(s.active, 'lupa')
  assert.equal(s.owned.lupa?.gift, true)
  assert.equal(s.coupons.length, 1)
})

test('gift codes: format, validation, one-time redeem', async () => {
  for (let i = 0; i < 200; i++) assert.match(G.makeGiftCode(), P.GIFT_CODE_RE)
  assert.equal(P.normalizeGiftCode(' roma 7k2p '), 'ROMA-7K2P')
  assert.equal(P.normalizeGiftCode('7k2p'), 'ROMA-7K2P')
  assert.deepEqual(G.parseGift({ kind: 'pet', pet: 'leo' }), { kind: 'pet', pet: 'leo' })
  assert.equal(G.parseGift({ kind: 'pet', pet: 'dragon' }), null)
  assert.equal(G.parseGift({ kind: 'coins', amount: 1e9 }), null)
  assert.deepEqual(G.parseGift({ kind: 'coupon', pct: 30, pet: '' }), { kind: 'coupon', pct: 30, pet: null, days: 7 })
  assert.equal(G.parseGift({ kind: 'coupon', pct: 95 }), null)

  const store = G.memoryGiftStore()
  const code = await G.createGift(store, { kind: 'pet', pet: 'aquila' }, 'for Roman')
  const first = await G.redeemGift(store, code.toLowerCase())
  assert.ok(first.ok)
  const again = await G.redeemGift(store, code)
  assert.equal(again.ok, false)
  assert.equal(!again.ok && again.status, 409)
  const racers = await Promise.all([1, 2, 3].map(async () => G.redeemGift(store, await G.createGift(store, { kind: 'coins', amount: 100 }, ''))))
  assert.ok(racers.every((r) => r.ok))
  const c2 = await G.createGift(store, { kind: 'coins', amount: 100 }, '')
  const race = await Promise.all([G.redeemGift(store, c2), G.redeemGift(store, c2), G.redeemGift(store, c2)])
  assert.equal(race.filter((r) => r.ok).length, 1, 'only one wins a race')
  assert.equal((await G.redeemGift(store, 'ROMA-ZZZZ')).ok, false)
  assert.equal((await G.redeemGift(store, 'hello')).ok, false)
  // collisions retry
  let n = 0
  const fixed = (k: number) => new Uint8Array(k).fill(n++ < 4 ? 0 : 5)
  const s2 = G.memoryGiftStore()
  const a = await G.createGift(s2, { kind: 'coins', amount: 50 }, '', fixed)
  n = 0
  const b = await G.createGift(s2, { kind: 'coins', amount: 50 }, '', fixed)
  assert.notEqual(a, b)
})

test('owner passphrase: timing-safe, never matches when unset', () => {
  assert.equal(G.ownerKeyConfigured({}), false)
  assert.equal(G.ownerKeyMatches('anything', {}), false)
  const env = { ROMAN_OWNER_KEY: 'test-pass-123' }
  assert.equal(G.ownerKeyConfigured(env), true)
  assert.equal(G.ownerKeyMatches('test-pass-123', env), true)
  assert.equal(G.ownerKeyMatches('test-pass-12', env), false)
  assert.equal(G.ownerKeyMatches('', env), false)
  assert.equal(G.ownerKeyMatches(undefined, env), false)
})

test('applying gifts: buddy with Gift tag, coins, coupon; owned buddy turns into coins', () => {
  let s = P.emptyPets()
  const a = P.applyGift(s, 100, { kind: 'pet', pet: 'leo' }, 'ROMA-AAAA', NOW)
  assert.equal(a.state.owned.leo?.gift, true)
  assert.equal(a.state.active, 'leo')
  assert.ok(a.state.redeemed.includes('ROMA-AAAA'))
  const dup = P.applyGift(a.state, 100, { kind: 'pet', pet: 'leo' }, 'ROMA-BBBB', NOW)
  assert.equal(dup.coins, 1050)
  s = P.applyGift(s, 0, { kind: 'coupon', pct: 40, pet: null, days: 3 }, 'ROMA-CCCC', NOW).state
  assert.equal(P.couponFor(s, 'invictus', NOW)?.pct, 40)
  assert.equal(P.couponFor(s, 'invictus', NOW + 4 * DAY), null)
  assert.equal(P.applyGift(s, 5, { kind: 'coins', amount: 250 }, 'ROMA-DDDD', NOW).coins, 255)
})
