import { SUPPORT_EMAIL, TERMS_VERSION } from '../../../src/game/catalog.ts'

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
}

const FROM = `Roman's Game <${SUPPORT_EMAIL}>`

export function verificationMail(origin: string, to: string, token: string): Mail {
  const link = `${origin}/verify-email?token=${encodeURIComponent(token)}`
  return {
    to,
    subject: 'Is this your email?',
    text: `Tap this link to confirm your email for Roman's Game: ${link}\nIf you did not ask, ignore this email.\nRoman's Game · Terms of Use ${origin}/legal/terms · Privacy Policy ${origin}/legal/privacy`,
    html: wrap(
      `<h1>Is this your email?</h1><p>Tap the button to confirm this address for Roman's Game. Receipts and reset links will come here.</p><p><a class="btn" href="${link}">Confirm my email</a></p><p>If you did not ask, ignore this email. Nothing changes.</p>`,
      origin,
    ),
  }
}

export function resetMail(origin: string, to: string, name: string, token: string): Mail {
  const link = `${origin}/reset/${encodeURIComponent(token)}`
  return {
    to,
    subject: "Reset your Roman's Game password",
    text: `Someone asked to reset the password for ${name}. If that was you, open ${link} and choose a new password. This link works once. If you did not ask, ignore this email and nothing changes.`,
    html: wrap(
      `<h1>Reset your password</h1><p>Someone asked to reset the password for the player <b>${escapeHtml(name)}</b>. If that was you, tap the button and choose a new password.</p><p><a class="btn" href="${link}">Choose a new password</a></p><p>This link works once. If you did not ask for this, ignore this email and nothing changes.</p>`,
      origin,
    ),
  }
}

export function approvalMail(origin: string, to: string, playerName: string, token: string): Mail {
  const link = `${origin}/approve/${encodeURIComponent(token)}`
  const no = `${origin}/approve/${encodeURIComponent(token)}?answer=no`
  return {
    to,
    subject: `Can you say yes for ${playerName}?`,
    text: `${playerName} asked you to be the account holder for cash buying on Roman's Game. Read what we keep and why, then approve or don't: ${link}\nThis is not for me: ${no}\nIf you do nothing, nothing happens. The request expires after 7 days.`,
    html: wrap(
      `<h1>Can you say yes?</h1><p><b>${escapeHtml(playerName)}</b> asked you to be the account holder so cash buying can be turned on. Playing stays free either way.</p><p>We keep the player name, the password hash, and this link to your email so you can reset the password and stop buying. We do not show your email on a board.</p><p><a class="btn" href="${link}">Approve</a></p><p><a href="${no}">This is not for me</a></p><p>If you do nothing, nothing happens. One reminder after 3 days. The request expires after 7 days.</p>`,
      origin,
    ),
  }
}

export function reminderMail(origin: string, to: string, playerName: string, token: string): Mail {
  const link = `${origin}/approve/${encodeURIComponent(token)}`
  return {
    to,
    subject: 'Still need your yes',
    text: `${playerName} is still waiting. Approve or don't: ${link}`,
    html: wrap(
      `<h1>Still need your yes</h1><p><b>${escapeHtml(playerName)}</b> is still waiting. Playing and free coins work either way.</p><p><a class="btn" href="${link}">Approve</a></p>`,
      origin,
    ),
  }
}

export function receiptMail(input: {
  origin: string
  to: string
  item: string
  price: string
  when: string
  wasnt: string
}): Mail {
  const { origin, to, item, price, when, wasnt } = input
  const stop = `${origin}/wasnt-me/${encodeURIComponent(wasnt)}`
  return {
    to,
    subject: "Thanks for your purchase",
    text: `Thanks for your purchase. ${item}. ${price}. ${when}. Seller: Funderwood. Refunds: no refund for a purchase you authorised. Coins have no cash value. Terms of Use version ${TERMS_VERSION}. Wasn't me (stops buying, not a refund): ${stop}`,
    html: wrap(
      `<h1>Thanks for your purchase</h1><p>${escapeHtml(item)}<br>${escapeHtml(price)}<br>${escapeHtml(when)}</p><p>Seller: Funderwood · ${SUPPORT_EMAIL}<br>Business address: to be confirmed.</p><p>Refunds: there is no refund for a purchase you authorised. Coins have no cash value and cannot be transferred. Terms of Use version ${TERMS_VERSION}.</p><p><a class="btn" href="${stop}">Wasn't me: stop buying</a></p><p>This stops more buying. It is not a refund and it is not a sign-in.</p>`,
      origin,
    ),
  }
}

export async function sendMail(apiKey: string | undefined, mail: Mail, saveDev: (mail: Mail) => Promise<void>): Promise<{ ok: boolean; dev?: boolean }> {
  if (!apiKey) {
    await saveDev(mail)
    return { ok: true, dev: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  })
  return { ok: res.ok }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)
}

function wrap(body: string, origin: string): string {
  return `<div style="font-family:Nunito,Segoe UI,sans-serif;color:#1b2440;max-width:520px">${body}<p style="font-size:12px;color:#68739a">Roman's Game · <a href="${origin}/legal/terms">Terms of Use</a> · <a href="${origin}/legal/privacy">Privacy Policy</a> · <a href="${origin}/help/contact">Contact</a></p></div>`
}
