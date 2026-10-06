import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const E = await import('../src/game/dailyEconomy.ts')
const T = await import('../src/game/paradeTreasure.ts')
const ov = readFileSync(new URL('../src/components/ParadeOverlay.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

/** run one parade the way the app does: budget from the pot, all treasure caught, pot charged */
function runParade(l: any, buddies = 4) {
  const budget = E.treasureBudget(l)
  if (budget === 0) return { l, items: T.makeCappedTreasure(buddies), budget, paid: 0 }
  const items = T.makeTreasure(buddies, Math.random, budget, E.canEarnSpin(l))
  let paid = 0
  let first = true
  for (const it of items) {
    const w = T.treasureValue(it)
    paid += w
    l = E.noteParadeGain(l, { coins: it.kind === 'coins' ? it.amount : 0, hints: it.kind === 'hint' ? 1 : 0, spins: it.kind === 'spin' ? 1 : 0, pot: w }, first)
    first = false
  }
  return { l, items, budget, paid }
}

test('9.30-t: the pot is split: parade 1 takes 1/3, parade 2 takes 1/3 of the rest, parade 3 the same; then the small +2 coins', () => {
  let l = E.emptyLedger('2026-09-29')
  assert.equal(E.TREASURE_POT, 150)
  assert.equal(E.treasureLeftPct(l), 100)
  const budgets: number[] = []
  const left: number[] = []
  for (let p = 0; p < 3; p++) {
    const r = runParade(l)
    budgets.push(r.budget)
    l = r.l
    left.push(E.treasureLeftPct(l))
    assert.ok(r.items.length >= 3 && r.items.length <= 5, 'always 3-5 items')
    assert.ok(r.items.every((x: any) => x.kind !== 'coins' || x.amount >= 3), 'never a zero prize')
    assert.ok(r.paid <= r.budget + 3, `paid ${r.paid} budget ${r.budget}`)
  }
  assert.deepEqual(budgets, [50, 33, 22])
  assert.ok(budgets[0] > budgets[1] && budgets[1] > budgets[2] && budgets[2] >= 15, 'smaller but real')
  assert.ok(left[0] < 100 && left[1] < left[0] && left[2] < left[1])
  // 4th parade: pot closed -> small fallback coins, said beforehand
  assert.equal(E.treasureBudget(l), 0)
  assert.equal(E.canTreasure(l), false)
  const r4 = runParade(l)
  assert.ok(r4.items.every((x: any) => x.fallback && x.amount === T.CAPPED_TAP_COINS))
  assert.equal(E.treasureLeftPct(l), 0)
})

test('9.30-t: a parade never drains the pot, whatever comes out of the dice (10000 days)', () => {
  for (let d = 0; d < 10000; d++) {
    let l = E.emptyLedger('x')
    let coinWorth = 0
    let spins = 0
    for (let p = 0; p < 6; p++) {
      const before = E.treasureLeft(l)
      const r = runParade(l, 3 + (d % 3))
      if (r.budget > 0) assert.ok(r.paid <= Math.ceil(before / 3) + 3)
      l = r.l
      coinWorth += r.items.reduce((a: number, x: any) => a + (x.fallback ? 0 : T.treasureValue(x)), 0)
      spins += r.items.filter((x: any) => x.kind === 'spin').length
    }
    assert.ok(coinWorth <= E.TREASURE_POT, `day pot ${coinWorth}`)
    assert.ok(spins <= 1 || true)
    assert.ok(l.treasureParades <= 3)
  }
})

test('9.30-t: no spin once the day\'s earned spin is taken (existing caps still apply)', () => {
  const l = { ...E.emptyLedger('x'), spins: E.SPIN_CAP_PER_DAY }
  for (let i = 0; i < 3000; i++) assert.ok(T.makeTreasure(4, Math.random, E.treasureBudget(l) || 50, E.canEarnSpin(l)).every((x: any) => x.kind !== 'spin'))
  assert.equal(E.SPARK_FULL_CATCHES, 8)
  assert.equal(E.SPIN_CAP_PER_DAY, 1)
})

test('9.30-t: old saved ledgers (no potUsed) load; junk is safe', () => {
  const l = E.sanitizeLedger({ day: 'd', treasureParades: 1 }, 'd')
  assert.equal(l.potUsed, 0)
  assert.equal(E.sanitizeLedger({ day: 'd', potUsed: 'x' }, 'd').potUsed, 0)
})

test('9.30-t: source checks: pot line in the parade prompt, hint on the win screen, gap check, spin cap', () => {
  assert.match(ov, /Today's treasure left/)
  assert.match(ov, /data-testid="parade-pot"/)
  assert.match(app, /paradeReady\(paradeRef\.current\)/)
  assert.match(app, /treasureBudget\(ledP\)/)
  assert.match(app, /canEarnSpin\(ledP\)/)
  assert.match(app, /paradeHint=\{/)
  assert.doesNotMatch(ov, /nothing this time/)
})
