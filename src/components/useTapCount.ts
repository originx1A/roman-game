import { useMemo, useRef } from 'react'
import { createTapCounter } from '../game/ownerDoor'

/** Pointer handler that counts quick taps (touch + mouse) and fires after `count` within `windowMs`. Single taps pass through untouched. */
export function useTapCount(count: number, windowMs: number, onFire: () => void, enabled = true) {
  const fire = useRef(onFire)
  fire.current = onFire
  const tc = useMemo(() => createTapCounter({ count, windowMs, onFire: () => fire.current() }), [count, windowMs])
  if (!enabled) return {}
  return {
    onPointerUp: (e: React.PointerEvent) => {
      if (e.button === 0 && e.isPrimary !== false) tc.tap()
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
