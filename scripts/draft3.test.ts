import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const c = await import('../src/game/comments.ts')
const { VOICE_LINES, roleForClip } = await import('../src/game/voiceLines.ts')

// 9.30-o: the 147 approved draft-3 lines, each in the pool of its own moment
const DRAFT = readFileSync(new URL('./draft3-ids.txt', import.meta.url), 'utf8').trim().split('\n').map((l) => l.split('\t'))
const manifest = JSON.parse(readFileSync(new URL('./voice-manifest.json', import.meta.url), 'utf8'))

test('all 147 approved lines are recorded, in the manifest, and in their own pool', () => {
  assert.equal(DRAFT.length, 147)
  for (const [pool, id] of DRAFT) {
    assert.ok(id in VOICE_LINES, `${id} in the catalog`)
    assert.ok(existsSync(new URL(`../public/voices/${id}.mp3`, import.meta.url)), `${id} mp3`)
    assert.ok((c.VOICE_POOLS[pool] as readonly string[]).includes(id), `${id} in ${pool}`)
    const m = manifest[id]
    const role = roleForClip(id)
    if (role === 'roman') assert.deepEqual([m.voice, m.rate, m.pitch], ['en-US-BrianNeural', '-8%', '-6Hz'], id)
    else if (role === 'oldtimer') assert.deepEqual([m.voice, m.rate, m.pitch, m.post], ['en-AU-WilliamMultilingualNeural', '-20%', '-16Hz', 'rasp-v1'], id)
    else assert.deepEqual([m.voice, m.rate, m.pitch], ['en-US-JennyNeural', '+10%', '+6Hz'], id)
  }
})

test('every new line is reachable and the heard total counts them', () => {
  const reach = new Set(c.reachableClips())
  for (const [, id] of DRAFT) assert.ok(reach.has(id), `${id} reachable`)
  assert.equal(reach.size, 529)
})
