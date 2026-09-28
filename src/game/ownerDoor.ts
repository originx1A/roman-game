/*
 * 9.30-d: the hidden owner door is 7 quick taps on the home title within 3 s (it replaced the
 * 9.30-c long-press, which iOS's copy/paste menu got in the way of). Pure (clock injected) so it
 * is unit-tested.
 */
export const OWNER_PATH = '/roman-owner'
export const OWNER_TAPS = 7
export const OWNER_TAP_WINDOW_MS = 3000

export function createTapCounter(o: { count: number; windowMs: number; onFire: () => void; now?: () => number }) {
  const now = o.now ?? (() => Date.now())
  let taps: number[] = []
  return {
    tap() {
      const t = now()
      taps = [...taps.filter((x) => t - x <= o.windowMs), t]
      if (taps.length >= o.count) {
        taps = []
        o.onFire()
        return true
      }
      return false
    },
    get taps() {
      return taps.length
    },
  }
}
