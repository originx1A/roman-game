/** Resend send. Same endpoint the parent-notice mail uses. Never logs the API key. */

export interface ResendMessage {
  from: string
  to: string
  subject: string
  text: string
  html: string
  headers?: Record<string, string>
}

export async function sendResend(apiKey: string, message: ResendMessage, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; status: number }> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: message.headers,
    }),
  })
  return { ok: res.ok, status: res.status }
}
