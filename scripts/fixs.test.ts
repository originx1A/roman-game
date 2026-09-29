import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const ov = readFileSync(new URL('../src/components/ParadeOverlay.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('9.30-s: a capped parade still gives every buddy a small coin drop', async () => {
  const { makeCappedTreasure, CAPPED_TAP_COINS, TREASURE_DROPS } = await import('../src/game/paradeTreasure.ts')
  const t = makeCappedTreasure(6)
  assert.equal(t.length, TREASURE_DROPS)
  for (const d of t) assert.deepEqual(d, { kind: 'coins', amount: CAPPED_TAP_COINS })
  assert.ok(CAPPED_TAP_COINS >= 1)
  assert.equal(makeCappedTreasure(3).length, 3)
})

test('9.30-s: capped parade is used in App, does not use up another treasure parade, and is announced before the march', () => {
  assert.match(app, /makeCappedTreasure\(buddies\.length\)/)
  assert.match(app, /paradeCountedRef\.current = !treasureOk/)
  assert.match(ov, /Big treasure is used up for today/)
})

test('9.30-s: every buddy is tappable (no buddy without a drop) and the card never says "nothing this time"', () => {
  assert.match(ov, /treasureIn\[i\] \?\? \{ kind: 'coins'/)
  assert.doesNotMatch(ov, /nothing this time/)
  assert.doesNotMatch(ov, /Treasure rides in the first 3/)
})
