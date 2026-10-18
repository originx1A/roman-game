type Env = Record<string, string | undefined>

/** Matches the sender already used for Roman's Game mail. Override with RESEND_FROM or PARENT_NOTICE_FROM. */
export const DEFAULT_AUDIO_FROM = "Roman's Game <support@romansgame.com>"

export function audioFromAddress(env: Env = process.env): string {
  return env.RESEND_FROM?.trim() || env.PARENT_NOTICE_FROM?.trim() || DEFAULT_AUDIO_FROM
}

export function thankYouUrl(base: string, sessionId: string): string {
  return `${base.replace(/\/$/, '')}/store/thanks?session_id=${encodeURIComponent(sessionId)}`
}

/** Plain text only. The buyer link is the thank-you page. No shop links. */
export function thankYouMessage(opts: { title: string; url: string }): { subject: string; text: string } {
  return {
    subject: `Your audiobook: ${opts.title}`,
    text: [
      `Thank you for buying ${opts.title}.`,
      '',
      'Your downloads are on this page. The link works for 48 hours, and each story can be downloaded up to 10 times:',
      opts.url,
      '',
      "Roman's Game",
    ].join('\n'),
  }
}

export async function sendThankYouEmail(opts: {
  to: string
  title: string
  url: string
  env?: Env
  fetchImpl?: typeof fetch
}): Promise<'sent' | 'skipped' | 'failed'> {
  const env = opts.env ?? process.env
  const key = env.RESEND_API_KEY?.trim()
  if (!key || !opts.to.trim()) return 'skipped'
  const message = thankYouMessage({ title: opts.title, url: opts.url })
  const send = opts.fetchImpl ?? fetch
  const res = await send('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: audioFromAddress(env),
      to: [opts.to],
      subject: message.subject,
      text: message.text,
    }),
  })
  return res.ok ? 'sent' : 'failed'
}
