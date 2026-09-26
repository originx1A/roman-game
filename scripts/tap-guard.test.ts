import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CLICK_AFTER_TOUCH_MS, createTapGuard } from '../src/game/tapGuard.ts'

function clock() {
  let t = 1000
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

test('one tap acts once even when pointerup, touchend and click all arrive', () => {
  const c = clock()
  const g = createTapGuard(c.now)
  let acts = 0
  g.down() // pointerdown
  g.down() // touchstart
  if (g.release()) acts++ // pointerup
  if (g.release()) acts++ // touchend
  c.advance(30)
  if (g.click()) acts++ // synthetic click
  assert.equal(acts, 1)
})

test('two quick taps are two undos', () => {
  const c = clock()
  const g = createTapGuard(c.now)
  let acts = 0
  g.down()
  if (g.release()) acts++
  c.advance(90)
  g.down()
  if (g.release()) acts++
  assert.equal(acts, 2)
})

test('mouse and keyboard clicks act normally', () => {
  const c = clock()
  const g = createTapGuard(c.now)
  assert.equal(g.click(), true)
  c.advance(50)
  assert.equal(g.click(), true)
})

test('a click with no touch release we saw still acts', () => {
  const c = clock()
  const g = createTapGuard(c.now)
  g.down()
  g.cancel() // slid off, or the system cancelled
  assert.equal(g.release(), false)
  assert.equal(g.click(), true)
})

test('a release without a press does nothing', () => {
  const g = createTapGuard(clock().now)
  assert.equal(g.release(), false)
})

test('a click long after a tap acts again', () => {
  const c = clock()
  const g = createTapGuard(c.now)
  g.down()
  g.release()
  c.advance(CLICK_AFTER_TOUCH_MS + 1)
  assert.equal(g.click(), true)
})
