import { useState } from 'react'

/**
 * 9.33-a9 (Tony, Nov 8): the flat brownie-gold gradient is gone. The game's
 * backdrop is now a LORE IMAGE — the approved Defender / Empty Throne art
 * from the story world (poster text cropped out at prep time; see
 * scripts-prep/make-lore-backdrops.mjs). One image is picked per session
 * (stable within the session, a different one next visit), painted dim and
 * soft under dark scrims by the .lore-bg rules in App.css so the board and
 * every label stay perfectly readable over it. Pure decoration.
 */
const LORE_BACKDROPS = [
  '/images/lore/throne.webp',
  '/images/lore/leo.webp',
  '/images/lore/lupa.webp',
  '/images/lore/aquila.webp',
  '/images/lore/nox.webp',
  '/images/lore/invictus.webp',
] as const

const KEY = 'rg.loreBg.v1'

function pickBackdrop(): string {
  try {
    const saved = window.sessionStorage.getItem(KEY)
    if (saved && (LORE_BACKDROPS as readonly string[]).includes(saved)) return saved
    const next = LORE_BACKDROPS[Math.floor(Math.random() * LORE_BACKDROPS.length)]
    window.sessionStorage.setItem(KEY, next)
    return next
  } catch {
    return LORE_BACKDROPS[0]
  }
}

export function LoreBackdrop() {
  const [src] = useState<string>(() =>
    typeof window === 'undefined' ? LORE_BACKDROPS[0] : pickBackdrop(),
  )
  return (
    <div className="lore-bg" aria-hidden>
      <img src={src} alt="" draggable={false} />
    </div>
  )
}
