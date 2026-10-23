import { useEffect, useState } from 'react'

/**
 * The Unseen heckler, shown only while his line is actually playing.
 * The parent passes `pop` when his audio starts and null when it ends.
 * A skipped or waiting line never reaches here, so he does not pop out in silence.
 * pointer-events: none — taps pass straight through, never blocks the board.
 */

export interface UnseenPop {
  text: string
  /** Increment to re-trigger for a new line */
  key: number
}

/** Voice texts carry a speaker prefix ("The Unseen: ..."); the bubble has its own name tag. */
function bubbleText(text: string): string {
  return text.replace(/^The Unseen:\s*/i, '')
}

export function UnseenPopup({ pop }: { pop: UnseenPop | null }) {
  const [shown, setShown] = useState<UnseenPop | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (pop) {
      setShown(pop)
      setLeaving(false)
      return
    }
    setLeaving(true)
    const t = window.setTimeout(() => {
      setShown(null)
      setLeaving(false)
    }, 1000)
    return () => window.clearTimeout(t)
  }, [pop])

  if (!shown) return null

  return (
    <div className={`unseen-pop ${leaving ? 'is-leaving' : 'is-entering'}`} aria-hidden="true">
      <div className="unseen-bubble">
        <span className="unseen-name">The Unseen</span>
        <p>{bubbleText(shown.text)}</p>
      </div>
      <picture>
        <source srcSet="/images/unseen.webp" type="image/webp" />
        <img className="unseen-art" src="/images/unseen.png" alt="" draggable={false} />
      </picture>
    </div>
  )
}
