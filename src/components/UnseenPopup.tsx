import { useEffect, useRef, useState } from 'react'
import { watchVoiceEnd } from '../game/sound'

/**
 * The Unseen heckler visual pop-up (9.31-u; was the Unseen pop-up from 10.06).
 *
 * Shows ONLY for the heckler's voice lines (clip ids starting with `old_`
 * or `tip_*_old_*`; the ids keep the old prefix so the recorded audio files still match)
 * — never for Roman or the Coach. The parent (App.tsx) decides when a line qualifies.
 *
 * - The hooded Unseen sticker rises out of the bottom-right corner, pointing up and in at the board
 * - Speech bubble above him with the line's text, shown while its clip plays
 * - A voiced line stays up until that clip ends. Text-only lines dismiss on their hold.
 * - pointer-events: none — taps pass straight through, never blocks the board
 */

export interface UnseenPop {
  text: string
  /** Increment to re-trigger for a new line */
  key: number
  /** Override the usual hold. Leaderboard teases are text-only and a little longer. */
  holdMs?: number
  /** Catalog clip played with this pop. Reminders on Home use their own hook. */
  clip?: string
}

interface Props {
  pop: UnseenPop | null
  /** ms the pop-up stays visible (default 4500) */
  holdMs?: number
}

/** Voice texts carry a speaker prefix ("The Unseen: ..."); the bubble has its own name tag. */
function bubbleText(text: string): string {
  return text.replace(/^(The Unseen|The Unseen):\s*/i, '')
}

export function UnseenPopup({ pop, holdMs = 4500 }: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [text, setText] = useState('')
  const hideTimer = useRef(0)
  const leaveTimer = useRef(0)
  const lastKey = useRef(-1)

  useEffect(() => {
    if (!pop) {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
      setVisible(false)
      setLeaving(false)
      return
    }
    if (pop.key === lastKey.current) return
    lastKey.current = pop.key
    window.clearTimeout(hideTimer.current)
    window.clearTimeout(leaveTimer.current)
    // A clip that has started must not have its bubble torn down at 4.5s.
    // The longest Unseen file is about 11s; 16s is the ceiling if the end event never arrives.
    const voiced = Boolean(pop.clip)
    const stay = voiced ? Math.max(pop.holdMs ?? holdMs, 16000) : (pop.holdMs ?? holdMs)
    setText(bubbleText(pop.text))
    setLeaving(false)
    setVisible(true)
    const arm = (ms: number) => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
      hideTimer.current = window.setTimeout(() => setLeaving(true), ms)
      leaveTimer.current = window.setTimeout(() => setVisible(false), ms + 450)
    }
    arm(stay)
    const stop = pop.clip
      ? watchVoiceEnd((clip) => {
          if (clip === pop.clip) arm(400)
        })
      : undefined
    return () => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
      stop?.()
    }
  }, [pop, holdMs])

  if (!visible) return null

  return (
    <div className={`unseen-pop ${leaving ? 'is-leaving' : 'is-entering'}`} aria-hidden="true">
      <div className="unseen-bubble">
        <span className="unseen-name">The Unseen</span>
        <p>{text}</p>
      </div>
      <picture>
        <source srcSet="/images/unseen.webp" type="image/webp" />
        <img className="unseen-art" src="/images/unseen.png" alt="The Unseen" draggable={false} />
      </picture>
    </div>
  )
}
