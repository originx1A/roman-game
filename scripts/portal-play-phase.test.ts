import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextPlayPhase } from '../src/portal/playPhase.ts'

test('gameplay starts on the first input and ignores a second start', () => {
  const started = nextPlayPhase('idle', 'input')
  assert.deepEqual(started, { phase: 'playing', call: 'gameplayStart' })
  assert.deepEqual(nextPlayPhase(started.phase, 'input'), { phase: 'playing', call: null })
})

test('gameplay stops on an interruption and ignores a second stop', () => {
  const stopped = nextPlayPhase('playing', 'interrupt')
  assert.deepEqual(stopped, { phase: 'idle', call: 'gameplayStop' })
  assert.deepEqual(nextPlayPhase(stopped.phase, 'interrupt'), { phase: 'idle', call: null })
})

test('a later input can start gameplay again after a stop', () => {
  const stopped = nextPlayPhase('playing', 'interrupt')
  assert.deepEqual(nextPlayPhase(stopped.phase, 'input'), { phase: 'playing', call: 'gameplayStart' })
})
