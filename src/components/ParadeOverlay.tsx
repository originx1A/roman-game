import { useEffect } from 'react'
import { PetArt } from './PetArt'
import type { PetId } from '../game/pets'

export interface ParadeBuddy {
  id: PetId
  /** not owned yet: drawn as a silhouette */
  locked: boolean
}

/**
 * Buddy Parade (9.30-j): a short march of buddies across the screen between games. Light on
 * purpose: a handful of SVGs moved with CSS transforms, no per-frame scripting. Tap anywhere to
 * skip. With reduced motion the buddies just stand in a row for a moment.
 */
export function ParadeOverlay({
  buddies,
  durationMs,
  reduce,
  onDone,
}: {
  buddies: ParadeBuddy[]
  durationMs: number
  reduce: boolean
  onDone: () => void
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, reduce ? Math.min(durationMs, 3000) : durationMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      className={`parade ${reduce ? 'is-still' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Buddy parade. Tap to skip."
      data-testid="parade"
      style={{ ['--parade-ms' as string]: `${reduce ? 0 : durationMs}ms` }}
      onClick={onDone}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onDone()
      }}
    >
      <div className="parade-title">Buddy Parade!</div>
      <div className="parade-lane">
        {buddies.map((b, i) => (
          <div key={b.id} className="parade-buddy" style={{ ['--i' as string]: i, ['--n' as string]: buddies.length }}>
            <div className="parade-hop">
              <PetArt id={b.id} size={76} locked={b.locked} />
            </div>
          </div>
        ))}
      </div>
      <div className="parade-skip">Tap to skip</div>
    </div>
  )
}
