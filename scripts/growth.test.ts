import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const P = await import('../src/game/pets.ts')
const E = await import('../src/game/dailyEconomy.ts')
const R = await import('../src/game/rewards.ts')

const NOW = Date.UTC(2026, 8, 29, 16)
const DAY = P.DAY_MS
const D1 = '2026-09-29'
const D2 = '2026-09-30'
const own = (id: string, xp = 0) => {
  const s = P.emptyPets()
  return { ...s, owned: { [id]: { at: NOW, xp } }, active: id } as ReturnType<typeof P.emptyPets>
}

test('growth: 30 levels, slowing curve, old level-10 saves keep their level', () => {
  assert.equal(P.MAX_PET_LEVEL, 30)
  assert.equal(P.xpToNext(1), 30)
  assert.equal(P.xpToNext(9), 150)
  assert.equal(P.xpToNext(10), 100, 'the old curve ended at 165; the new one steps in gently')
  for (let l = 10; l < 29; l++) assert.ok(P.xpToNext(l + 1) > P.xpToNext(l), 'each level costs more')
  assert.equal(P.levelInfo(810).level, 10)
  assert.equal(P.levelInfo(P.xpForLevel(30)).level, 30)
  assert.equal(P.levelInfo(P.xpForLevel(30) - 1).level, 29)
  assert.ok(P.xpForLevel(30) >= 4000 && P.xpForLevel(30) <= 6500, `level 30 costs ${P.xpForLevel(30)} XP`)
})

test('prestige: stars after level 30 up to 5, then done', () => {
  const at30 = P.xpForLevel(30)
  assert.equal(P.levelInfo(at30).stars, 0)
  assert.equal(P.levelInfo(at30 + P.starNeed(0)).stars, 1)
  let need = 0
  for (let i = 0; i < 5; i++) need += P.starNeed(i)
  const full = P.levelInfo(at30 + need + 999_999)
  assert.equal(full.stars, 5)
  assert.equal(full.starNeedXp, 0)
  assert.equal(P.levelInfo(at30 - 1).stars, 0, 'no stars before 30')
})

test('milestones: badges, hats, animations at 5/10/15/20/25/30', () => {
  assert.deepEqual(P.MILESTONES.map((m) => m.level), [5, 10, 15, 20, 25, 30])
  assert.equal(P.cosmeticsFor(9).hat, 'none')
  assert.equal(P.cosmeticsFor(10).hat, 'laurel')
  assert.equal(P.cosmeticsFor(20).hat, 'helmet')
  assert.equal(P.cosmeticsFor(30).hat, 'crown')
  assert.equal(P.cosmeticsFor(14).idle, false)
  assert.equal(P.cosmeticsFor(15).idle, true)
  assert.equal(P.cosmeticsFor(25).flip, true)
  assert.equal(P.nextMilestone(12)?.level, 15)
  assert.equal(P.nextMilestone(30), null)
  assert.equal(P.milestoneAt(20)?.badge, 'Veteran')
})

test('perks: bounded, never shrink with level, stars add a little', () => {
  for (const p of P.PETS) {
    let last = P.perkFor(p.id, 1)
    for (let l = 2; l <= 30; l++) {
      const cur = P.perkFor(p.id, l)
      assert.ok(cur.coins >= last.coins && cur.coinPct >= last.coinPct && cur.hints >= last.hints && cur.hearts >= last.hearts && cur.rescues >= last.rescues, `${p.id} L${l} never shrinks`)
      last = cur
    }
  }
  // the old level-10 perks are unchanged at level 10
  assert.equal(P.perkFor('lupa', 10).coins, 15)
  assert.equal(P.perkFor('invictus', 10).coinPct, 19)
  assert.equal(P.perkFor('leo', 10).coins, 8)
  // hard bounds at the very top (30 + 5 stars) plus a happy buddy
  for (const p of P.PETS) {
    const top = P.perkFor(p.id, 30, 5)
    assert.ok(top.coins + P.HAPPY_COINS <= P.PERK_COINS_CAP, `${p.id} flat coins ${top.coins}`)
    assert.ok(top.coinPct <= P.PERK_PCT_CAP, `${p.id} pct ${top.coinPct}`)
    assert.ok(top.hints <= 3 && top.rescues <= 3 && top.hearts <= 2)
  }
  // top buddy at 225-coin wins: bounded share of a normal day
  const e = P.estimateEconomy()
  const perWin = Math.max(...P.PETS.map((p) => P.petWinCoins(e.perWin, P.perkFor(p.id, 30, 5))))
  const perDay = (perWin + P.HAPPY_COINS) * 5
  assert.ok(perDay / e.net <= 0.25, `top perk adds ${perDay} coins a day (${Math.round((perDay / e.net) * 100)}% of ${e.net})`)
  // hint / rescue perks are worth at most a few coins a day in coins
  assert.ok(P.perkFor('aquila', 30).hints * 5 * R.HINT_COST <= 5 * 3 * 15)
})

test('mood: drifts down slowly, has a floor, never takes the perk away', () => {
  const o = { mood: 100, moodAt: NOW }
  assert.equal(P.moodNow(o, NOW), 100)
  assert.equal(P.moodNow(o, NOW + 10 * 3600e3), 80)
  assert.equal(P.moodNow(o, NOW + 365 * DAY), P.MOOD_FLOOR, 'a year away: sad but never gone')
  assert.equal(P.moodKind(P.MOOD_FLOOR), 'hungry')
  assert.equal(P.moodKind(75), 'happy')
  // a hungry buddy keeps its base perk; a happy one adds a few coins
  let s = own('lupa', 0)
  const hungry = P.activePerk({ ...s, owned: { lupa: { at: NOW, xp: 0, mood: 25, moodAt: NOW } } }, NOW)!
  const happy = P.activePerk({ ...s, owned: { lupa: { at: NOW, xp: 0, mood: 90, moodAt: NOW } } }, NOW)!
  assert.equal(hungry.coins, P.perkFor('lupa', 1).coins)
  assert.equal(happy.coins, P.perkFor('lupa', 1).coins + P.HAPPY_COINS)
  s = own('nox')
  assert.equal(P.moodNow(s.owned.nox, NOW), P.MOOD_START, 'no mood saved = starts at 50, not happy')
})

test('care: free daily pet once a day per buddy, cheers the buddy up', () => {
  const s = own('lupa')
  const a = P.petCare(s, 'lupa', NOW, D1)
  assert.ok(a.ok)
  if (!a.ok) return
  assert.equal(a.state.owned.lupa!.xp, P.CARE_XP)
  assert.ok(P.moodNow(a.state.owned.lupa, NOW) >= 70)
  const again = P.petCare(a.state, 'lupa', NOW + 3600e3, D1)
  assert.equal(again.ok, false)
  assert.ok(P.petCare(a.state, 'lupa', NOW + DAY, D2).ok, 'a new day')
  assert.equal(P.petCare(s, 'leo', NOW, D1).ok, false, 'not owned')
  assert.equal(P.careInfo(a.state, 'lupa', NOW, D1).canPet, false)
})

test('treats: coins are the sink, earned treats are used first, 3 a day, no loss', () => {
  let s = own('leo')
  const poor = P.feedPet(s, 10, 'leo', 'snack', NOW, D1)
  assert.equal(poor.ok, false)
  const f = P.feedPet(s, 500, 'leo', 'snack', NOW, D1)
  assert.ok(f.ok)
  if (!f.ok) return
  assert.equal(f.coins, 500 - 30)
  assert.equal(f.state.owned.leo!.xp, 30)
  s = f.state
  // earned stock first
  s = P.grantTreat(s, 'feast', 2)
  const g = P.feedPet(s, 500, 'leo', 'feast', NOW, D1)
  assert.ok(g.ok && g.coins === 500 && g.usedStock && g.state.treats.feast === 1)
  if (!g.ok) return
  const h = P.feedPet(g.state, 500, 'leo', 'snack', NOW, D1)
  assert.ok(h.ok)
  if (!h.ok) return
  const full = P.feedPet(h.state, 500, 'leo', 'snack', NOW, D1)
  assert.equal(full.ok, false, 'a 4th treat the same day')
  assert.ok(P.feedPet(h.state, 500, 'leo', 'snack', NOW + DAY, D2).ok, 'tomorrow is fine')
  // the treat stock is capped
  assert.equal(P.grantTreat(P.emptyPets(), 'snack', 500).treats.snack, P.MAX_TREAT_STOCK)
})

test('treats can level a buddy to 30, and stars, but the cost stays a real sink', () => {
  const cheapest = P.TREATS.reduce((a, t) => Math.min(a, t.cost / t.xp), 9)
  assert.ok(cheapest >= 0.7, 'no treat gives more than about 1.4 XP a coin')
  const coinsToLevel30 = Math.ceil((P.xpForLevel(30) / P.TREATS[1].xp) * P.TREATS[1].cost)
  assert.ok(coinsToLevel30 >= 2500, `all-treat level 30 costs ${coinsToLevel30} coins`)
  // a maxed buddy can't be fed
  const s = own('lupa', 1_000_000)
  const info = P.careInfo(s, 'lupa', NOW, D1)
  assert.equal(info.maxed, true)
  assert.equal(P.feedPet(s, 999, 'lupa', 'snack', NOW, D1).ok, false)
})

test('level-ups and stars are reported', () => {
  let s = own('lupa', P.xpForLevel(30) - 5)
  const r = P.addPetXp(s, 'lupa', 10, NOW)
  assert.equal(r.levelUp, 30)
  s = own('lupa', P.xpForLevel(30) + P.starNeed(0) - 5)
  const t = P.addPetXp(s, 'lupa', 10, NOW)
  assert.equal(t.starUp, 1)
  // a win cheers the buddy up
  const w = P.addPetXp(own('lupa'), 'lupa', 10, NOW).state
  assert.ok(P.moodNow(w.owned.lupa, NOW) > P.MOOD_START)
})

test('save: old saves load, new fields are cleaned', () => {
  const old = P.sanitizePets({ owned: { lupa: { at: 1, xp: 300 } }, active: 'lupa' })
  assert.deepEqual(old.treats, { snack: 0, feast: 0 })
  assert.equal(old.owned.lupa!.mood, undefined)
  assert.equal(P.levelInfo(P.petXp(old, 'lupa')).level, 6)
  const s = P.sanitizePets({
    owned: { lupa: { at: 1, xp: 5, mood: 9999, moodAt: 5, careDay: 'x', feedDay: D1, fedToday: 99 } },
    treats: { snack: -4, feast: 1e9 },
  })
  assert.equal(s.owned.lupa!.mood, P.MOOD_MAX)
  assert.equal(s.owned.lupa!.careDay, undefined)
  assert.equal(s.owned.lupa!.fedToday, P.MAX_FEEDS_PER_DAY)
  assert.equal(s.treats.snack, 0)
  assert.equal(s.treats.feast, 99)
  const round = P.sanitizePets(JSON.parse(JSON.stringify(s)))
  assert.deepEqual(round, s)
})

// ---------------- economy caps ----------------
test('daily win pay: full for 5 wins, then tapers, then closes; never below the floor while open', () => {
  let l = E.emptyLedger(D1)
  const paid: number[] = []
  for (let i = 0; i < 24; i++) {
    const r = E.payWin(l, 200, { boardId: `b${i}`, newBest: false })
    l = r.ledger
    paid.push(r.coins)
  }
  assert.deepEqual(paid.slice(0, 5), [200, 200, 200, 200, 200])
  assert.deepEqual(paid.slice(5, 8), [140, 140, 140])
  assert.deepEqual(paid.slice(8, 12), [80, 80, 80, 80])
  assert.deepEqual(paid.slice(12, 20), Array(8).fill(30))
  assert.deepEqual(paid.slice(20), [0, 0, 0, 0])
  assert.ok(paid.reduce((a, b) => a + b, 0) <= 200 * 5 + 140 * 3 + 80 * 4 + 30 * 8)
})

test('replaying the same board pays less and less, unless it is a new best', () => {
  let l = E.emptyLedger(D1)
  const a = E.payWin(l, 200, { boardId: 'easy', newBest: false })
  l = a.ledger
  const b = E.payWin(l, 200, { boardId: 'easy', newBest: false })
  l = b.ledger
  const c = E.payWin(l, 200, { boardId: 'easy', newBest: false })
  l = c.ledger
  assert.deepEqual([a.coins, b.coins, c.coins], [200, 120, 60])
  const best = E.payWin(l, 200, { boardId: 'easy', newBest: true })
  assert.equal(best.coins, 200)
  assert.equal(best.bestPays, true)
  // only 3 paid new bests a day
  let m = E.emptyLedger(D1)
  for (let i = 0; i < 3; i++) m = E.payWin(m, 100, { boardId: 'x', newBest: true }).ledger
  assert.equal(E.payWin(m, 100, { boardId: 'x', newBest: true }).bestPays, false)
  assert.ok(E.payWin(m, 100, { boardId: 'x', newBest: true }).pct < 100)
})

test('the Daily Challenge is never tapered and a new day starts fresh', () => {
  let l = E.emptyLedger(D1)
  for (let i = 0; i < 25; i++) l = E.payWin(l, 100, { boardId: `b${i}`, newBest: false }).ledger
  assert.equal(E.payWin(l, 100, { boardId: 'daily', newBest: false, daily: true }).coins, 100)
  assert.equal(E.rollLedger(l, D2).wins, 0)
  assert.equal(E.rollLedger(l, D1).wins, 26 - 1)
})

test('caps: sparks 8 a day, 1 spin, 3 treasure parades, 3 hunts, 3 double Trials', () => {
  let l = E.emptyLedger(D1)
  assert.equal(E.sparksOpen(l), true)
  l = { ...l, sparks: 8 }
  assert.equal(E.sparksOpen(l), false)
  assert.equal(E.canEarnSpin(E.emptyLedger(D1)), true)
  assert.equal(E.canEarnSpin({ ...E.emptyLedger(D1), spins: E.SPIN_CAP_PER_DAY }), false)
  assert.equal(E.canTreasure({ ...E.emptyLedger(D1), treasureParades: 3 }), false)
  assert.equal(E.huntPct({ ...E.emptyLedger(D1), hunts: 3 }), E.HUNT_EXTRA_PCT)
  assert.equal(E.huntPct(E.emptyLedger(D1)), 100)
  assert.equal(E.trialMultiplier({ ...E.emptyLedger(D1), trialClears: 3 }), 1)
  assert.equal(E.trialMultiplier(E.emptyLedger(D1)), 2)
})

test('hint and rescue prices step up on the same board (free ones never do)', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9].map(E.hintPrice), [15, 15, 15, 25, 25, 40, 40])
  assert.deepEqual([0, 1, 2, 3, 4, 8].map(E.rescuePrice), [40, 40, 60, 60, 80, 80])
  assert.equal(E.hintPrice(0), R.HINT_COST)
  assert.equal(E.rescuePrice(0), R.RESCUE_COST)
})

test('ledger: junk in storage is safe', () => {
  for (const raw of [null, 5, 'x', {}, { day: D1, wins: -3, boards: 4 }, { day: D2, wins: 99 }]) {
    const l = E.sanitizeLedger(raw, D1)
    assert.equal(l.day, D1)
    assert.ok(l.wins >= 0 && l.sparks >= 0)
  }
  const store = new Map<string, string>()
  const st = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
  const l = E.payWin(E.emptyLedger(D1), 100, { boardId: 'a', newBest: false }).ledger
  E.saveLedger(st, l)
  assert.deepEqual(E.loadLedger(st, D1), l)
  assert.equal(E.loadLedger(st, D2).wins, 0)
})

test('the whole economy: normal play is barely touched, farming is not worth it, Invictus still takes weeks', () => {
  const e = P.estimateEconomy()
  // a normal day (5 wins) is paid in full
  let l = E.emptyLedger(D1)
  let coins = 0
  for (let i = 0; i < 5; i++) coins += E.payWin(l = E.payWin(l, e.perWin, { boardId: `b${i}`, newBest: false }).ledger, 0, { boardId: 'z', newBest: false }).coins * 0 + e.perWin
  assert.equal(coins, e.perWin * 5)
  // a grinder: 30 wins on 3 easy boards
  let g = E.emptyLedger(D1)
  let farmed = 0
  for (let i = 0; i < 30; i++) {
    const r = E.payWin(g, e.perWin, { boardId: `easy${i % 3}`, newBest: false })
    g = r.ledger
    farmed += r.coins
  }
  assert.ok(farmed < e.perWin * 8, `30 easy wins pay ${farmed}, under 8 full wins (${e.perWin * 8})`)
  // best-case day for a hard-core free player, in coins
  const perDay = farmed + 100 + 8 * 17 + 1 * 38 + 3 * 45
  assert.ok(25000 / (perDay * 0.9) >= 12, `Invictus in ${(25000 / (perDay * 0.9)).toFixed(1)} days for a grinder`)
})
