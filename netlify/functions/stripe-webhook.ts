import { CHECKOUT_TEST_ONLY } from '../lib/coinPacks.ts'
import { grantCheckout, revokeCharge, type CompletedSession, type Ledger } from '../lib/accountsLedger.ts'
import { json } from '../lib/http.ts'
import { isLiveStripeKey, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'
import { supabaseLedger } from '../lib/supabaseLedger.ts'

export interface InboundEvent {
  id: string
  type: string
  livemode: boolean
  session?: CompletedSession
  charge?: { id: string; payment_intent: string | null; livemode: boolean }
}

interface WebhookDeps {
  secret: string | null
  testOnly: boolean
  readKey(): string | null
  isLive(key: string): boolean
  construct(raw: string, signature: string, secret: string): InboundEvent
  ledger(): Ledger | null
}

function asId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

function mapStripeEvent(event: { id: string; type: string; livemode: boolean; data: { object: unknown } }): InboundEvent {
  const object = event.data.object as Record<string, unknown>
  if (event.type === 'checkout.session.completed') {
    const metadata = object.metadata && typeof object.metadata === 'object' ? object.metadata as CompletedSession['metadata'] : null
    return {
      id: event.id,
      type: event.type,
      livemode: event.livemode,
      session: {
        id: String(object.id || ''),
        livemode: object.livemode === true,
        payment_status: String(object.payment_status || ''),
        amount_total: typeof object.amount_total === 'number' ? object.amount_total : null,
        currency: typeof object.currency === 'string' ? object.currency : null,
        payment_intent: asId(object.payment_intent),
        metadata,
      },
    }
  }
  return {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    charge: {
      id: String(object.id || ''),
      payment_intent: asId(object.payment_intent),
      livemode: object.livemode === true || event.livemode,
    },
  }
}

const liveDeps = (): WebhookDeps => ({
  secret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
  testOnly: CHECKOUT_TEST_ONLY,
  readKey: readStripeKey,
  isLive: isLiveStripeKey,
  construct(raw, signature, secret) {
    const key = readStripeKey()
    if (!key) throw new Error('no_key')
    const event = stripeClient(key).webhooks.constructEvent(raw, signature, secret)
    return mapStripeEvent(event)
  },
  ledger() {
    const admin = supabaseAdmin()
    return admin ? supabaseLedger(admin) : null
  },
})

/**
 * Stripe webhook. Grants a pack or mints a gift code when checkout completes.
 * Revokes the pack or voids the code on refund or dispute.
 * Test mode ignores live events. The signing secret is never logged.
 */
export async function handleStripeWebhook(req: Request, deps: WebhookDeps = liveDeps()): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const key = deps.readKey()
  if (!key || (deps.testOnly && deps.isLive(key))) return json({ ok: false }, 503)
  if (!deps.secret) return json({ ok: false, error: 'Webhook is not set up yet.' }, 503)
  const signature = req.headers.get('stripe-signature') || ''
  if (!signature) return json({ ok: false }, 400)
  const raw = await req.text()
  let event: InboundEvent
  try {
    event = deps.construct(raw, signature, deps.secret)
  } catch {
    return json({ ok: false }, 400)
  }
  if (event.livemode && deps.testOnly) return json({ ok: true, ignored: 'live' })
  const ledger = deps.ledger()
  if (!ledger) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  try {
    if (await ledger.seenEvent(event.id)) return json({ ok: true, duplicate: true })
    if (event.type === 'checkout.session.completed' && event.session) {
      const result = await grantCheckout(ledger, event.session)
      if (!result.ok) return json({ ok: false }, 400)
      await ledger.markEvent(event.id, event.type)
      return json({ ok: true, ignored: result.ignored, duplicate: result.duplicate === true })
    }
    if ((event.type === 'charge.refunded' || event.type === 'charge.dispute.created') && event.charge) {
      const result = await revokeCharge(ledger, event.charge)
      if (!result.ok && result.error === 'unknown') {
        await ledger.markEvent(event.id, event.type)
        return json({ ok: true, ignored: 'unknown' })
      }
      if (!result.ok) return json({ ok: false }, 400)
      await ledger.markEvent(event.id, event.type)
      return json({ ok: true, duplicate: result.duplicate === true, ignored: result.ignored })
    }
    await ledger.markEvent(event.id, event.type)
    return json({ ok: true, ignored: event.type })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'not_ready') return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
    console.error('stripe-webhook failed', message || 'error')
    return json({ ok: false }, 500)
  }
}

export default function stripeWebhook(req: Request): Promise<Response> {
  return handleStripeWebhook(req)
}
