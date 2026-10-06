import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const L = await import('../src/game/lineBag.ts')

let seed = 99
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x80000000)

test('9.30-f: a skipped / stale line does not count; every line is heard once before any repeats', () => {
  const store = L.memoryBagStore()
  const set = L.createBagSet({ store, rng, commitOnPlay: true })
  const items = Array.from({ length: 12 }, (_, i) => `l${i}`)
  const next = set.bag('cat', items)
  const heard: string[] = []
  for (let k = 0; k < 300; k++) {
    const pick = next()
    if (rng() < 0.45) continue // channel busy / went stale: never heard
    set.markPlayed(pick)
    heard.push(pick)
  }
  for (let c = 0; c + items.length <= heard.length; c += items.length) {
    assert.equal(new Set(heard.slice(c, c + items.length)).size, items.length, `pass ${c / items.length} heard every line once`)
  }
  for (let k = 1; k < heard.length; k++) assert.notEqual(heard[k], heard[k - 1], 'never the same line twice in a row (also across refills)')
})

test('9.30-f: rotation survives a reload (saved in the store) and a skipped pick is offered again', () => {
  const store = L.memoryBagStore()
  const a = L.createBagSet({ store, rng, commitOnPlay: true })
  const items = ['a', 'b', 'c', 'd', 'e']
  const n1 = a.bag('x', items)
  const heard = [n1(), n1()].slice(0, 1)
  a.markPlayed(heard[0])
  const skipped = n1()
  assert.equal(n1(), skipped, 'unheard line stays next')
  const b = L.createBagSet({ store, rng, commitOnPlay: true }) // reload
  const n2 = b.bag('x', items)
  assert.equal(n2(), skipped, 'still next after a reload')
  for (let k = 0; k < 4; k++) { const p = n2(); b.markPlayed(p); heard.push(p) }
  assert.deepEqual([...heard].sort(), [...items].sort(), 'one full pass across the reload')
})

test('9.30-f: an alt from the same pool that played instead counts for that pool', () => {
  const set = L.createBagSet({ store: L.memoryBagStore(), rng, commitOnPlay: true })
  const next = set.bag('p', ['a', 'b', 'c'])
  const offered = next()
  const alt = ['a', 'b', 'c'].find((x) => x !== offered)!
  set.markPlayed(alt)
  const rest = [next()]
  set.markPlayed(rest[0])
  rest.push(next())
  set.markPlayed(rest[1])
  assert.deepEqual([alt, ...rest].sort(), ['a', 'b', 'c'])
})

test('9.30-f: game voices: bags only move on when a line is heard (banterFor + noteVoicePlayed)', async () => {
  ;(globalThis as { window?: unknown }).window ??= { setTimeout: () => 0, clearTimeout: () => {} }
  const C = await import('../src/game/comments.ts')
  const heard: string[] = []
  for (let k = 0; k < 200; k++) {
    const b = C.banterFor('place-bad')
    if (!b.clip) continue
    if (k % 3 === 1) continue // skipped
    C.noteVoicePlayed(b.clip)
    C.noteVoiceHeard(b.clip) // 9.30-k: the heard count only moves when the clip finished
    heard.push(b.clip)
  }
  const roman = heard.filter((x) => (C.ROMAN_WRONG_CLIPS as readonly string[]).includes(x))
  const n = C.ROMAN_WRONG_CLIPS.length
  for (let c = 0; c + n <= roman.length; c += n) assert.equal(new Set(roman.slice(c, c + n)).size, n)
})
