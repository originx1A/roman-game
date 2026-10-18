import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  BUSINESS_ADDRESS,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CONTACT_EMAIL,
  LEGAL_BLOCKS,
  PURCHASE_AGREE,
  SELLER_AS,
  type LegalSection,
} from '../game/legalCopy'

/** Opens the in-game legal pages. Stays inside the game. */
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
        <nav className="legal-jump">
          {LEGAL_BLOCKS.map((block) => (
            <button key={block.id} type="button" className="legal-link" onClick={() => document.getElementById(`legal-${block.id}`)?.scrollIntoView({ block: 'start' })}>
              {block.title}
            </button>
          ))}
        </nav>
        {LEGAL_BLOCKS.map((block) => (
          <section key={block.id} id={`legal-${block.id}`}>
            <h4>{block.title}{block.version ? ` · Version ${block.version}` : ''}</h4>
            {block.chunks.map((chunk) => (
              <div key={(chunk.id ?? '') + (chunk.heading ?? chunk.paragraphs?.[0]?.slice(0, 24) ?? '')} id={chunk.id ? `legal-${chunk.id}` : undefined}>
                {chunk.heading ? <h5>{chunk.heading}</h5> : null}
                {chunk.paragraphs?.map((text) => (
                  <p key={text.slice(0, 48)}>{text}</p>
                ))}
                {chunk.items ? (
                  <ul>
                    {chunk.items.map((item) => (
                      <li key={item.slice(0, 48)}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        ))}
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

/** Ontario internet-agreement seller details. Shown before checkout. */
export function SellerDisclosure() {
  return (
    <p className="seller-disclosure">
      Seller: {SELLER_NAME_LINE}. Business name: {BUSINESS_NAME}. Address: {BUSINESS_ADDRESS}. Phone: {BUSINESS_PHONE}. Email: {CONTACT_EMAIL}.
    </p>
  )
}

const SELLER_NAME_LINE = SELLER_AS

/** Shown on the purchase PIN screen and beside buy buttons, before checkout opens. */
export function PurchaseAgreeLine({ onOpen }: { onOpen: (section: LegalSection) => void }) {
  return (
    <p className="buy-agree">
      By buying you agree to the{' '}
      <button type="button" className="legal-link" onClick={() => onOpen('terms')}>Terms of Purchase</button>
      {' '}and{' '}
      <button type="button" className="legal-link" onClick={() => onOpen('refunds')}>Refund Policy</button>.
    </p>
  )
}

/** After a paid coin pack is added. Same seller details as the pre-sale disclosure. */
export function PurchaseConfirmation({
  coins,
  label,
  total,
  tax,
  onOpenLegal,
  onClose,
}: {
  coins: number
  label: string
  total?: string
  tax?: string
  onOpenLegal: (section: LegalSection) => void
  onClose: () => void
}) {
  return createPortal(
    <div className="start-sheet legal-sheet" role="dialog" aria-modal="true" aria-label="Purchase confirmation">
      <div className="start-sheet-scrim" onClick={onClose} />
      <div className="start-sheet-card legal-card">
        <h3>Purchase confirmation</h3>
        <p>You bought {label}. +{coins} coins were added to this account.</p>
        {total ? <p>Total: {total}. Currency is the one charged at checkout.</p> : null}
        <p>{tax ?? 'Sales tax, when it applies, was shown on the checkout page before you paid.'}</p>
        <SellerDisclosure />
        <PurchaseAgreeLine onOpen={onOpenLegal} />
        <button type="button" className="btn primary" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  )
}

export { PURCHASE_AGREE }
