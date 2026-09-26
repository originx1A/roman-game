import type { CellState } from './types'

/** One board and the moves that can still be undone or redone. */
export interface MoveHistory {
  past: CellState[][]
  present: CellState[]
  future: CellState[][]
}

function copyBoard(board: CellState[]): CellState[] {
  return board.slice()
}

function sameBoard(a: CellState[], b: CellState[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function createHistory(present: CellState[]): MoveHistory {
  return { past: [], present: copyBoard(present), future: [] }
}

/**
 * Record a new board. `present` is the board before this change, so several
 * updates in one turn (a swipe of X marks) each keep their own step.
 * An unchanged board is ignored so undo is not a no-op.
 */
export function pushMove(history: MoveHistory, next: CellState[]): MoveHistory {
  if (sameBoard(history.present, next)) return history
  return {
    past: [...history.past, history.present],
    present: copyBoard(next),
    future: [],
  }
}

export function undoMove(history: MoveHistory): MoveHistory {
  if (history.past.length === 0) return history
  const present = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future],
  }
}

export function redoMove(history: MoveHistory): MoveHistory {
  if (history.future.length === 0) return history
  const present = history.future[0]
  return {
    past: [...history.past, history.present],
    present,
    future: history.future.slice(1),
  }
}
