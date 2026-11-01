/**
 * Fire / particle cursors sit on top of the page and steal taps inside a popup.
 * The sign-in sheet pauses every registered effect, and sets html.rg-cursor-fx-paused
 * so a cursor layer can hide itself in CSS. The live game has no cursor effect;
 * this is the switch the sheet uses if one is added.
 */
type CursorFx = { pause: () => void; resume: () => void }

const effects: CursorFx[] = []
let paused = false

export function cursorFxPaused(): boolean {
  return paused
}

export function registerCursorFx(fx: CursorFx): () => void {
  effects.push(fx)
  if (paused) {
    try { fx.pause() } catch { /* a cursor effect must not block the sheet */ }
  }
  return () => {
    const i = effects.indexOf(fx)
    if (i >= 0) effects.splice(i, 1)
  }
}

export function setCursorFxPaused(next: boolean): void {
  if (paused === next) return
  paused = next
  const root = globalThis.document?.documentElement
  root?.classList.toggle('rg-cursor-fx-paused', next)
  for (const fx of effects) {
    try {
      if (next) fx.pause()
      else fx.resume()
    } catch {
      /* ignore a broken effect */
    }
  }
}
