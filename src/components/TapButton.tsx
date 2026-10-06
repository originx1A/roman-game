import { useEffect, useRef, type ButtonHTMLAttributes } from 'react'
import { createTapGuard } from '../game/tapGuard'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  onTap: () => void
}

/** Finger may drift this far outside the button and still count as a tap on it. */
const EDGE_SLOP_PX = 12

function inside(el: HTMLElement, x: number, y: number): boolean {
  const r = el.getBoundingClientRect()
  return x >= r.left - EDGE_SLOP_PX && x <= r.right + EDGE_SLOP_PX && y >= r.top - EDGE_SLOP_PX && y <= r.bottom + EDGE_SLOP_PX
}

/**
 * A button that acts on the touch release (pointerup / touchend) instead of
 * waiting for the click iOS may never send. Mouse and keyboard still use click.
 * Each tap acts once: the click that follows a handled touch is ignored.
 */
export function TapButton({ onTap, className, style, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const onTapRef = useRef(onTap)
  onTapRef.current = onTap
  const guardRef = useRef(createTapGuard())

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const guard = guardRef.current
    const fire = () => {
      if (!el.disabled) onTapRef.current()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') guard.down()
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      if (!inside(el, e.clientX, e.clientY)) {
        guard.cancel()
        return
      }
      if (guard.release()) fire()
    }
    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') guard.cancel()
    }
    const onTouchStart = () => guard.down()
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (t && !inside(el, t.clientX, t.clientY)) {
        guard.cancel()
        return
      }
      // Handled here: no synthetic click, and no double-tap zoom on a quick second tap.
      if (e.cancelable) e.preventDefault()
      if (guard.release()) fire()
    }
    const onTouchCancel = () => guard.cancel()
    const onClick = () => {
      if (guard.click()) fire()
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', onTouchCancel)
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      className={`${className ?? ''} tap-button`.trim()}
      style={{ touchAction: 'manipulation', ...style }}
      {...rest}
    />
  )
}
