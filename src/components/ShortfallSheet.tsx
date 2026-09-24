import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

export type ShortfallAction = 'hint' | 'rescue' | 'revive' | 'upgrade'

export interface ShortfallSheetProps {
  open: boolean
  action: ShortfallAction
  need: number
  have: number
  /** optional label e.g. badge name for upgrade */
  detail?: string
  onClose: () => void
  onPlay: () => void
  onShop: () => void
}

const ACTION_LINE: Record<ShortfallAction, (detail?: string) => string> = {
  hint: () => 'Hints cost coins when free hints are gone. Clear a board to earn more.',
  rescue: () => 'Rescue clears a misplaced buddy. Win boards to refill your wallet.',
  revive: () => 'Revive restores hearts so you can keep playing this board.',
  upgrade: (detail) =>
    detail
      ? `Ranking up ${detail} needs more coins. Wins are the free way to earn them.`
      : 'Badge upgrades need more coins. Wins are the free way to earn them.',
}

export function ShortfallSheet({
  open,
  action,
  need,
  have,
  detail,
  onClose,
  onPlay,
  onShop,
}: ShortfallSheetProps) {
  const titleId = useId()
  const short = Math.max(0, need - have)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const node = (
    <div
      className="shortfall-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="shortfall-scrim" aria-label="Close" onClick={onClose} />
      <div className="shortfall-sheet">
        <div className="shortfall-accent" aria-hidden />
        <h2 id={titleId} className="shortfall-title">
          Need more coins
        </h2>
        <p className="shortfall-math">
          You need {need} · you have {have} · short {short}
        </p>
        <p className="shortfall-body">{ACTION_LINE[action](detail)}</p>
        <div className="shortfall-actions">
          <button type="button" className="btn primary" onClick={onPlay}>
            Play for coins
          </button>
          <button type="button" className="btn ghost" onClick={onShop}>
            Coin shop
          </button>
          <button type="button" className="btn shortfall-dismiss" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
