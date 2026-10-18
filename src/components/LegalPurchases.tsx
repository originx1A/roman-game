import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  LEGAL_BLOCKS,
  LEGAL_COMPANY_URL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DRAFT_BANNER,
  PURCHASE_AGREE,
  type LegalSection,
} from '../game/legalCopy'

/** Opens the in-game legal draft. Stays inside the game. */
export function LegalPurchases({
  section,
  onClose,
}: {
  section: LegalSection | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!section) return
    const node = document.getElementById(`legal-${section}`)
    node?.scrollIntoView({ block: 'start' })
  }, [section])

  if (!section || typeof document === 'undefined') return null

  const sheet = (
    <div className="start-sheet legal-sheet" role="dialog" aria-modal="true" aria-label="Legal and purchases">
      <div className="start-sheet-scrim" onClick={onClose} />
      <div className="start-sheet-card legal-card">
        <h3>Legal & Purchases</h3>
        <p className="legal-draft">{LEGAL_DRAFT_BANNER}</p>
        <nav className="legal-jump">
          {LEGAL_BLOCKS.map((block) => (
            <button key={block.id} type="button" className="legal-link" onClick={() => document.getElementById(`legal-${block.id}`)?.scrollIntoView({ block: 'start' })}>
              {block.title}
            </button>
          ))}
        </nav>
        {LEGAL_BLOCKS.map((block) => (
          <section key={block.id} id={`legal-${block.id}`}>
            <h4>{block.title}</h4>
            {block.paragraphs.map((text) => (
              <p key={text.slice(0, 48)}>{text}</p>
            ))}
          </section>
        ))}
        <p>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          {' · '}
          <a href={LEGAL_COMPANY_URL} target="_blank" rel="noopener noreferrer">jrny.fun</a>
        </p>
        <button type="button" className="btn primary" onClick={onClose}>Close</button>
      </div>
    </div>
  )
  return createPortal(sheet, document.body)
}

/** Sits beside a buy button. */
export function LegalBuyLink({ onOpen }: { onOpen: (section: LegalSection) => void }) {
  return (
    <button type="button" className="legal-link" onClick={() => onOpen('terms')}>
      Legal & Purchases
    </button>
  )
}

/** Shown on the purchase PIN screen, before checkout opens. */
export function PurchaseAgreeLine({ onOpen }: { onOpen: (section: LegalSection) => void }) {
  return (
    <p className="buy-agree">
      By buying you agree to the{' '}
      <button type="button" className="legal-link" onClick={() => onOpen('terms')}>Terms</button>
      {' '}and{' '}
      <button type="button" className="legal-link" onClick={() => onOpen('refunds')}>Refund Policy</button>.
    </p>
  )
}

export { PURCHASE_AGREE }
