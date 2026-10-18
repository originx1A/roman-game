/**
 * In-game legal text for Roman's Game.
 * Wording follows the Oct 18, 2026 Funderwood policies.
 * Address, phone, and email are the single placeholders in businessIdentity.ts.
 */
import {
  BRAND_SITE_URL,
  BUSINESS_ADDRESS,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CONTACT_EMAIL,
  GST_HST,
  ONTARIO_BIN,
  PRIVACY_VERSION,
  PURCHASE_TERMS_VERSION,
  SELLER_AS,
  SELLER_NAME,
  TERMS_VERSION,
} from './businessIdentity'

export {
  BRAND_SITE_URL,
  BUSINESS_ADDRESS,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  CONTACT_EMAIL,
  GST_HST,
  ONTARIO_BIN,
  PRIVACY_VERSION,
  PURCHASE_TERMS_VERSION,
  SELLER_AS,
  SELLER_NAME,
  TERMS_VERSION,
}

export const SHARED_PRIVACY_URL = 'https://romansgame.com/privacy'
export const SHARED_TERMS_URL = 'https://romansgame.com/terms'
export const PURCHASE_AGREE = 'By buying you agree to the Terms of Purchase and Refund Policy.'

/** Exact sign-up checkbox from the shared consent text. */
export const SIGNUP_AGREE = 'I agree to the Terms of Use and Privacy Policy.'
export const SIGNUP_AGREE_GUARDIAN =
  "I'm this child's parent or legal guardian. I agree to the Terms of Use and Privacy Policy for them, and I consent to jrny.fun collecting and using my child's game progress, preset nickname and purchase history as described in the Privacy Policy."

export const SIGNUP_NEWS = "Also send me Roman's Game news, stories and offers from jrny.fun. I can unsubscribe anytime."
export const SIGNUP_CHILD_NOTE = 'Ask a parent to set up your account. You can keep playing as a guest. Your progress stays on this device.'
export const SIGNUP_ACCOUNT_NOTE = "One account works on romansgame.com and play.romansgame.com. Your leaderboard name is public. Don't use your full real name."
export const SIGNUP_PARENT_NOTE = "We'll email you to confirm, and again a day later so you can cancel if this wasn't you. You can review or delete your child's information anytime."

export const PRESET_NICKNAMES = [
  'Brave Owl',
  'Quiet Fox',
  'Swift Hare',
  'Kind Bear',
  'Bright Wren',
  'Calm Turtle',
  'Bold Lynx',
  'Sunny Finch',
  'Steady Elk',
  'Nimble Mouse',
  'Gentle Deer',
  'Lucky Newt',
  'Patient Heron',
  'Merry Squirrel',
  'Silver Minnow',
  'Amber Beetle',
  'Cozy Mole',
  'River Otter',
  'Little Badger',
  'Starling 7',
  'Pebble 12',
  'Clover 3',
  'Nimbus 9',
  'Thistle 5',
] as const

export function signupAgreeLabel(under13: boolean): string {
  return under13 ? SIGNUP_AGREE_GUARDIAN : SIGNUP_AGREE
}

export function nicknameAllowed(name: string, guardian: boolean): boolean {
  const clean = name.trim()
  if (!clean) return false
  if (!guardian) return true
  return (PRESET_NICKNAMES as readonly string[]).includes(clean)
}

export type ConsentType = 'terms_privacy_13plus' | 'terms_privacy_parent'

export interface PolicyConsentRecord {
  privacyVersion: string
  termsVersion: string
  consentedAt: string
  guardian: boolean
  consentType: ConsentType
  nickname?: string
}

export function policyConsentRecord(nowMs: number, guardian: boolean, nickname?: string): PolicyConsentRecord {
  const row: PolicyConsentRecord = {
    privacyVersion: PRIVACY_VERSION,
    termsVersion: TERMS_VERSION,
    consentedAt: new Date(nowMs).toISOString(),
    guardian,
    consentType: guardian ? 'terms_privacy_parent' : 'terms_privacy_13plus',
  }
  if (nickname) row.nickname = nickname
  return row
}

export function purchaseConsentRecord(nowMs: number): { purchaseTermsVersion: string; consentedAt: string } {
  return { purchaseTermsVersion: PURCHASE_TERMS_VERSION, consentedAt: new Date(nowMs).toISOString() }
}

const PURCHASE_CONSENT_KEY = 'roman.purchaseConsent.v1'

/** Device copy of the Terms of Purchase version accepted at checkout. */
export function rememberPurchaseConsent(nowMs: number): { purchaseTermsVersion: string; consentedAt: string } {
  const row = purchaseConsentRecord(nowMs)
  try {
    localStorage.setItem(PURCHASE_CONSENT_KEY, JSON.stringify(row))
  } catch {
    /* private mode: the confirmation still shows the version in the policy text */
  }
  return row
}

export function consentAllowsAccount(consent: { age13: boolean; policy?: PolicyConsentRecord | null }): boolean {
  const policy = consent.policy
  if (!policy || policy.privacyVersion !== PRIVACY_VERSION || policy.termsVersion !== TERMS_VERSION) return false
  if (!Number.isFinite(Date.parse(policy.consentedAt))) return false
  if (!consent.age13 && !policy.guardian) return false
  if (policy.guardian && !nicknameAllowed(policy.nickname ?? '', true)) return false
  return true
}

export function parseStoredConsent(raw: unknown): { age13: boolean; optIn: boolean; policy?: PolicyConsentRecord } | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.age13 !== 'boolean') return null
  const policy = parsePolicy(row.policy)
  return policy ? { age13: row.age13, optIn: !!row.optIn, policy } : { age13: row.age13, optIn: !!row.optIn }
}

function parsePolicy(raw: unknown): PolicyConsentRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const row = raw as Record<string, unknown>
  if (typeof row.privacyVersion !== 'string' || typeof row.termsVersion !== 'string') return undefined
  if (typeof row.consentedAt !== 'string' || !Number.isFinite(Date.parse(row.consentedAt))) return undefined
  const guardian = row.guardian === true
  const consentType: ConsentType = guardian ? 'terms_privacy_parent' : 'terms_privacy_13plus'
  const nickname = typeof row.nickname === 'string' ? row.nickname : undefined
  return { privacyVersion: row.privacyVersion, termsVersion: row.termsVersion, consentedAt: row.consentedAt, guardian, consentType, nickname }
}

export type LegalSection = 'use' | 'terms' | 'refunds' | 'privacy' | 'parents' | 'contact'

export interface LegalChunk {
  id?: string
  heading?: string
  paragraphs?: string[]
  items?: string[]
}

export interface LegalBlock {
  id: LegalSection
  title: string
  version?: string
  chunks: LegalChunk[]
}

const sellerContact = `${SELLER_AS} · ${BUSINESS_ADDRESS}, Canada · ${CONTACT_EMAIL} · ${BUSINESS_PHONE}`

export const LEGAL_BLOCKS: readonly LegalBlock[] = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    version: PRIVACY_VERSION,
    chunks: [
      {
        paragraphs: [
          `Privacy Policy: Roman's Game (romansgame.com and play.romansgame.com). Version ${PRIVACY_VERSION}. Effective: [DATE PUBLISHED].`,
          'This policy explains what information we collect on romansgame.com (the story site) and play.romansgame.com (the game), and what we do with it. One account works on both sites, so this one policy covers both.',
          `Who we are: ${SELLER_AS} ("we", "us"), ${BUSINESS_ADDRESS}, Canada. Email: ${CONTACT_EMAIL}. Phone: ${BUSINESS_PHONE}.`,
          `Person in charge of privacy: [NAME], [TITLE, e.g. Owner & Privacy Officer], ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'The short version',
        items: [
          'You can play the game and read the site without an account.',
          'If you make an account, we keep your email, your leaderboard name and your game progress, so your saves follow you.',
          'Kids under 13 can only have an account that a parent or guardian creates and controls.',
          'Payments are handled by Stripe. We never see or store your card number.',
          'We use Google Analytics to count visits, with ads and cross-site tracking features turned off. You can switch it off.',
          'We never sell your information and we show no ads.',
        ],
      },
      {
        heading: '1. What we collect',
        paragraphs: ['Everyone (no account):'],
        items: [
          'Game progress, settings, coins and scores (guest mode). Why: so the game remembers you on this device. Where: your browser\'s local storage. It isn\'t sent to us unless you sign in.',
          'Analytics: pages viewed, game events (level cleared, board size, time), device and browser type, rough location (city/region/country) from your IP address, a random cookie ID. Why: to see what works and fix what doesn\'t. Where: Google Analytics (Google LLC, US). We don\'t send names, emails or account IDs to Google.',
          'Anonymous play counts in the game (a random number made on your device, game events, rough place, time). Why: game balancing. Where: our game server. No name, email or exact location. You can turn it off in Save & settings.',
          'Messages you send us (support form or email): name, email, message. Why: to answer you. Where: our email/support inbox.',
        ],
      },
      {
        paragraphs: ['If you make an account (one account for both sites):'],
        items: [
          'Email address (the parent\'s email for under-13 accounts). Why: to send sign-in links (no passwords) and account notices.',
          'Leaderboard name. Shown publicly on leaderboards. Under-13 profiles pick from a preset list of fun names, so no real names.',
          'Age confirmation (13+, or parent-created) and your consent record (date, time, policy version). Why: to follow privacy laws for kids and keep proof of consent.',
          'Game progress: scores, coins, cards, buddies, badges, stories read, reading position, video progress. Why: to keep your saves on any device.',
          'Purchase history: what you bought, when, the amount, the Stripe payment ID. Why: to deliver what you paid for, handle refunds and keep tax records.',
          'Purchase PIN, stored only as a scrambled (hashed) value. Why: so only the grown-up can approve purchases.',
        ],
      },
      {
        paragraphs: [
          'If you buy something: Stripe collects your name, card or wallet details (Apple Pay / Google Pay), billing address or postal code, and email to process the payment. Stripe also checks for fraud. We don\'t receive your full card number. We receive the payment status, the amount, the currency, the country/province (for sales tax) and the last 4 digits and brand of the card for receipts. For physical items, we also get your shipping address.',
          'If you join the newsletter: your email address, the date and time you signed up, and which form you used. The newsletter is sent with Kit (Kit, US). Signing up is always a separate choice. It\'s never pre-ticked, and it isn\'t part of making an account.',
          'Browser notifications (romansgame.com, optional): if you allow notifications, your browser gives us a push-subscription ID and we store your notification choices.',
          'We do not collect: passwords, photos, voice recordings, contacts, precise location, or government ID. The game never uses your microphone. Roman\'s voice is played from audio files and your device\'s built-in speech.',
        ],
      },
      {
        heading: '2. How we use it',
        items: [
          'To run the game and site, keep your saves, and show leaderboards.',
          'To send sign-in links and important account or purchase emails.',
          'To process purchases, deliver items, give refunds, and keep the tax records the law requires.',
          'To protect accounts and stop cheating or fraud.',
          'To improve the game, using totals and trends from analytics.',
          'To send the newsletter, only if you opted in.',
        ],
        paragraphs: ['We don\'t use your information for ads, and we don\'t build advertising profiles. We don\'t use children\'s information for marketing.'],
      },
      {
        heading: '3. Who we share it with',
        paragraphs: ['We only share information with service providers who help us run things. They may only use it to provide their service to us.'],
        items: [
          'Supabase: accounts, sign-in, cloud saves, leaderboard. Location: [REGION, e.g. US/Canada].',
          'Resend: sending sign-in emails. Location: US.',
          'Stripe: payments, fraud checks, receipts, tax calculation. Location: US / Canada.',
          'Apple Pay / Google Pay (through Stripe): wallet payments, if you choose them. Location: US.',
          'Google Analytics: visit and game statistics. Location: US.',
          'Kit: newsletter (opt-in only). Location: US.',
          '[HOSTING PROVIDER, e.g. Cloudflare / Netlify / Vercel]: hosting the sites. Location: [LOCATION].',
          'YouTube (Google): videos embedded on romansgame.com. YouTube may set its own cookies when you press play. Location: US.',
          '[SHIPPING CARRIER]: only if you buy a physical item. Location: [LOCATION].',
        ],
      },
      {
        paragraphs: [
          'Your information may be stored and processed outside Canada (mainly in the United States). There, it may be accessible to courts and authorities under local law. We may also share information if the law requires it, or to protect someone\'s safety. If the business is ever sold, your information would move to the new owner under this same policy, and we\'d tell you first.',
          'We never sell or rent personal information, and we don\'t "share" it for cross-context behavioural advertising (as California law uses that word).',
        ],
      },
      {
        heading: '4. Children and parents',
        items: [
          'Roman\'s Game is made for everyone, including kids. Kids can play as guests with nothing sent to us except the anonymous analytics described above.',
          'Under 13: only a parent or guardian can create an account, using their own email. We ask the parent to confirm with a follow-up email or a card payment, as US COPPA requires. Kids pick a leaderboard name from a preset list. We don\'t collect a child\'s email, real name, photo or location.',
          `Parents can, at any time: see what we've stored about their child, correct it, delete it, or refuse further collection while still letting the child play as a guest. Email ${CONTACT_EMAIL} or use Account → Delete account. We'll confirm we're talking to the parent before acting.`,
          'Purchases need a signed-in grown-up, a purchase PIN, and payment through Stripe (with Face ID / fingerprint on phones using Apple Pay or Google Pay).',
          'If we learn we collected a child\'s information without a parent\'s consent, we delete it.',
        ],
        paragraphs: ['See our Parents\' page for a plain-English guide.'],
      },
      {
        heading: '5. Cookies and analytics',
        paragraphs: [
          'We use necessary storage (sign-in, saves, settings, cart). We use Google Analytics cookies, with Google signals and ad personalization turned off.',
          'To turn analytics off: in the game, Save & settings → Analytics. On romansgame.com, the cookie settings link in the footer. Anywhere: Google\'s opt-out add-on at https://tools.google.com/dlpage/gaoptout.',
          'Do Not Track: browsers\' "Do Not Track" signals aren\'t a standard, so we don\'t respond to them.',
        ],
      },
      {
        heading: '6. How long we keep things',
        items: [
          'Account and game progress: until you delete your account, or after 24 months with no sign-in (we email a warning first).',
          'Guest saves: on your device until you clear it.',
          'Analytics: 14 months, then deleted by Google.',
          'Purchase and tax records: 6 years (Canadian tax law).',
          'Consent records: life of the account + 3 years.',
          'Support messages: 2 years.',
          'Newsletter: until you unsubscribe. We then keep your email on a "do not email" list.',
        ],
      },
      {
        heading: '7. Your rights',
        paragraphs: [
          `Wherever you live, you can ask us to see the personal information we hold about you, correct it, delete it, or withdraw consent, such as unsubscribing or turning off analytics. Email ${CONTACT_EMAIL}. We answer within 30 days.`,
          'Canada: if you\'re not happy with our answer, you can complain to the Office of the Privacy Commissioner of Canada (https://www.priv.gc.ca).',
          'Quebec: you can also contact the Commission d\'accès à l\'information (https://www.cai.gouv.qc.ca). You have the right to know about and correct your data, and to ask that data stop being shared.',
          'United States: you can make the same requests, including under state privacy laws where they apply. We don\'t sell or share data for targeted ads, so there\'s nothing to opt out of, but you can still ask.',
          'Parents have the extra rights in section 4.',
        ],
      },
      {
        heading: '8. Keeping it safe',
        items: [
          'Sign-in uses one-time email links, not passwords.',
          'Our service accounts use two-step verification.',
          'Database access is locked down so each player can only see their own data.',
          'Payments run on Stripe\'s PCI-certified pages.',
        ],
        paragraphs: ['No system is perfect. If a breach creates a real risk of harm to you, we\'ll tell you and the Privacy Commissioner as the law requires.'],
      },
      {
        heading: '9. Changes',
        paragraphs: ['If we change this policy, we\'ll update the version and date above. For important changes, we\'ll show a notice and ask again where the law requires (for example, a parent\'s new consent for a child\'s account).'],
      },
      {
        heading: '10. Contact',
        paragraphs: [sellerContact],
      },
    ],
  },
  {
    id: 'use',
    title: 'Terms of Use',
    version: TERMS_VERSION,
    chunks: [
      {
        paragraphs: [
          `Terms of Use: Roman's Game (romansgame.com and play.romansgame.com). Version ${TERMS_VERSION}. Effective: [DATE PUBLISHED].`,
          `These terms are the rules for using romansgame.com and play.romansgame.com (together, "Roman's Game"). The sites are run by ${SELLER_AS}, ${BUSINESS_ADDRESS}, Canada ("we", "us"). By using the sites, you agree to these terms and to our Privacy Policy. If you're under the age of majority where you live (18 or 19 in most of Canada, 18 in most US states), please read these terms with a parent or guardian. They agree on your behalf.`,
          'Buying something has extra terms. In the game: Terms of Purchase. On romansgame.com: Terms of Sale.',
        ],
      },
      {
        heading: '1. Free to play, with optional purchases',
        paragraphs: ['Reading the site and playing the game are free. Some extras cost money: in-game coin packs and items in the game, and books, audiobooks, music and other products on romansgame.com. You never have to buy anything to play.'],
      },
      {
        heading: '2. One account for both sites',
        items: [
          'An account is optional. One account works on both romansgame.com and play.romansgame.com.',
          '13 and older can make their own account. Under 13: a parent or guardian must create the account with their own email and is responsible for it.',
          'Keep access to your email safe. Sign-in links go there, and anyone who can open your email can open your account.',
          'One person per account, please. Don\'t make accounts to cheat leaderboards or farm free rewards.',
          'You can delete your account any time in Account → Delete account.',
        ],
      },
      {
        heading: '3. Leaderboards and names',
        paragraphs: ['Leaderboard names are public. Please don\'t use your full real name, a phone number, an email, rude words, or anything hateful or that pretends to be someone else. Under-13 profiles choose from preset names. We may rename, hide or remove names and scores that break these rules, or scores that look like cheating.'],
      },
      {
        heading: '4. Play fair',
        paragraphs: ['Don\'t hack, cheat, use bots, or tamper with the game, its saves, coins or leaderboards. Don\'t try to get purchases or rewards without paying or earning them. Don\'t overload, scrape at abusive volumes, or attack the sites. Don\'t copy the game or our content to sell or publish as your own. Don\'t pretend to be us or to work with us.', 'We may pause or close accounts that break these rules. If we close an account for cheating or fraud, unused coins and items may be lost (see Terms of Purchase).'],
      },
      {
        heading: '5. Our content',
        paragraphs: [
          'The game, characters (including Roman, Lupa, Aquila, Leo, Invictus, Nox and the Unseen), stories, art, music, videos and names are owned by us or our licensors and protected by copyright and trademark law. You can share links, screenshots and short clips for personal, non-commercial use, with credit to "Roman\'s Game by Funderwood" (or "Roman\'s Game / jrny.fun"), and use wallpapers on your own devices.',
          `Anything else, including commercial use, merch or AI training, needs our written permission: ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: '6. Your feedback',
        paragraphs: ['If you send ideas or feedback, we may use them to improve Roman\'s Game without owing you anything. We\'ll never publish your name with it without asking.'],
      },
      {
        heading: '7. Other websites',
        paragraphs: ['We link to sites like YouTube, Instagram, Facebook, Pinterest, Bandcamp and Amazon. Those sites have their own terms and privacy rules, and purchases there are between you and that store. See our External Links & Affiliate Disclosure.'],
      },
      {
        heading: '8. Changes and availability',
        paragraphs: ['We keep improving the game, so modes, rewards, prices and features may change, and we may pause or end the game or a feature. If we ever shut down paid features, we\'ll give at least 30 days\' notice where possible. Our Terms of Purchase explain what happens to unused paid items.'],
      },
      {
        heading: '9. No warranty',
        paragraphs: ['We work hard to keep things running, but the sites are provided "as is" and "as available". We can\'t promise they\'ll always be online, error-free or keep every save forever. Guest saves live on your device and can be lost if browser data is cleared. Nothing in these terms takes away rights you have under consumer protection laws that can\'t be waived (including Ontario\'s Consumer Protection Act, 2002, and Quebec\'s Consumer Protection Act).'],
      },
      {
        heading: '10. Limit of liability',
        paragraphs: ['As far as the law allows, we aren\'t liable for indirect or unexpected losses. Our total liability for any claim about the sites is limited to the greater of (a) what you paid us in the 12 months before the claim, or (b) CA$50. This doesn\'t limit liability that the law doesn\'t allow to be limited, and it doesn\'t apply to Quebec consumers where Quebec law forbids it.'],
      },
      {
        heading: '11. Ending things',
        paragraphs: ['You can stop using the sites and delete your account any time. We may suspend or end access if you seriously or repeatedly break these terms. Sections 5, 9, 10 and 12 continue after that.'],
      },
      {
        heading: '12. Law and disputes',
        paragraphs: [`These terms are governed by the laws of Ontario and the federal laws of Canada that apply there. Consumers in other provinces, territories or countries keep any protections their local law gives them, including the right to bring a claim in their home courts where the law provides it. Please contact us first at ${CONTACT_EMAIL}. Most things can be fixed quickly.`],
      },
      {
        heading: '13. Changes to these terms',
        paragraphs: ['If we change these terms, we\'ll update the version and date above. If a change is important, we\'ll show a notice, and for accounts, ask you to accept again. Changes don\'t apply to purchases already made.'],
      },
      {
        heading: '14. Language',
        paragraphs: ['If these terms are offered in French, the French version is equally official. Quebec consumers must be given the French version first. A French translation is required before selling to Quebec.'],
      },
      {
        paragraphs: [
          `Contact: ${SELLER_AS} · ${BUSINESS_ADDRESS} · ${CONTACT_EMAIL} · ${BUSINESS_PHONE}`,
          `© 2026 ${SELLER_AS}. Roman's Game and jrny.fun are brands of ${BUSINESS_NAME}. All rights reserved.`,
        ],
      },
    ],
  },
  {
    id: 'terms',
    title: 'Terms of Purchase',
    version: PURCHASE_TERMS_VERSION,
    chunks: [
      {
        paragraphs: [
          `Terms of Purchase & Refund Policy: Roman's Game (in-game purchases). Version ${PURCHASE_TERMS_VERSION}. Effective: [DATE PUBLISHED]. These terms apply only to purchases inside the game (play.romansgame.com). Website store purchases use the Terms of Sale.`,
          `Seller: ${SELLER_AS} · ${BUSINESS_ADDRESS}, Canada · Phone ${BUSINESS_PHONE} · ${CONTACT_EMAIL} · GST/HST No. ${GST_HST} · Ontario business name registration BIN ${ONTARIO_BIN}.`,
          'These terms add to our Terms of Use and Privacy Policy. You\'ll see a link to them beside every buy button. Right before you pay, you\'ll be asked to confirm: "By buying you agree to the Terms of Purchase and Refund Policy."',
        ],
      },
      {
        heading: '1. What you can buy',
        paragraphs: ['Coin packs, and items or extras shown in the in-game shop (for example buddies, treats, perk badges and refills). Each offer shows what you get before you pay: the number of coins or the item, and any time limit (for example "perk badge: lasts 24 hours").'],
      },
      {
        heading: '2. Who can buy',
        items: [
          'You must be signed in. Guests can\'t buy, so the buy buttons are faded and say "Sign in to buy".',
          'The account holder must be an adult (the age of majority where they live), or have a parent or guardian\'s permission.',
          'Every purchase needs the account\'s 4-digit purchase PIN. A grown-up sets it at the first purchase. If you share your PIN with someone, purchases they make with it count as yours. Please keep it private.',
          'A forgotten PIN can be reset only through the account\'s verified email. After 5 wrong tries, the PIN locks for [15] minutes.',
          'On phones, Apple Pay or Google Pay ask for Face ID, a fingerprint or the phone\'s passcode.',
          'Weekly spending cap: an account can spend up to CA$50 / US$[40] per 7 days. Purchases above the cap are blocked until the week resets.',
        ],
      },
      {
        heading: '3. Prices, currency and tax',
        items: [
          'Prices are shown in Canadian dollars (CA$) for Canada and US dollars (US$) for the United States. The price on the button is the full price of the item, with no hidden fees.',
          'Sales tax (GST/HST, or PST/QST where it applies; US sales tax where it applies) is calculated by Stripe from your location and shown at checkout before you pay.',
          'Your bank may charge its own foreign-exchange fee if your card is in another currency. We don\'t control or receive that fee.',
        ],
      },
      {
        heading: '4. Paying',
        paragraphs: ['Payments are processed by Stripe on its secure checkout page (cards, Apple Pay, Google Pay). We never see your full card number. You can review and correct your order, or cancel, before you press pay. Coins are added once Stripe confirms the payment. If a payment fails or is cancelled, nothing is charged and nothing is added.'],
      },
      {
        heading: '5. Receipts',
        paragraphs: ['Stripe emails a receipt right away. We also email a confirmation within 15 days at most (usually instantly). It includes the seller details above, what you bought, the price, tax, total, currency, and a link to these terms.'],
      },
      {
        heading: '6. What virtual items are (and aren\'t)',
        items: [
          'Coins and items are a licence to use them in Roman\'s Game. You don\'t own them as property.',
          'They have no cash value, can\'t be exchanged for real money, and can\'t be sold, traded or transferred to another account.',
          'They\'re tied to your signed-in account, so they follow you across devices.',
          'Timed items (like perk badges) end when their timer runs out.',
          'Free coins you earn by playing may be adjusted as we balance the game. Coins you paid for won\'t be reduced by balancing changes.',
        ],
      },
      {
        id: 'refunds',
        heading: '7. Refunds',
        paragraphs: ['We want parents and players to feel safe.'],
        items: [
          `Accidental or unauthorized purchase: ask within 14 days of the purchase. If the coins or item from that purchase haven't been used yet, we'll refund the full amount (including tax) to the original payment method.`,
          'Partly used: we may refund the unused part, at our discretion.',
          'Something went wrong (you were charged but didn\'t get your coins, or got charged twice): we\'ll add what\'s missing or refund you, whenever it happened.',
          `How to ask: email ${CONTACT_EMAIL} with the account email, the date and the amount, or the Stripe receipt. We reply within 3 business days. Refunds usually show up in 5–10 business days.`,
          'When we refund, we remove the coins or items from that purchase.',
          'Please contact us before filing a chargeback with your bank. We can usually fix it faster. Accounts with fraudulent chargebacks may be suspended.',
          'Nothing here limits your rights under consumer protection law. For example, in Ontario you can cancel within 7 days if we failed to give you the required information before you bought.',
        ],
      },
      {
        heading: '8. If the game changes or closes',
        paragraphs: ['If we end paid features or close the game, we\'ll give at least 30 days\' notice where possible. We\'ll refund coin packs bought in the last 30 days that are still unused.'],
      },
      {
        heading: '9. Account closure',
        paragraphs: ['If you delete your account, unused coins and items are lost. Use or refund them first. If we close an account for fraud or serious cheating, unused paid items may be lost, except where the law says otherwise.'],
      },
      {
        heading: '10. Questions',
        paragraphs: [`${CONTACT_EMAIL} · ${BUSINESS_PHONE} · ${SELLER_AS}, ${BUSINESS_ADDRESS}, Canada.`],
      },
    ],
  },
  {
    id: 'parents',
    title: 'Parents',
    chunks: [
      {
        paragraphs: [
          `Roman's Game is a free logic-puzzle game and story world made by ${BUSINESS_NAME} (the small Ontario studio behind jrny.fun). Roman's Game is a brand of ${BUSINESS_NAME}. Here's what you need to know.`,
        ],
      },
      {
        heading: "What's in the game",
        items: [
          'Puzzle boards: place one buddy per row, column and colour region, with no touching.',
          'A cast of animal defenders and Roman. There\'s also a grumpy narrator called the Unseen, who teases the player with mild, silly insults ("That buddy wants a refund").',
          'No chat, no messaging between players, no ads, no user-uploaded photos.',
          'A public leaderboard showing a nickname and score.',
          'Content guide (our own description, not an official rating): cartoon characters, mild comic teasing, optional in-game purchases.',
        ],
      },
      {
        heading: 'Accounts',
        items: [
          'Kids can play everything as a guest. Progress is saved only on that device.',
          '13 and older can make their own account.',
          'Under 13: a parent or guardian creates the account with your email. We send you a confirmation email, then a follow-up a day later, so you can cancel if it wasn\'t you. Kids choose a fun preset nickname, never their real name.',
          'One account works on the game and on romansgame.com.',
        ],
      },
      {
        heading: "Purchases: you're in control",
        items: [
          'Nobody can buy without being signed in. Guests see "Sign in to buy".',
          'Every purchase needs your 4-digit purchase PIN. Keep it private. If you share it, purchases made with it are treated as approved by you.',
          'Phones with Apple Pay or Google Pay also ask for Face ID, a fingerprint or the passcode.',
          'There\'s a weekly limit of CA$50 / US$[40] per account.',
          'Prices are shown in CA$ for Canada and US$ for the US. Tax is added at checkout.',
          `Accidental or unauthorized purchase? If the coins haven't been used, we refund in full within 14 days. Email ${CONTACT_EMAIL}.`,
          'Coins have no cash value and can\'t be traded.',
        ],
      },
      {
        heading: "Your child's information",
        paragraphs: ['We collect as little as possible. Here\'s the list for a child\'s account: your email, a preset nickname, game progress and purchase history, and anonymous analytics that you can switch off in Save & settings.', 'We never collect a child\'s photo, voice, location or contacts. We never sell data or use it for ads.', `You can, at any time, ask to see, correct or delete your child's information, or stop further collection: email ${CONTACT_EMAIL} or use Account → Delete account. See the full Privacy Policy.`],
      },
      {
        heading: 'Tips',
        items: [
          'Turn on reduce motion and adjust sound in Settings.',
          'The newsletter is meant for grown-ups. Please sign up with your own email.',
          `Questions? ${CONTACT_EMAIL} · ${BUSINESS_PHONE}`,
        ],
        paragraphs: [`${SELLER_AS} · ${BUSINESS_ADDRESS}, Canada`],
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact & Business',
    chunks: [
      {
        paragraphs: [
          'Roman\'s Game (romansgame.com and play.romansgame.com) is made and sold by:',
          `${SELLER_NAME}, operating as ${BUSINESS_NAME} (registered Ontario business name, BIN ${ONTARIO_BIN}).`,
          `Roman's Game, jrny.fun and Ringbreeze are brands of ${BUSINESS_NAME}.`,
          BUSINESS_ADDRESS,
          'Canada',
        ],
        items: [
          `Email (general & support): ${CONTACT_EMAIL}`,
          `Refunds: ${CONTACT_EMAIL}`,
          `Privacy questions, data requests and parents: ${CONTACT_EMAIL}, attention [NAME], [TITLE / Privacy Officer]`,
          `Phone: ${BUSINESS_PHONE} ([HOURS, e.g. weekdays 10 am–4 pm Eastern])`,
          `GST/HST registration: ${GST_HST}`,
          `Ontario business name registration: FUNDERWOOD, BIN ${ONTARIO_BIN} (registered Oct 18, 2026)`,
          `Website: ${BRAND_SITE_URL}`,
        ],
      },
      {
        paragraphs: [
          'We usually reply within 2 business days.',
          'You can also use the message form on our Support page.',
          `Copyright or content concerns: email ${CONTACT_EMAIL} with the link and details.`,
        ],
      },
    ],
  },
]

export function legalBlockText(block: LegalBlock): string {
  return block.chunks
    .map((chunk) => [chunk.heading, ...(chunk.paragraphs ?? []), ...(chunk.items ?? [])].filter(Boolean).join(' '))
    .join('\n')
}
