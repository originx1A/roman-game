import { useEffect, useRef, useState } from 'react'

/**
 * The Unseen heckler visual pop-up (9.31-u; was the Unseen pop-up from 10.06).
 *
 * Shows ONLY for the heckler's voice lines (clip ids starting with `old_`
 * or `tip_*_old_*`; the ids keep the old prefix so the recorded audio files still match)
 * — never for Roman or the Coach. The parent (App.tsx) decides when a line qualifies.
 *
 * - The hooded Unseen sticker rises out of the bottom-right corner, pointing up and in at the board
 * - Speech bubble above him with the line's text, shown while its clip plays
 * - Auto-dismisses after ~4.5s; a new line replaces the current one
 * - pointer-events: none — taps pass straight through, never blocks the board
 */

export interface UnseenPop {
  text: string
  /** Increment to re-trigger for a new line */
  key: number
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
    if (!pop || pop.key === lastKey.current) return
    lastKey.current = pop.key
    window.clearTimeout(hideTimer.current)
    window.clearTimeout(leaveTimer.current)
    setText(bubbleText(pop.text))
    setLeaving(false)
    setVisible(true)
    hideTimer.current = window.setTimeout(() => setLeaving(true), holdMs)
    leaveTimer.current = window.setTimeout(() => setVisible(false), holdMs + 450)
    return () => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
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
