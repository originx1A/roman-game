import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

register('./ts-resolve.mjs', import.meta.url)
const V = await import('../src/game/voiceChannel.ts')

// priorities as in comments.ts VOICE_PRIORITY
const P = { idle: 1, chatter: 2, wrong: 3, hint: 4, prize: 4, win: 5, lose: 5 }
const now = 100_000
const oldTimerPlaying = (priority: number, leftMs = 3000) => ({ priority, audible: true, endsAt: now + leftMs })

test('9.30-e: a line that has started is never cut; higher lines wait for it', () => {
  // old-timer grumble (wrong, 3) is talking; the coach hint (4) and Roman's win line (5) wait
  for (const pr of [P.hint, P.prize, P.win, P.lose]) {
    const d = V.decideVoice(oldTimerPlaying(P.wrong), { priority: pr }, now)
    assert.equal(d.kind, 'wait', `priority ${pr}`)
  }
  // the win line waits long enough to play right after him; a hint goes stale sooner
  const win = V.decideVoice(oldTimerPlaying(P.wrong, 3000), { priority: P.win }, now)
  const hint = V.decideVoice(oldTimerPlaying(P.wrong, 3000), { priority: P.hint }, now)
  assert.ok(win.kind === 'wait' && win.until === now + 3000 + V.STALE_AFTER_MS.high)
  assert.ok(hint.kind === 'wait' && hint.until === now + 3000 + V.STALE_AFTER_MS.normal)
  // end not known yet (metadata pending): assume a typical line
  const unk = V.decideVoice({ priority: 2, audible: true, endsAt: 0 }, { priority: P.win }, now)
  assert.ok(unk.kind === 'wait' && unk.until >= now + V.UNKNOWN_REMAINING_MS)
})

test('9.30-e: no overlap and no stacking stay as before', () => {
  assert.deepEqual(V.decideVoice(null, { priority: 1 }, now), { kind: 'play' })
  assert.deepEqual(V.decideVoice(oldTimerPlaying(P.wrong), { priority: P.idle }, now), { kind: 'skip' })
  assert.deepEqual(V.decideVoice(oldTimerPlaying(P.wrong), { priority: P.wrong }, now), { kind: 'skip' })
  assert.deepEqual(V.decideVoice(oldTimerPlaying(P.win), { priority: P.chatter, waitMs: 7000 }, now), { kind: 'wait', until: now + 7000 })
  // still loading (nothing heard): a higher line may replace it
  assert.deepEqual(V.decideVoice({ priority: P.wrong, audible: false, endsAt: 0 }, { priority: P.win }, now), { kind: 'preempt' })
  // one waiting slot: same-or-higher replaces
  assert.equal(V.replacesWaiting(null, 1), true)
  assert.equal(V.replacesWaiting(5, 4), false)
  assert.equal(V.replacesWaiting(4, 5), true)
})

test('9.30-e: board end drops only QUEUED lines; the playing old-timer line finishes', () => {
  assert.deepEqual(V.boardEndCancel(oldTimerPlaying(P.wrong), P.idle, P.win), { dropWaiting: true, stopCurrent: false })
  assert.deepEqual(V.boardEndCancel({ priority: P.wrong, audible: false, endsAt: 0 }, null, P.win), { dropWaiting: false, stopCurrent: true })
  assert.deepEqual(V.boardEndCancel(oldTimerPlaying(P.win), P.win, P.win), { dropWaiting: false, stopCurrent: false })
})

test('9.30-e: queue timing uses the faster old-timer rate', () => {
  assert.equal(V.clipEndsAt(0, 6.4, 1.28), 5000)
  assert.equal(V.clipEndsAt(0, 6.4, 1.28, 3.2), 2500)
  assert.equal(V.clipEndsAt(0, NaN, 1.28), 0)
  const sound = readFileSync(new URL('../src/game/sound.ts', import.meta.url), 'utf8')
  // cancelVoiceBelow no longer stops a playing line directly
  const cancel = sound.slice(sound.indexOf('export function cancelVoiceBelow'), sound.indexOf('export function setMuted'))
  assert.match(cancel, /boardEndCancel/)
  assert.match(sound, /decideVoice\(currentLine/)
})

test("9.30-h: Roman is ~10% quicker than 9.30-g, and the channel timing follows his real rate", async () => {
  const { romanPlaybackRate, moodPlayback } = await import('../src/game/voiceLines.ts')
  const old = (r: number) => Math.min(0.94, Math.max(0.82, r * 0.88))
  for (const mood of ['excited', 'happy', 'soft', 'disappointed', 'neutral'] as const) {
    const r = moodPlayback(mood).rate
    const ratio = romanPlaybackRate(r) / old(r)
    assert.ok(ratio > 1.09 && ratio < 1.11, `${mood}: ${old(r)} -> ${romanPlaybackRate(r)}`)
  }
  assert.equal(romanPlaybackRate(moodPlayback('excited').rate), 1.034)
  // a 4.8 s Roman take at 1.034 holds the channel ~4.64 s (was ~5.11 s at 0.94)
  assert.equal(Math.round(V.clipEndsAt(0, 4.8, 1.034)), 4642)
  assert.equal(Math.round(V.clipEndsAt(0, 4.8, 0.94)), 5106)
})
