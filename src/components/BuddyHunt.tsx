import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { Buddy } from './Board'
import { TapButton } from './TapButton'
import { BUDDY_HUNT_BUDDIES, BUDDY_HUNT_GRID, BUDDY_HUNT_TAPS, placeBuddies } from '../game/buddyHunt'
import { sfxGiggle, sfxPlace, sfxTap } from '../game/sound'
import type { ThemeId } from '../game/types'

interface Props {
  themeId: ThemeId
  /** Called once when the round ends; returns the prize line to show. */
  onFinish: (found: number) => string
  onMiss: () => void
  onClose: () => void
  /** Debug hook only (?debug=buddyhunt): marks buddy tiles so an automated check can find them. */
  debug?: boolean
}

type Reveal = 'buddy' | 'empty'

export function BuddyHunt({ themeId, onFinish, onMiss, onClose, debug }: Props) {
  const buddies = useMemo(() => new Set(placeBuddies()), [])
  const [revealed, setRevealed] = useState<Map<number, Reveal>>(() => new Map())
  const [taps, setTaps] = useState(BUDDY_HUNT_TAPS)
  const [found, setFound] = useState(0)
  const [result, setResult] = useState('')
  const doneRef = useRef(false)
  const done = result !== ''

  function tapTile(i: number) {
    if (doneRef.current || revealed.has(i) || taps <= 0) return
    const hit = buddies.has(i)
    const next = new Map(revealed)
    next.set(i, hit ? 'buddy' : 'empty')
    const nextFound = found + (hit ? 1 : 0)
    const nextTaps = taps - 1
    setRevealed(next)
    setTaps(nextTaps)
    setFound(nextFound)
    if (hit) {
      sfxPlace()
      sfxGiggle()
    } else {
      sfxTap()
    }
    if (nextFound >= BUDDY_HUNT_BUDDIES || nextTaps <= 0) {
      doneRef.current = true
      setResult(onFinish(nextFound))
    } else if (!hit) {
      onMiss()
    }
  }

  return (
    <div className="buddy-hunt" role="dialog" aria-label="Buddy Hunt bonus round">
      <div className="buddy-hunt-card">
        <h2 className="buddy-hunt-title">Buddy Hunt!</h2>
        <p className="buddy-hunt-sub">
          Find {BUDDY_HUNT_BUDDIES} hidden buddies in {BUDDY_HUNT_TAPS} taps
        </p>
        <p className="buddy-hunt-status" aria-live="polite">
          <span>
            Taps left <strong data-hunt-taps={taps}>{taps}</strong>
          </span>
          <span>
            Found <strong data-hunt-found={found}>{found}/{BUDDY_HUNT_BUDDIES}</strong>
          </span>
        </p>
        <div className="buddy-hunt-grid" style={{ '--hg': BUDDY_HUNT_GRID } as CSSProperties}>
          {Array.from({ length: BUDDY_HUNT_GRID * BUDDY_HUNT_GRID }, (_, i) => {
            const r = revealed.get(i)
            const missedBuddy = done && !r && buddies.has(i)
            return (
              <TapButton
                key={i}
                className={`buddy-hunt-tile ${r ? `is-${r}` : ''} ${missedBuddy ? 'is-missed' : ''}`}
                onTap={() => tapTile(i)}
                disabled={done || !!r}
                aria-label={r ? (r === 'buddy' ? 'Buddy found' : 'Empty') : `Tile ${i + 1}`}
                data-hunt-tile={i}
                data-hunt-buddy={debug && buddies.has(i) ? '1' : undefined}
              >
                {r === 'buddy' || missedBuddy ? <Buddy themeId={themeId} win={r === 'buddy'} /> : null}
                {!r && !missedBuddy ? <span className="buddy-hunt-back">?</span> : null}
              </TapButton>
            )
          })}
        </div>
        <p className={`buddy-hunt-result ${done ? '' : 'is-empty'}`} data-hunt-result>
          {result || ' '}
        </p>
        <button type="button" className="btn primary buddy-hunt-done" onClick={onClose} disabled={!done}>
          {done ? 'Collect' : 'Keep hunting…'}
        </button>
      </div>
    </div>
  )
}
