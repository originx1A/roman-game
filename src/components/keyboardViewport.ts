/** Visible area in layout-viewport coordinates. */
export interface ViewportBox {
  top: number
  left: number
  width: number
  height: number
}

/**
 * The real visible rectangle from the Visual Viewport API.
 * When the on-screen keyboard is up, `height` is the space above it and `top`
 * is how far iOS has panned that window down the layout viewport.
 */
export function visibleViewportBox(
  vv: { offsetTop: number; offsetLeft: number; width: number; height: number } | null | undefined,
  layout: { width: number; height: number },
): ViewportBox {
  if (!vv || !(vv.width > 0) || !(vv.height > 0)) {
    return { top: 0, left: 0, width: Math.max(0, layout.width), height: Math.max(0, layout.height) }
  }
  return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
}

/**
 * `position: fixed` is usually relative to the layout viewport, so the sheet
 * must be shifted by `visualViewport.offsetTop` to stay in the visible area.
 * A few browsers already attach fixed elements to the visual viewport; adding
 * the offset again would push the sheet down by the same amount. `measuredTop`
 * is `getBoundingClientRect().top` after the layout-viewport placement. A value
 * near the proposed offset means the browser already accounted for it.
 */
export function placeSheet(proposed: ViewportBox, measured: { top: number; left: number }): ViewportBox {
  const visualRelative = proposed.top > 2 && measured.top > proposed.top * 0.5
  if (!visualRelative) return proposed
  return { top: 0, left: 0, width: proposed.width, height: proposed.height }
}

export function readVisibleViewport(): ViewportBox {
  if (typeof window === 'undefined') return { top: 0, left: 0, width: 0, height: 0 }
  const vv = window.visualViewport
  return visibleViewportBox(vv, { width: window.innerWidth, height: window.innerHeight })
}

/**
 * Phones and tablets. Desktop (fine pointer, no mobile UA) keeps the normal fields.
 * The UA check covers iPhone emulation and the rare Safari build that reports a fine pointer.
 */
export function wantsKeyboardNameSheet(env: {
  coarse: boolean
  fine: boolean
  maxTouchPoints: number
  userAgent: string
}): boolean {
  if (env.coarse) return true
  if (env.maxTouchPoints > 0 && !env.fine) return true
  return /iPhone|iPad|iPod|Android/i.test(env.userAgent)
}

export function keyboardNameSheetFromWindow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return wantsKeyboardNameSheet({
    coarse: window.matchMedia('(pointer: coarse)').matches,
    fine: window.matchMedia('(pointer: fine)').matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    userAgent: navigator.userAgent ?? '',
  })
}
