import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LONG_PRESS_MS, TAP_SLOP_PX, hasLeftTap, swipeModeFor, swipeTarget } from '../src/game/gesture.ts'

const start = { x: 100, y: 100, index: 7 }

test('a finger wobbling inside the tapped cell is still a tap', () => {
  assert.equal(hasLeftTap(start, 101, 102, 7), false)
  assert.equal(hasLeftTap(start, 125, 90, 7), false)
})

test('reaching another cell makes it a swipe', () => {
  assert.equal(hasLeftTap(start, 103, 100, 8), true)
})

test('over a gap between cells, only a real drift counts as a swipe', () => {
  assert.equal(hasLeftTap(start, 102, 101, null), false)
  assert.equal(hasLeftTap(start, 100 + TAP_SLOP_PX + 1, 100, null), true)
})

test('a touch that started on a gap becomes a swipe when it reaches a cell', () => {
  assert.equal(hasLeftTap({ x: 0, y: 0, index: null }, 1, 1, 3), true)
})

test('long-press to clear waits about half a second', () => {
  assert.ok(LONG_PRESS_MS >= 400 && LONG_PRESS_MS <= 500)
})

test('a drag from an X erases, from an empty cell or a buddy it paints', () => {
  assert.equal(swipeModeFor('mark'), 'erase')
  assert.equal(swipeModeFor('empty'), 'paint')
  assert.equal(swipeModeFor('stone'), 'paint')
  assert.equal(swipeModeFor(undefined), 'paint')
})

test('paint turns empty cells into X and leaves X and buddies alone', () => {
  assert.equal(swipeTarget('paint', 'empty'), 'mark')
  assert.equal(swipeTarget('paint', 'mark'), null)
  assert.equal(swipeTarget('paint', 'stone'), null)
})

test('erase clears X only; buddies and empty cells are never touched', () => {
  assert.equal(swipeTarget('erase', 'mark'), 'empty')
  assert.equal(swipeTarget('erase', 'empty'), null)
  assert.equal(swipeTarget('erase', 'stone'), null)
})
