/**
 * Welcome letter. Tony may edit the draft constants.
 * Kit's free plan has broadcasts, not a one-recipient send: sequences and
 * visual automations are paid. This letter is sent with Resend instead.
 * Kit broadcasts keep Kit's own unsubscribe and address footer.
 */

export const WELCOME_SUBJECT = "Welcome to Roman's World News!"
export const WELCOME_PREVIEW = 'Your first story arrives with the next morning edition.'
export const WELCOME_BODY =
  "Hi there, and welcome to Roman's World! Thanks for joining Roman's World News. Here's what's coming your way: a new Roman's World News story every morning, fresh from the realm; lore and secrets about the heroes, kingdoms and creatures of Roman's Game; first word on new audiobooks, music and game updates. Can't wait? Catch up on past stories at https://romansgame.com/news/ or jump into the free game at https://play.romansgame.com. A note for parents: if your child is under 13, please make sure a parent or guardian signs up for them and reads along. Questions or ideas? Just reply or write to support@romansgame.com. We read every message. See you in the realm, The Roman's Game team."

export const NEWS_FROM = "Roman's World News <support@romansgame.com>"
export const SUPPORT_EMAIL = 'support@romansgame.com'
export const WELCOME_TAG = 'welcome-sent'

export interface WelcomeDelivery {
  from: string
  to: string
  subject: string
  text: string
  html: string
  headers: Record<string, string>
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkify(text: string): string {
  return text
    .split(/(https:\/\/[^\s]+)/g)
    .map((part) => (part.startsWith('https://') ? `<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>` : escapeHtml(part)))
    .join('')
}

/** Draft body plus a one-click unsubscribe and the postal line required by CASL and CAN-SPAM. */
export function buildWelcomeDelivery(opts: { to: string; unsubscribeUrl: string; postalAddress: string }): WelcomeDelivery {
  const address = opts.postalAddress.trim()
  const text = [
    WELCOME_BODY,
    '',
    `Unsubscribe: ${opts.unsubscribeUrl}`,
    `Mailing address: ${address}`,
  ].join('\n')
  const html = [
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(WELCOME_PREVIEW)}</div>`,
    `<p>${linkify(WELCOME_BODY)}</p>`,
    `<p><a href="${escapeHtml(opts.unsubscribeUrl)}">Unsubscribe</a></p>`,
    `<p>Mailing address: ${escapeHtml(address)}</p>`,
  ].join('\n')
  return {
    from: NEWS_FROM,
    to: opts.to,
    subject: WELCOME_SUBJECT,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${opts.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
