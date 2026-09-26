/** How far a finger may wander in the board's gaps and still count as a tap. */
export const TAP_SLOP_PX = 10

/** Holding a finger on an X or buddy this long clears it to empty. */
export const LONG_PRESS_MS = 450

export interface GestureStart {
  x: number
  y: number
  /** Cell under the finger when it went down, if any. */
  index: number | null
}

/**
 * True once a touch has become a swipe: it reached a different cell, or drifted
 * past the slop while over no cell. A real finger always wobbles a pixel or two
 * during a tap; that must not turn the tap into a swipe, or tapping an X to
 * cycle it silently does nothing on a phone.
 */
export function hasLeftTap(start: GestureStart, x: number, y: number, index: number | null): boolean {
  if (index != null) return index !== start.index
  return Math.hypot(x - start.x, y - start.y) > TAP_SLOP_PX
}
