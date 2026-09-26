/**
 * One finger tap = one action, for buttons that act on touch release.
 *
 * iOS Safari can drop or delay the synthetic click after a tap (double-tap
 * zoom detection, a touch that wobbles a little, focus juggling), so Undo and
 * Redo act on the touch release itself. The browser may then still send the
 * click (or both pointerup and touchend arrive); those must not act again.
 */
export const CLICK_AFTER_TOUCH_MS = 800

export interface TapGuard {
  /** A finger (or pen) went down on the button. */
  down(): void
  /** The finger lifted on the button. True if this release should act. */
  release(): boolean
  /** The finger slid off or the system cancelled the touch. */
  cancel(): void
  /** A click arrived. True if it should act (mouse, keyboard, or a tap we never saw). */
  click(): boolean
}

export function createTapGuard(now: () => number = () => Date.now()): TapGuard {
  let armed = false
  let lastTouchAction = Number.NEGATIVE_INFINITY
  return {
    down() {
      armed = true
    },
    release() {
      if (!armed) return false
      armed = false
      lastTouchAction = now()
      return true
    },
    cancel() {
      armed = false
    },
    click() {
      return now() - lastTouchAction > CLICK_AFTER_TOUCH_MS
    },
  }
}
