import { useEffect, useRef, useState } from 'react'
import { petById, type PetId } from '../game/pets'
import { PetArt } from './PetArt'
import type { GuideKind, GuideTarget } from '../game/unseenGuide'

/**
 * The Unseen as the game's notification/guide character (Tony 2026-10-19, PR #53 batch 2).
 *
 * Visual entrance reuses the heckler pop-up pattern (UnseenPopup): the hooded
 * Unseen sticker rises from the bottom-right with a speech bubble. Unlike the
 * heckler pop-up (pointer-events:none), the guide is TAPPABLE — tapping takes
 * the player to the relevant page. No voice audio: the guide lines have no
 * recordings, and the voice pipeline only plays catalog clips, so the bubble
 * text carries the line until Tony records/approves TTS for them.
 */

export interface GuideItem {
  kind: GuideKind
  text: string
  target: GuideTarget
  /** Increment to re-trigger for a new guide */
  key: number
}

interface GuideProps {
  guide: GuideItem | null
  onGo: (target: GuideTarget) => void
  onDismiss: () => void
  /** Fired when the pop-up finishes hiding on its own (so the parent can clear state) */
  onDone: () => void
  /** ms the guide stays visible (default 8000) */
  holdMs?: number
}

export function UnseenGuide({ guide, onGo, onDismiss, onDone, holdMs = 8000 }: GuideProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [item, setItem] = useState<GuideItem | null>(null)
  const hideTimer = useRef(0)
  const leaveTimer = useRef(0)
  const lastKey = useRef(-1)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!guide) {
      // Dismissed from outside (X button): hide immediately.
      setVisible(false)
      setLeaving(false)
      return
    }
    if (guide.key === lastKey.current) return
    lastKey.current = guide.key
    window.clearTimeout(hideTimer.current)
    window.clearTimeout(leaveTimer.current)
    setItem(guide)
    setLeaving(false)
    setVisible(true)
    hideTimer.current = window.setTimeout(() => setLeaving(true), holdMs)
    leaveTimer.current = window.setTimeout(() => {
      setVisible(false)
      onDoneRef.current()
    }, holdMs + 450)
    return () => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
    }
  }, [guide, holdMs])

  if (!visible || !item) return null

  return (
    <div
      className={`unseen-pop unseen-guide ${leaving ? 'is-leaving' : 'is-entering'}`}
      role="alertdialog"
      aria-label={`The Unseen: ${item.text}`}
    >
      <div className="unseen-bubble" onClick={() => onGo(item.target)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onGo(item.target) }}>
        <span className={`unseen-indicator is-${item.kind}`} aria-hidden="true" />
        <span className="unseen-name">The Unseen</span>
        <p>{item.text}</p>
        <span className="unseen-cta" aria-hidden="true">Tap to open ›</span>
      </div>
      <button type="button" className="unseen-dismiss" onClick={onDismiss} aria-label="Dismiss the Unseen">
        ×
      </button>
      <picture onClick={() => onGo(item.target)} aria-hidden="true">
        <source srcSet="/images/unseen.webp" type="image/webp" />
        <img className="unseen-art" src="/images/unseen.png" alt="" draggable={false} />
      </picture>
    </div>
  )
}

/**
 * Silent pet pop-out (Tony 2026-10-19, PR #53 batch 2).
 *
 * Pets pop out like the Unseen — no dialogue, just visual:
 * - red tint/glow when hungry, droopy animation when unhappy ('okay')
 * - mini meter bar under them showing the low stat
 * Slides back after a few seconds if ignored; tappable → the Stable.
 */
export interface PetPopoutInfo {
  id: PetId
  kind: 'hungry' | 'okay'
  /** mood 0-100, drives the mini meter */
  mood: number
  /** Increment to re-trigger for a new pop-out */
  key: number
}

interface PetPopoutProps {
  pop: PetPopoutInfo | null
  onGo: () => void
  onDismiss: () => void
  /** Fired when the pop-out finishes hiding on its own (so the parent can clear state) */
  onDone: () => void
  /** ms the pop-out stays visible (default 6000) */
  holdMs?: number
}

export function PetPopout({ pop, onGo, onDismiss, onDone, holdMs = 6000 }: PetPopoutProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [item, setItem] = useState<PetPopoutInfo | null>(null)
  const hideTimer = useRef(0)
  const leaveTimer = useRef(0)
  const lastKey = useRef(-1)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!pop) {
      setVisible(false)
      setLeaving(false)
      return
    }
    if (pop.key === lastKey.current) return
    lastKey.current = pop.key
    window.clearTimeout(hideTimer.current)
    window.clearTimeout(leaveTimer.current)
    setItem(pop)
    setLeaving(false)
    setVisible(true)
    hideTimer.current = window.setTimeout(() => setLeaving(true), holdMs)
    leaveTimer.current = window.setTimeout(() => {
      setVisible(false)
      onDoneRef.current()
    }, holdMs + 450)
    return () => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
    }
  }, [pop, holdMs])

  if (!visible || !item) return null
  const p = petById(item.id)

  return (
    <div
      className={`pet-pop is-pet-${item.kind} ${leaving ? 'is-leaving' : 'is-entering'}`}
      role="status"
      aria-label={`${p?.name ?? 'Your buddy'} needs attention — tap to open the Stable`}
    >
      <button type="button" className="pet-pop-tap" onClick={onGo}>
        <span className={`pet-pop-art${item.kind === 'okay' ? ' is-droop' : ''}`} aria-hidden="true">
          <PetArt id={item.id} size={92} />
        </span>
        <span className="pet-pop-meter" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, Math.round(item.mood)))}%` }} />
        </span>
      </button>
      <button type="button" className="pet-pop-x" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
