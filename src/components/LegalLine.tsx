import { SUPPORT_ADDRESS, SUPPORT_EMAIL } from '../game/shopOffers'

/** Terms, Privacy, and the support address. Same line on Shop, Account, sign-in, and the footer. */
export function LegalLine() {
  return (
    <p className="legal-line" data-testid="legal-line">
      <a href="https://romansgame.com/terms" target="_blank" rel="noopener">Terms</a>
      <span aria-hidden="true"> · </span>
      <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a>
      <span aria-hidden="true"> · </span>
      <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
      <span className="legal-address">{SUPPORT_ADDRESS}</span>
    </p>
  )
}
