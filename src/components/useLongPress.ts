import { useEffect, useMemo, useRef } from 'react'
import { createLongPress } from '../game/longPress'

/** Pointer handlers for a long-press (touch + mouse). Doesn't block taps; suppresses the context menu. */
export function useLongPress(ms: number, onFire: () => void, enabled = true) {
  const fire = useRef(onFire)
  fire.current = onFire
  const lp = useMemo(() => createLongPress({ ms, onFire: () => fire.current() }), [ms])
  useEffect(() => () => lp.cancel(), [lp])
  if (!enabled) return {}
  return {
    onPointerDown: (e: React.PointerEvent) => lp.down(e),
    onPointerMove: (e: React.PointerEvent) => lp.move(e),
    onPointerUp: (e: React.PointerEvent) => lp.up(e),
    onPointerCancel: () => lp.cancel(),
    onPointerLeave: () => lp.cancel(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
