import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

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
  assert.equal(P.GIFT_TAG, 'Gift from Roman')
  assert.ok(a.message.startsWith('Gift from Roman: '), a.message)
  assert.ok(!/Tony/.test(a.message))
  assert.equal(a.state.owned.leo?.gift, true)
  assert.equal(a.state.active, 'leo')
  assert.ok(a.state.redeemed.includes('ROMA-AAAA'))
  const dup = P.applyGift(a.state, 100, { kind: 'pet', pet: 'leo' }, 'ROMA-BBBB', NOW)
  assert.equal(dup.coins, 1050)
  s = P.applyGift(s, 0, { kind: 'coupon', pct: 40, pet: null, days: 3 }, 'ROMA-CCCC', NOW).state
  assert.equal(P.couponFor(s, 'invictus', NOW)?.pct, 40)
  assert.equal(P.couponFor(s, 'invictus', NOW + 4 * DAY), null)
  assert.equal(P.applyGift(s, 5, { kind: 'coins', amount: 250 }, 'ROMA-DDDD', NOW).coins, 255)
  assert.match(P.applyGift(s, 5, { kind: 'coins', amount: 250 }, 'ROMA-DDDD', NOW).message, /^Gift from Roman: \+250 coins!$/)
  assert.match(dup.message, /Roman's gift/)
})

test('9.30-b: gifts redeemed in 9.30-a (flag + gift coupons) load unchanged and display as Gift from Roman', () => {
  const old = P.sanitizePets({ owned: { aquila: { at: 1, xp: 5, gift: true } }, active: 'aquila', coupons: [{ id: 'g', pct: 30, pet: null, source: 'gift', expires: NOW + DAY }] })
  assert.equal(old.owned.aquila?.gift, true)
  assert.equal(old.coupons[0].source, 'gift')
  const ui = readFileSync(new URL('../src/components/Stable.tsx', import.meta.url), 'utf8')
  assert.ok(!/Tony/.test(ui), 'no Tony tag left in The Stable')
  assert.match(ui, /GIFT_TAG/)
})

test('9.30-b: gift says what it is: label, note (60 max), ready-to-send message, preview without using the code', async () => {
  assert.equal(P.giftLabel({ kind: 'pet', pet: 'aquila' }), 'Aquila the Eagle')
  assert.equal(P.giftLabel({ kind: 'coins', amount: 1500 }), '1,500 coins')
  assert.equal(P.giftLabel({ kind: 'coupon', pct: 30, pet: 'leo', days: 7 }), '30% off Leo the Lion Cub (7 days to use it)')
  assert.equal(P.giftLabel({ kind: 'coupon', pct: 20, pet: null, days: 1 }), '20% off any buddy (1 day to use it)')
  assert.equal(P.cleanGiftNote('  Happy\nbirthday!\u0007 '), 'Happy birthday!')
  assert.equal(P.cleanGiftNote('x'.repeat(100)).length, P.GIFT_NOTE_MAX)
  assert.equal(P.cleanGiftNote(42), '')
  const msg = P.giftShareMessage({ gift: { kind: 'pet', pet: 'aquila' }, code: 'ROMA-7K2P', link: 'https://romans-game.netlify.app/?gift=ROMA-7K2P', note: 'Happy birthday' })
  assert.equal(msg, `Roman sent you a gift in Roman's Game: Aquila the Eagle! "Happy birthday" Tap to claim: https://romans-game.netlify.app/?gift=ROMA-7K2P (code ROMA-7K2P, works once)`)
  assert.ok(!P.giftShareMessage({ gift: { kind: 'coins', amount: 500 }, code: 'ROMA-AAAA', link: 'L' }).includes('"'))
  // claim message carries the note
  assert.match(P.applyGift(P.emptyPets(), 0, { kind: 'coins', amount: 500 }, 'ROMA-AAAA', NOW, 'Happy birthday').message, /^Gift from Roman: \+500 coins! "Happy birthday"$/)
  // peek shows it without using it; after the claim, peek says used
  const store = G.memoryGiftStore()
  const code = await G.createGift(store, { kind: 'pet', pet: 'aquila' }, 'Happy birthday, with a much too long note that keeps going and going and going')
  const p1 = await G.peekGift(store, code)
  assert.ok(p1.ok && p1.gift.kind === 'pet' && p1.note.length <= P.GIFT_NOTE_MAX && p1.note.startsWith('Happy birthday'))
  assert.ok((await G.peekGift(store, code)).ok, 'peeking twice is fine')
  const r = await G.redeemGift(store, code)
  assert.ok(r.ok && r.note === p1.note)
  const p2 = await G.peekGift(store, code)
  assert.ok(!p2.ok && p2.status === 409)
  assert.equal((await G.peekGift(store, 'ROMA-ZZZZ')).ok, false)
})

test('9.30-b packs: All buddies pack (holiday optional), custom pack validation, one code one claim, one message', async () => {
  const all = P.allBuddiesPack()
  assert.deepEqual(all.items.map((i) => (i.kind === 'pet' ? i.pet : i.kind)), ['lupa', 'aquila', 'leo', 'invictus'])
  assert.deepEqual(P.allBuddiesPack(true).items.length, 5)
  assert.equal(P.giftLabel(all), 'All buddies pack: Lupa the Wolf Pup, Aquila the Eagle, Leo the Lion Cub and Invictus the War Horse')
  const custom = { kind: 'pack', pack: 'custom', items: [{ kind: 'pet', pet: 'lupa' }, { kind: 'coins', amount: 1000 }, { kind: 'coupon', pct: 30, pet: null, days: 7 }] } as const
  assert.deepEqual(G.parseGift(custom), custom)
  assert.equal(
    P.giftShareMessage({ gift: custom as never, code: 'ROMA-7K2P', link: 'L', note: 'Happy birthday' }),
    `Roman sent you a gift in Roman's Game: Gift pack: Lupa the Wolf Pup, 1,000 coins and 30% off any buddy (7 days to use it)! "Happy birthday" Tap to claim: L (code ROMA-7K2P, works once)`,
  )
  // bad packs are refused
  assert.equal(G.parseGift({ kind: 'pack', items: [] }), null)
  assert.equal(G.parseGift({ kind: 'pack', items: [{ kind: 'pet', pet: 'lupa' }, { kind: 'pet', pet: 'lupa' }] }), null)
  assert.equal(G.parseGift({ kind: 'pack', items: [{ kind: 'coins', amount: 10 }, { kind: 'coins', amount: 20 }] }), null)
  assert.equal(G.parseGift({ kind: 'pack', items: [{ kind: 'pet', pet: 'dragon' }] }), null)
  assert.equal(G.parseGift({ kind: 'pack', items: [{ kind: 'pack', items: [{ kind: 'pet', pet: 'lupa' }] }] }), null)
  assert.equal(G.parseGift({ kind: 'pack', items: Array.from({ length: 9 }, () => ({ kind: 'pet', pet: 'lupa' })) }), null)
  assert.equal((G.parseGift({ kind: 'pack', pack: 'weird', items: [{ kind: 'pet', pet: 'lupa' }] }) as { pack: string }).pack, 'custom')
  // one code, one claim (preview shows the whole pack first)
  const store = G.memoryGiftStore()
  const code = await G.createGift(store, all, 'For Roman')
  const peek = await G.peekGift(store, code)
  assert.ok(peek.ok && peek.gift.kind === 'pack' && peek.gift.items.length === 4)
  const race = await Promise.all([G.redeemGift(store, code), G.redeemGift(store, code)])
  assert.equal(race.filter((r) => r.ok).length, 1)
  // applying: new buddies join (tagged), owned ones become coins, coupon added, one message
  let s = P.emptyPets()
  s = P.buyPet(s, 99999, 'aquila', NOW).state as typeof s
  const out = P.applyGift(s, 100, all, code, NOW, 'For Roman')
  assert.deepEqual(Object.keys(out.state.owned).sort(), ['aquila', 'invictus', 'leo', 'lupa'])
  assert.equal(out.state.owned.lupa?.gift, true)
  assert.equal(out.state.owned.aquila?.gift, undefined)
  assert.equal(out.coins, 100 + 600)
  assert.equal(out.state.active, 'lupa')
  assert.equal(out.message, 'Gift from Roman: Lupa, Leo and Invictus joined your Stable, +600 coins (you already had Aquila)! "For Roman"')
  assert.deepEqual(out.state.redeemed, [code])
  const c = P.applyGift(P.emptyPets(), 0, custom as never, 'ROMA-BBBB', NOW)
  assert.equal(c.message, 'Gift from Roman: Lupa joined your Stable, +1,000 coins, 30% off any buddy!')
  assert.equal(c.coins, 1000)
  assert.equal(c.state.coupons[0].source, 'gift')
})

test('9.30-b bundles: coin prices (15% / 20% off), only missing buddies, coins only, no coupon stacking', () => {
  const s0 = P.emptyPets()
  const starter = P.bundleQuote(s0, 'starter', NOW)
  assert.equal(starter.full, 3600 + 6000)
  assert.equal(starter.price, 8160)
  assert.equal(starter.save, 1440)
  const full = P.bundleQuote(s0, 'full', NOW)
  assert.equal(full.full, 3600 + 6000 + 9500 + 25000)
  assert.equal(full.price, 35280)
  for (const b of P.BUNDLES) assert.ok(!b.pets.some((id) => P.petById(id)!.limited), 'no holiday buddies in bundles')
  // own Lupa: Starter isn't offered (one left), Full prices the other 3
  const withLupa = P.buyPet(s0, 99999, 'lupa', NOW).state as typeof s0
  assert.equal(P.bundleQuote(withLupa, 'starter', NOW).available, false)
  const f2 = P.bundleQuote(withLupa, 'full', NOW)
  assert.deepEqual(f2.missing, ['aquila', 'leo', 'invictus'])
  assert.equal(f2.price, Math.round(((6000 + 9500 + 25000) * 0.8) / 10) * 10)
  // buying
  assert.deepEqual(P.buyBundle(s0, 8159, 'starter', NOW), { ok: false, reason: 'Need 1 more coins' })
  const coupon = P.awardStreakCoupon(s0, 7, NOW).state
  const r = P.buyBundle(coupon, 9000, 'starter', NOW)
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.coins, 840)
    assert.equal(r.spent, 8160)
    assert.deepEqual(r.got, ['lupa', 'aquila'])
    assert.equal(r.state.active, 'aquila')
    assert.equal(r.state.coupons.length, coupon.coupons.length, 'coupon is kept, not used')
    assert.equal(r.state.owned.lupa?.gift, undefined)
    assert.equal(P.buyBundle(r.state, 99999, 'starter', NOW).ok, false)
  }
  // a trial buddy keeps its XP when bought in a bundle
  const tr = { ...s0, trial: { id: 'leo' as const, until: NOW + DAY, xp: 40 }, active: 'leo' as const }
  const r2 = P.buyBundle(tr, 99999, 'full', NOW)
  assert.ok(r2.ok && r2.state.owned.leo?.xp === 40 && r2.state.trial === null && r2.state.active === 'invictus')
})
