import { useEffect, useRef, useState } from 'react'

/**
 * Old-timer heckler visual pop-up.
 *
 * Shows ONLY for the old-timer's voice lines (clip ids starting with `old_`
 * or `tip_*_old_*`) — never for Roman or the Coach. The parent (App.tsx)
 * decides when a line qualifies and passes it here via the `pop` prop.
 *
 * - Slides in from the bottom-right corner with a spring
 * - Character art + speech bubble with the line's text
 * - Auto-dismisses after ~4.5s; a new line replaces the current one
 * - pointer-events: none — taps pass straight through, never blocks the board
 * - Purely visual: no game logic, no voice timing changes
 */

export interface OldTimerPop {
  text: string
  /** Increment to re-trigger for a new line */
  key: number
}

interface Props {
  pop: OldTimerPop | null
  /** ms the pop-up stays visible (default 4500) */
  holdMs?: number
}

export function OldTimerPopup({ pop, holdMs = 4500 }: Props) {
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
    setText(pop.text)
    setLeaving(false)
    setVisible(true)
    // Start the exit animation slightly before unmount so the spring plays out
    hideTimer.current = window.setTimeout(() => setLeaving(true), holdMs)
    leaveTimer.current = window.setTimeout(() => setVisible(false), holdMs + 450)
    return () => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
    }
  }, [pop, holdMs])

  if (!visible) return null

  return (
    <div
      className={`oldtimer-pop ${leaving ? 'is-leaving' : 'is-entering'}`}
      aria-hidden="true"
    >
      <div className="oldtimer-bubble">
        <span className="oldtimer-name">Old-timer</span>
        <p>{text}</p>
      </div>
      <img
        className="oldtimer-art"
        src="/images/oldtimer.png"
        alt=""
        draggable={false}
      />
    </div>
  )
}
