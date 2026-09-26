import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHistory, pushMove, redoMove, undoMove } from '../src/game/history.ts'
import type { CellState } from '../src/game/types.ts'

function board(...cells: CellState[]): CellState[] {
  return cells
}

test('undo removes a single X placement', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty'])
  assert.equal(history.past.length, 0)
  assert.equal(history.future.length, 1)
})

test('undo reverses each X in a swipe, latest first', () => {
  let history = createHistory(board('empty', 'empty', 'empty'))
  history = pushMove(history, board('mark', 'empty', 'empty'))
  history = pushMove(history, board('mark', 'mark', 'empty'))
  history = pushMove(history, board('mark', 'mark', 'mark'))

  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'mark', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
})

test('undo restores a cleared X, then earlier buddy and X moves', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = pushMove(history, board('mark', 'stone'))
  history = pushMove(history, board('empty', 'stone'))

  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'stone'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty'])
})

test('X marks and buddy placements share one history, in order', () => {
  let history = createHistory(board('empty', 'empty', 'empty'))
  history = pushMove(history, board('stone', 'empty', 'empty'))
  history = pushMove(history, board('stone', 'mark', 'empty'))
  history = pushMove(history, board('stone', 'mark', 'mark'))
  history = pushMove(history, board('stone', 'stone', 'mark'))

  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'mark', 'mark'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'mark', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
})

test('redo puts an undone X back', () => {
  let history = createHistory(board('empty'))
  history = pushMove(history, board('mark'))
  history = undoMove(history)
  history = redoMove(history)
  assert.deepEqual(history.present, ['mark'])
  assert.equal(history.past.length, 1)
  assert.equal(history.future.length, 0)
})

test('a new move after undo drops the redo of that X', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = undoMove(history)
  history = pushMove(history, board('empty', 'mark'))
  assert.equal(history.future.length, 0)
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty'])
})

test('repeating the same board does not add an undo step', () => {
  let history = createHistory(board('empty'))
  const marked = board('mark')
  history = pushMove(history, marked)
  marked[0] = 'stone'
  history = pushMove(history, history.present)
  assert.equal(history.past.length, 1)
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty'])
})
