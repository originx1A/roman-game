import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorGap, regionColorMap, THEMES, TILE_SHAPES, type ThemeId } from '../src/game/themes.ts'

test('every theme palette stays clearly distinct, including deutan/protan views', () => {
  for (const [id, t] of Object.entries(THEMES)) {
    assert.equal(t.hues.length, 8, id)
    let min = Infinity
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) {
        const a = { hue: t.hues[i], sat: t.sats[i], lit: t.lits[i] }
        const b = { hue: t.hues[j], sat: t.sats[j], lit: t.lits[j] }
        min = Math.min(min, colorGap(a, b))
      }
    assert.ok(min >= 18, `${id} min gap ${min.toFixed(1)}`)
  }
})

test('each color gets its own shape mark on a full 8x8 board', () => {
  const regions = Array.from({ length: 64 }, (_, i) => Math.floor(i / 8))
  for (const id of Object.keys(THEMES) as ThemeId[]) {
    const map = regionColorMap(id, regions, 8)
    const shapes = new Set([...map.values()].map((c) => c.shape))
    const colors = new Set([...map.values()].map((c) => `${c.hue}/${c.sat}/${c.lit}`))
    assert.equal(shapes.size, 8, id)
    assert.equal(colors.size, 8, id)
    for (const c of map.values()) assert.ok(TILE_SHAPES.includes(c.shape))
  }
})
