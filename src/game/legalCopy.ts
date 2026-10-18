/**
 * In-game legal draft. Not final. The owner reviews it before it is published.
 * One copy so the game, the purchase PIN screen, and public/legal.html stay aligned.
 */

export const LEGAL_DRAFT_BANNER = 'DRAFT for owner review. This is not final legal text.'

/** Draft inbox. The owner must confirm it before this text is published. */
export const LEGAL_CONTACT_EMAIL = 'hello@jrny.fun'
export const LEGAL_COMPANY = 'JRNY'
export const LEGAL_COMPANY_URL = 'https://jrny.fun'

export const PURCHASE_AGREE = 'By buying you agree to the Terms and Refund Policy'

export type LegalSection = 'terms' | 'refunds' | 'privacy' | 'parents' | 'contact'

export interface LegalBlock {
  id: LegalSection
  title: string
  paragraphs: string[]
}

export const LEGAL_BLOCKS: readonly LegalBlock[] = [
  {
    id: 'terms',
    title: 'Terms of Purchase',
    paragraphs: [
      'These terms cover coin packs and any paid perk badges sold for Roman’s Game by JRNY (jrny.fun).',
      'Coins are a virtual balance inside the game. You can spend them on hints, rescues, revives, buddy care, and buddy prices. Perk badges, if they are sold later, are optional helpers. A run that uses a paid perk is marked assisted. Coins, badges, and other virtual items have no cash value. They are not money, they cannot be redeemed for cash, and they are not a loot box or a random paid reward.',
      'Players in Canada are charged in Canadian dollars (CAD). Players in the United States are charged in US dollars (USD). The payment page shows the full price, including taxes, before you pay. Draft note: website checkout still charges the existing US-dollar pack prices until Canadian-dollar prices are turned on. The page you pay on shows that amount first.',
      'Coins are added only after the payment succeeds. A guest can play every mode. Buying requires a sign-in and the purchase PIN.',
    ],
  },
  {
    id: 'refunds',
    title: 'Refund & Return Policy',
    paragraphs: [
      'Email ' + LEGAL_CONTACT_EMAIL + ' within 14 days of the charge if a purchase was unauthorized or accidental and the coins from that purchase are still unspent. Say the account email, the date, and the pack. We will refund that charge or restore the unspent coins.',
      'If the coins from that purchase were already spent, write anyway and we will look at what is left. This draft does not take away a right you already have where you live.',
      'Canada, including Quebec: the price on the payment page is the price you pay, with taxes included in that total. We do not add a fee after you agree. Quebec’s rules for contracts made at a distance, and other Canadian consumer rules, still apply. Nothing here removes them.',
      'United States: the price is shown before you pay. You can ask for a refund as written above. A state law or your card network may give you more than this draft does.',
      'Ask us before you dispute the charge with your bank. A chargeback can pause new purchases on that account until the bank finishes its review. Asking us first is the fastest way to get a refund.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy',
    paragraphs: [
      'Roman’s Game is for a general audience, including children. There are no ads and no loot boxes.',
      'A guest save stays on this device: coins, buddies, badges, scores, and settings. Clearing the site data deletes that guest save. If you sign in, the email, the leaderboard name you pick, and finished scores are saved to the account. Guest progress already on this device moves into the account. It is not wiped.',
      'Buying coins requires a sign-in and a 4-digit purchase PIN. We store a scrambled copy of the PIN, not the digits. Stripe hosts the payment page. The game does not see or store your card number. A purchase record (the pack, the amount, the time, and a short reference) is tied to the account so the same payment is not counted twice.',
      'The website can count play anonymously. You can switch that off in Save & settings. Google Analytics stays off unless you turn it on there. It does not receive your name, email, or account id. The iPhone and Android apps do not load it.',
      'We do not sell personal information.',
    ],
  },
  {
    id: 'parents',
    title: "Parents' info",
    paragraphs: [
      'Anyone can play without an account. Buying coins requires a sign-in. The sign-in email has to be verified: the player opens the link in that email.',
      'The account holder sets a 4-digit purchase PIN the first time and enters it before every payment page. Setting or resetting the PIN also requires that verified email. A reset link goes only to the sign-in address. Five wrong tries lock purchases for 15 minutes.',
      'The payment page can offer Apple Pay or Google Pay. Those use the phone’s Face ID or fingerprint. A typed card is there if you need it. The game does not save the card for a one-tap buy later.',
      'New coin purchases on the website stop after CA$50 in a rolling week for that account.',
      'For a refund of an unauthorized or accidental purchase, email ' + LEGAL_CONTACT_EMAIL + ' within 14 days if those coins are unspent. Include the account email and the date.',
    ],
  },
  {
    id: 'contact',
    title: 'Company',
    paragraphs: [
      LEGAL_COMPANY + ' makes Roman’s Game. The company site is ' + LEGAL_COMPANY_URL + '.',
      'Contact email (draft, confirm before publishing): ' + LEGAL_CONTACT_EMAIL + '.',
    ],
  },
]
