import assert from 'node:assert/strict'
import { createVoiceGate, VOICE_GATES } from '../src/game/voiceGate.ts'

// ungated moments always pass
{
  const g = createVoiceGate(VOICE_GATES, () => 0.99)
  assert.equal(g.allow('win', 0), true)
  assert.equal(g.allow('win', 1), true)
}
// gap: a second wrong-move line inside 20s is held back, after it passes
{
  const g = createVoiceGate(VOICE_GATES, () => 0)
  assert.equal(g.allow('place-bad', 0), true)
  assert.equal(g.allow('place-bad', 19999), false)
  assert.equal(g.allow('place-bad', 20000), true)
}
// chance: a roll above the chance stays quiet and does not start the gap
{
  let r = 0.9
  const g = createVoiceGate(VOICE_GATES, () => r)
  assert.equal(g.allow('place-bad', 0), false)
  r = 0.1
  assert.equal(g.allow('place-bad', 10), true)
}
// moments have their own clocks
{
  const g = createVoiceGate(VOICE_GATES, () => 0)
  assert.equal(g.allow('idle', 0), true)
  assert.equal(g.allow('hint', 1), true)
  assert.equal(g.allow('idle', 44999), false)
}
// unheard lines loosen the gate: shorter gap, higher chance; all heard = the plain rule
{
  const g = createVoiceGate(VOICE_GATES, () => 0.85)
  assert.equal(g.allow('place-bad', 0, 0), false) // 0.85 >= 0.5 chance
  assert.equal(g.allow('place-bad', 0, 1), true) // every line unheard: chance 0.9
  assert.equal(g.allow('place-bad', 7999, 1), false) // gap is 40% of 20 s
  assert.equal(g.allow('place-bad', 8000, 1), true)
  const h = createVoiceGate(VOICE_GATES, () => 0)
  assert.equal(h.allow('place-bad', 0, 0), true)
  assert.equal(h.allow('place-bad', 19999, 0), false) // all heard: the full 20 s
  assert.equal(h.allow('place-bad', 20000, 0), true)
}
console.log('voice-gate ok')
