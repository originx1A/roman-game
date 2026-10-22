import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const V = await import('../src/game/voiceVisual.ts')
const L = await import('../src/game/voiceLines.ts')

const silent = ['request', 'queued', 'error', 'timeout', 'stale', 'blocked'] as const

test('the Unseen is never visible without playing audio', () => {
  for (const event of silent) {
    assert.equal(V.unseenFrame('off', event), 'off', event)
  }
  assert.equal(V.unseenFrame('off', 'playing', V.VISUAL_START_LIMIT_MS + 1), 'off', 'late start stays hidden')
  assert.equal(V.VISUAL_START_LIMIT_MS, 1500)
})

test('every Unseen audio play shows him for the whole line', () => {
  for (const elapsed of [0, 40, 400, 1499, 1500]) {
    assert.equal(V.unseenFrame('off', 'playing', elapsed), 'on', `playing at ${elapsed}ms`)
  }
  let frame: 'off' | 'on' = 'off'
  frame = V.unseenFrame(frame, 'request')
  frame = V.unseenFrame(frame, 'queued')
  assert.equal(frame, 'off')
  frame = V.unseenFrame(frame, 'playing', 120)
  assert.equal(frame, 'on')
  // Nothing else happened: he is still up while the line plays.
  assert.equal(frame, 'on')
  frame = V.unseenFrame(frame, 'ended')
  assert.equal(frame, 'off')
  for (const clip of ['old_aside_clock', 'old_wrong_nope', 'tip_trial_old_life', 'tip_undo_old_rent']) {
    assert.equal(L.roleForClip(clip), 'oldtimer', clip)
    assert.equal(V.unseenFrame('off', 'playing', 10) === 'on' && L.roleForClip(clip) === 'oldtimer', true, clip)
  }
  assert.notEqual(L.roleForClip('nudge'), 'oldtimer')
  assert.equal(L.roleForClip('nudge') === 'oldtimer' && V.unseenFrame('off', 'playing', 10) === 'on', false)
})

test('playing event shows him; a missed start, an error, or a late playing event does not', async () => {
  const pending: { id: number; fn: () => void }[] = []
  let n = 0
  const schedule = (fn: () => void) => {
    n += 1
    pending.push({ id: n, fn })
    return n
  }
  const clear = (id: number) => {
    const i = pending.findIndex((p) => p.id === id)
    if (i >= 0) pending.splice(i, 1)
  }
  let clock = 5_000
  const arm = () => {
    clock = 5_000
    const el = new EventTarget()
    let shown = 0
    let aborted = 0
    const watch = V.bindVisualToPlaying(el, {
      now: () => clock,
      schedule: (fn) => schedule(fn),
      clear,
      onShow: () => {
        shown += 1
      },
      onAbort: () => {
        aborted += 1
      },
    })
    return { el, watch, shown: () => shown, aborted: () => aborted }
  }

  const started = arm()
  clock = 5_080
  started.el.dispatchEvent(new Event('playing'))
  assert.equal(await started.watch.done, 'started')
  assert.equal(started.shown(), 1)
  assert.equal(started.aborted(), 0)
  started.el.dispatchEvent(new Event('playing'))
  assert.equal(started.shown(), 1, 'a second playing event does not stack a second appearance')

  const late = arm()
  clock = 5_000 + V.VISUAL_START_LIMIT_MS + 40
  late.el.dispatchEvent(new Event('playing'))
  assert.equal(await late.watch.done, 'aborted')
  assert.equal(late.shown(), 0)
  assert.equal(late.aborted(), 1)

  const timed = arm()
  assert.equal(timed.shown(), 0, 'arming the watch is not an appearance')
  pending.splice(0).forEach((p) => p.fn())
  assert.equal(await timed.watch.done, 'aborted')
  assert.equal(timed.shown(), 0)
  assert.equal(timed.aborted(), 1)
  timed.el.dispatchEvent(new Event('playing'))
  assert.equal(timed.shown(), 0, 'playing after the deadline still shows nothing')

  const blocked = arm()
  blocked.el.dispatchEvent(new Event('error'))
  assert.equal(await blocked.watch.done, 'aborted')
  assert.equal(blocked.shown(), 0)
  assert.equal(blocked.aborted(), 1)
})
