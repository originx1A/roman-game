import Stripe from 'stripe'
import { fulfillPaidSession, markEmailed, normalizeCheckoutSession, type BlobStore } from './audioGrant.ts'
import { siteBase } from './http.ts'
import { sendThankYouEmail, thankYouUrl } from './resendMail.ts'
import { readWebhookSecret } from './stripeServer.ts'

type Env = Record<string, string | undefined>

/**
 * Verifies the Stripe signature, then records an audiobook purchase.
 * Coin-pack sessions and any other event are acknowledged and ignored.
 * A failed email is a 500 so Stripe retries. A missing Resend key is not.
 */
export async function handleAudiobookWebhook(input: {
  payload: string
  signature: string | null
  store: BlobStore
  env?: Env
  now?: number
  fetchImpl?: typeof fetch
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const env = input.env ?? process.env
  const secret = readWebhookSecret(env)
  if (!secret) return { status: 500, body: { error: 'Webhook is not configured.' } }
  if (!input.signature) return { status: 400, body: { error: 'Missing signature.' } }

  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(input.payload, input.signature, secret)
  } catch {
    return { status: 400, body: { error: 'Invalid signature.' } }
  }

  if (event.type !== 'checkout.session.completed') return { status: 200, body: { received: true } }
  const paid = normalizeCheckoutSession(event.data.object)
  if (paid.store !== 'audiobook') return { status: 200, body: { received: true, ignored: true } }

  const grant = await fulfillPaidSession(input.store, paid, input.now)
  if (!grant) {
    console.error('audiobook session not fulfillable', paid.id)
    return { status: 200, body: { received: true, ignored: true } }
  }
  if (grant.emailed || !grant.email) return { status: 200, body: { received: true } }

  const result = await sendThankYouEmail({
    to: grant.email,
    title: grant.title,
    url: thankYouUrl(siteBase(env), grant.sessionId),
    env,
    fetchImpl: input.fetchImpl,
  })
  if (result === 'failed') return { status: 500, body: { error: 'Email failed.' } }
  if (result === 'sent') await markEmailed(input.store, grant.token)
  return { status: 200, body: { received: true, email: result } }
}
