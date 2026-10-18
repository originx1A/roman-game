/**
 * Parent notice for an under-13 account.
 * The privacy policy says we send a confirmation email, then a follow-up a day later,
 * so the parent can cancel if it wasn't them.
 * Sending is gated by ACCOUNT_LEDGER_ENABLED and RESEND_API_KEY. This file does not send.
 */
import { BUSINESS_NAME, CONTACT_EMAIL, SELLER_AS } from './businessIdentity'
import { nicknameAllowed } from './legalCopy'

/** One day, as the policy's "a day later" follow-up. */
export const PARENT_FOLLOW_UP_MS = 24 * 60 * 60 * 1000

export interface ParentNotice {
  userId: string
  /** Cleared once the follow-up is sent, or when the parent cancels. */
  email: string
  nickname: string | null
  createdAt: number
  confirmSentAt: number | null
  followUpSentAt: number | null
  cancelToken: string
  cancelledAt: number | null
  /** True after the flag-gated database delete has removed the account row. */
  databaseDeleted: boolean
}

export type ParentMailKind = 'confirm' | 'followup'

export function followUpAt(createdAt: number): number {
  return createdAt + PARENT_FOLLOW_UP_MS
}

export function safeNickname(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const clean = name.trim()
  return nicknameAllowed(clean, true) ? clean : null
}

/** Confirmation is due as soon as the account exists. The follow-up is due one day later. */
export function dueParentMails(notice: ParentNotice, now: number): ParentMailKind[] {
  if (notice.cancelledAt != null) return []
  const due: ParentMailKind[] = []
  if (notice.confirmSentAt == null && now >= notice.createdAt) due.push('confirm')
  if (notice.followUpSentAt == null && now >= followUpAt(notice.createdAt)) due.push('followup')
  return due
}

export function cancelUrl(origin: string, token: string): string | null {
  if (!/^https?:\/\//.test(origin)) return null
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  return `${origin.replace(/\/$/, '')}/api/parent-notice?cancel=${token}`
}

export function parentMailEnabled(flag: string | undefined, apiKey: string | undefined): boolean {
  return flag === '1' && typeof apiKey === 'string' && apiKey.length > 0
}

export const PARENT_NOTICE_FROM = `Roman's Game <${CONTACT_EMAIL}>`

function nicknameLine(nickname: string | null): string {
  return nickname ? `The leaderboard nickname is ${nickname}.` : ''
}

/** Confirmation sent when the parent creates the account. */
export function parentConfirmLetter(nickname: string | null, cancelLink: string): { subject: string; text: string } {
  const nick = nicknameLine(nickname)
  const text = [
    "We send you a confirmation email, then a follow-up a day later, so you can cancel if it wasn't you.",
    'This is that confirmation. You created a Roman\'s Game account for a child under 13 with this email. The follow-up comes a day later.',
    nick,
    `Cancel now if this wasn't you:\n${cancelLink}`,
    `You can also use Account → Delete account in the game, or email ${CONTACT_EMAIL}.`,
    `Roman's Game is a brand of ${BUSINESS_NAME} (${SELLER_AS}).`,
  ].filter(Boolean).join('\n\n')
  return { subject: "Confirming the Roman's Game account you created", text }
}

/** Follow-up sent one day after the account was created. */
export function parentFollowUpLetter(cancelLink: string): { subject: string; text: string } {
  const text = [
    "This is the follow-up a day later, so you can cancel if it wasn't you.",
    "If you created this account, you don't need to do anything.",
    `Cancel the account:\n${cancelLink}`,
    `You can also use Account → Delete account in the game, or email ${CONTACT_EMAIL}.`,
    `Roman's Game is a brand of ${BUSINESS_NAME} (${SELLER_AS}).`,
  ].join('\n\n')
  return { subject: "A day later: the Roman's Game account you created", text }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Plain-text letter as HTML, with the cancel link as a link. */
export function parentNoticeHtml(text: string, cancelLink: string): string {
  const safeLink = escapeHtml(cancelLink)
  const body = text.split('\n\n').map((part) => {
    const safe = escapeHtml(part).replace(/\n/g, '<br>')
    if (!part.includes(cancelLink)) return `<p>${safe}</p>`
    return `<p>${safe.replace(safeLink, `<a href="${safeLink}">Cancel this account</a>`)}</p>`
  }).join('\n')
  return `<!DOCTYPE html><html lang="en"><body>${body}</body></html>`
}

export type ParentCancelState = 'missing' | 'deleted' | 'kept-row' | 'error'

export function parentCancelPage(state: ParentCancelState): string {
  const copy = state === 'missing'
    ? { title: 'Link not used', paragraph: "This link doesn't match an account." }
    : state === 'deleted'
      ? {
          title: 'Account deleted',
          paragraph: `The account is deleted. Purchase and tax records are kept for 6 years, without the name or email. A consent record with no name or email is kept for 3 years. Questions: ${CONTACT_EMAIL}.`,
        }
      : state === 'error'
        ? { title: 'Try again', paragraph: "We couldn't check this link. Try again in a minute." }
        : {
            title: 'Cancellation saved',
            paragraph: `The purchase PIN and the email on this notice are removed. The account row on the server stays until deletion is turned on there. Purchase and tax records are kept for 6 years. Questions: ${CONTACT_EMAIL}.`,
          }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${escapeHtml(copy.title)}</title></head><body><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.paragraph)}</p></body></html>`
}

export async function sendParentMail(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html: string
  fetchImpl?: typeof fetch
}): Promise<boolean> {
  const fetchImpl = args.fetchImpl ?? fetch
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  })
  return res.ok
}
