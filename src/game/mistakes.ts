import type { CellState, Puzzle } from './types'
import { findConflicts } from './logic'

/** Hearts at the start of a Daily, Remix, or Endless board (before a bonus heart). */
export const STARTING_HEARTS = 3

export interface MistakeResult {
  lives: number
  shields: number
  /** A shield was spent, so a heart stays. */
  spentShield: boolean
  /** Hearts hit zero: the board is over. */
  gameOver: boolean
  /**
   * What speaks. The mistake that spends the last heart gets the lose line only.
   * Every other mistake, including one a shield blocks, gets the wrong-move taunt.
   */
  taunt: 'place-bad' | 'lose'
}

/**
 * One wrong buddy. Daily, Remix, and Endless all use this.
 * A shield blocks the heart. Otherwise one heart is lost. The last heart ends the board.
 */
export function nextAfterMistake(lives: number, shields: number): MistakeResult {
  if (shields > 0) {
    return { lives, shields: shields - 1, spentShield: true, gameOver: false, taunt: 'place-bad' }
  }
  const next = Math.max(0, lives - 1)
  const gameOver = next <= 0
  return { lives: next, shields: 0, spentShield: false, gameOver, taunt: gameOver ? 'lose' : 'place-bad' }
}

export interface PlacementRun {
  cells: CellState[]
  lives: number
  shields: number
  over: boolean
  taunts: MistakeResult['taunt'][]
}

/** Put a buddy on `index`. A conflict costs a heart (or a shield) and may end the board. */
export function applyBuddyPlacement(puzzle: Puzzle, state: PlacementRun, index: number): PlacementRun {
  const cells = state.cells.slice()
  cells[index] = 'stone'
  const wrong = findConflicts(puzzle, cells).cells.has(index)
  if (!wrong || state.over) return { ...state, cells }
  const step = nextAfterMistake(state.lives, state.shields)
  return {
    cells,
    lives: step.lives,
    shields: step.shields,
    over: step.gameOver,
    taunts: [...state.taunts, step.taunt],
  }
}
