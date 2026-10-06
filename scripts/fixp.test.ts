import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const E = await import('../src/game/dailyEconomy.ts')
const P = await import('../src/game/parade.ts')
const T = await import('../src/game/paradeTreasure.ts')

test('9.30-p: the march is slow (12-16 s) so a phone tap can land', () => {
  assert.equal(P.PARADE_MIN_MS, 12000)
  assert.equal(P.PARADE_MAX_MS, 16000)
})

test('9.30-p: a parade only uses one of the 3 daily treasure parades when something is caught, and the ledger lists it', () => {
  let l = E.emptyLedger('2026-09-29')
  assert.equal(E.paradeRewardsLine(l).parades, 0)
  l = E.noteParadeGain(l, { coins: 12 }, true)
  l = E.noteParadeGain(l, { coins: 8, hints: 1 }, false)
  assert.equal(l.treasureParades, 1, 'two catches in one parade = one parade')
  const s = E.paradeRewardsLine(l)
  assert.deepEqual([s.coins, s.hints, s.spins, s.parades, s.max], [20, 1, 0, 1, 3])
  assert.match(s.text, /\+20 coins/)
  assert.match(s.text, /1 free hint/)
  // survives save/load and rolls over at midnight
  const mem = new Map<string, string>()
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  E.saveLedger(st, l)
  assert.equal(E.loadLedger(st, '2026-09-29').paradeCoins, 20)
  assert.equal(E.loadLedger(st, '2026-09-30').paradeCoins, 0)
  // an old save with no parade fields loads as zero
  mem.set(E.ECON_KEY, JSON.stringify({ day: '2026-09-29', wins: 2, treasureParades: 1 }))
  assert.equal(E.loadLedger(st, '2026-09-29').paradeCoins, 0)
  assert.equal(E.paradeRewardsLine(E.emptyLedger('x')).text.startsWith('nothing yet'), true)
})

test('9.30-p: every marcher carries a drop (even with no buddies owned: 3 silhouettes), never zero coins', () => {
  for (let i = 0; i < 200; i++) {
    const t = T.makeTreasure(3)
    assert.equal(t.length, 3)
    assert.ok(t.every((x) => x.kind !== 'coins' || x.amount > 0))
  }
})

test('9.30-p: source checks: wallet delta on the summary, tap-the-buddy, fly-to-wallet, prompt text, Rewards line', () => {
  const ov = readFileSync(new URL('../src/components/ParadeOverlay.tsx', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(ov, /Tap the buddies to grab treasure!/)
  assert.match(ov, /data-testid="parade-wallet"/)
  assert.match(ov, /data-testid="parade-fly"/)
  assert.match(ov, /data-testid="parade-buddy-body"/)
  assert.match(app, /data-testid="parade-rewards-today"/)
  assert.match(app, /Parade rewards today/)
})
