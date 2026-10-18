import { createPortal } from 'react-dom'
import { CARD_REVEAL } from '../game/worldLinks'

/** Shown once the Unseen card is earned. The collection page cannot show it yet. */
export function SpecialCardReveal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="start-sheet card-reveal" role="dialog" aria-modal="true" aria-label={CARD_REVEAL.title}>
      <div className="start-sheet-scrim" onClick={onClose} />
      <div className="start-sheet-card">
        <h3>{CARD_REVEAL.title}</h3>
        <p className="start-sheet-tip">{CARD_REVEAL.body}</p>
        <a className="btn primary" href={CARD_REVEAL.href} target="_blank" rel="noopener noreferrer">
          {CARD_REVEAL.button}
        </a>
        <button type="button" className="btn ghost" onClick={onClose}>Keep playing</button>
      </div>
    </div>,
    document.body,
  )
}
