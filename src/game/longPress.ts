/*
 * 9.30-c: a plain long-press detector (touch, pen and mouse through Pointer Events).
 * Fires once after `ms` of holding still. Moving more than `slop` px, lifting, or a cancel stops it,
 * so normal taps and scrolls are untouched. Pure (timers injected) so it is unit-tested.
 */
export interface LongPressOpts {
  ms: number
  onFire: () => void
  slop?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (t: unknown) => void
}
export interface PointerLike {
  pointerId: number
  clientX: number
  clientY: number
  button: number
  isPrimary?: boolean
}

export function createLongPress(o: LongPressOpts) {
  const slop = o.slop ?? 12
  const setT = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearT = o.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>))
  let timer: unknown = null
  let id = -1
  let x = 0
  let y = 0
  const stop = () => {
    if (timer != null) clearT(timer)
    timer = null
    id = -1
  }
  return {
    down(e: PointerLike) {
      if (e.button !== 0 || e.isPrimary === false) return
      stop()
      id = e.pointerId
      x = e.clientX
      y = e.clientY
      timer = setT(() => {
        timer = null
        id = -1
        o.onFire()
      }, o.ms)
    },
    move(e: PointerLike) {
      if (e.pointerId === id && Math.hypot(e.clientX - x, e.clientY - y) > slop) stop()
    },
    up(e: PointerLike) {
      if (e.pointerId === id) stop()
    },
    cancel: stop,
    get holding() {
      return timer != null
    },
  }
}

/** The owner page (web only). Home Screen bookmarks of it open the owner page too. */
export const OWNER_PATH = '/roman-owner'
export const OWNER_LONG_PRESS_MS = 5000
