import { useEffect, useState } from 'react'
import { onQuiet, quietSnapshot } from '../game/quietQueue'

/** Small banner. It waits until the round is over, then fades. */
export function QuietToast() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    return onQuiet(() => setText(quietSnapshot().current?.text ?? null))
  }, [])
  if (!text) return null
  return (
    <div className="quiet-toast" role="status" data-testid="quiet-toast">
      {text}
    </div>
  )
}
