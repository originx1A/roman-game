import { useEffect, useRef, useState } from 'react'
import { PetArt } from './PetArt'
import type { PetId } from '../game/pets'
import { petById } from '../game/pets'
import { treasureIcon, treasureLabel, type Treasure } from '../game/paradeTreasure'
import { dayLabel, type DayPerkKind } from '../game/buddyDay'

export interface ParadeBuddy {
  id: PetId
  /** not owned yet: drawn as a silhouette */
  locked: boolean
}

/**
 * Buddy Parade (9.30-j, treasure + buddy of the day 9.30-l): a short march of buddies across the
 * screen between games. Each marching buddy may carry a small drop: tap the BUDDY to catch it.
 * Tapping anywhere else skips the parade and forfeits what was not caught. One buddy is the
 * buddy of the day (its perk rides for the next 3 boards). Light on purpose: a handful of SVGs
 * moved with CSS transforms. With reduced motion the buddies stand in a row for a moment.
 */
export function ParadeOverlay({
  buddies,
  treasure,
  featured,
  featuredKind,
  durationMs,
  reduce,
  onCatch,
  onDone,
}: {
  buddies: ParadeBuddy[]
  /** index-aligned with `buddies`; missing = nothing carried */
  treasure: (Treasure | undefined)[]
  /** the buddy of the day (null = a guest silhouette) */
  featured: PetId | null
  featuredKind: DayPerkKind
  durationMs: number
  reduce: boolean
  onCatch: (t: Treasure) => void
  onDone: () => void
}) {
  const [caught, setCaught] = useState<Set<number>>(() => new Set())
  const doneRef = useRef(false)
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }
  useEffect(() => {
    const t = window.setTimeout(finish, reduce ? Math.min(durationMs, 6000) : durationMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const total = treasure.filter(Boolean).length
  const featuredName = featured ? petById(featured)?.name : null
  return (
    <div
      className={`parade ${reduce ? 'is-still' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Buddy parade. Tap a buddy to catch its treasure. Tap anywhere else to skip."
      data-testid="parade"
      style={{ ['--parade-ms' as string]: `${reduce ? 0 : durationMs}ms` }}
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') finish()
      }}
    >
      <div className="parade-title">Buddy Parade!</div>
      <div className="parade-day" data-testid="parade-day">
        Buddy of the day: <strong>{featuredName ?? 'a guest buddy'}</strong>
        <small>{dayLabel(featuredKind)} for your next 3 boards</small>
      </div>
      <div className="parade-lane">
        {buddies.map((b, i) => {
          const t = treasure[i]
          const got = caught.has(i)
          return (
            <div key={b.id} className="parade-buddy" style={{ ['--i' as string]: i, ['--n' as string]: buddies.length }}>
              <div className="parade-hop">
                {t ? (
                  <button
                    type="button"
                    className={`parade-loot ${got ? 'is-got' : ''}`}
                    data-testid="parade-loot"
                    aria-label={got ? `Caught ${treasureLabel(t)}` : `Catch ${treasureLabel(t)}`}
                    disabled={got}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (got) return
                      setCaught((s) => new Set(s).add(i))
                      onCatch(t)
                    }}
                  >
                    <span aria-hidden>{treasureIcon(t)}</span>
                    <b>{treasureLabel(t)}</b>
                  </button>
                ) : null}
                <div className={b.id === featured ? 'parade-star' : undefined}>
                  <PetArt id={b.id} size={b.id === featured ? 88 : 72} locked={b.locked} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="parade-skip">
        {total ? `Tap a buddy to catch its treasure (${caught.size}/${total}) · tap elsewhere to skip` : 'Tap to skip'}
      </div>
    </div>
  )
}
