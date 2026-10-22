import { CHECKOUT_TEST_ONLY } from '../lib/coinPacks.ts'
import { grantCheckout, grantLinkedChild, revokeCharge, type CompletedSession, type Ledger } from '../lib/accountsLedger.ts'
import { json } from '../lib/http.ts'
import { noteCardAttached, noteCardDetached, ownerAdmin, userForCustomer, type PaymentEvidence } from '../lib/paymentOwner.ts'
import { isLiveStripeKey, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'
import { supabaseLedger } from '../lib/supabaseLedger.ts'

export interface InboundEvent {
  id: string
  type: string
  livemode: boolean
  session?: CompletedSession
  charge?: { id: string; payment_intent: string | null; livemode: boolean }
  method?: { id: string; customer: string | null; email: string | null }
}

type CardNote = {
  userId: string
  at: string
  email: string | null
  evidence: Omit<PaymentEvidence, 'userId' | 'action' | 'occurredAt'>
}

interface WebhookDeps {
  secret: string | null
  testOnly: boolean
  readKey(): string | null
  isLive(key: string): boolean
  construct(raw: string, signature: string, secret: string): InboundEvent
  ledger(): Ledger | null
  loadCart?: (cartId: string) => Promise<{ giftMode: string | null; giftChildId: string | null; items: { sku: string; qty: number }[] } | null>
  parentLinked?: (parentId: string, childId: string) => Promise<boolean>
  noteAttached?: (input: CardNote) => Promise<void>
  noteDetached?: (input: CardNote & { remaining: number | null }) => Promise<void>
  countCards?: (customerId: string) => Promise<number | null>
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
    const details = object.customer_details && typeof object.customer_details === 'object'
      ? object.customer_details as { email?: unknown }
      : null
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
        mode: typeof object.mode === 'string' ? object.mode : undefined,
        status: typeof object.status === 'string' ? object.status : undefined,
        customer: asId(object.customer),
        customerEmail: typeof details?.email === 'string' ? details.email : null,
        paymentMethod: asId(object.payment_method),
      },
    }
  }
  if (event.type === 'payment_method.attached' || event.type === 'payment_method.detached') {
    const billing = object.billing_details && typeof object.billing_details === 'object'
      ? object.billing_details as { email?: unknown }
      : null
    return {
      id: event.id,
      type: event.type,
      livemode: event.livemode,
      method: {
        id: String(object.id || ''),
        customer: asId(object.customer),
        email: typeof billing?.email === 'string' ? billing.email : null,
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
  async loadCart(cartId) {
    const admin = supabaseAdmin()
    if (!admin) return null
    const { data, error } = await admin.from('carts').select('gift_mode, gift_child_id').eq('id', cartId).maybeSingle()
    if (error || !data) return null
    const cart = data as { gift_mode?: string | null; gift_child_id?: string | null }
    const { data: items, error: itemError } = await admin.from('cart_items').select('sku, qty').eq('cart_id', cartId)
    if (itemError || !Array.isArray(items)) return null
    return {
      giftMode: cart.gift_mode ?? null,
      giftChildId: cart.gift_child_id ?? null,
      items: items.map((item) => {
        const row = item as { sku?: unknown; qty?: unknown }
        return { sku: String(row.sku || ''), qty: typeof row.qty === 'number' ? row.qty : 1 }
      }),
    }
  },
  async parentLinked(parentId, childId) {
    const admin = supabaseAdmin()
    if (!admin) return false
    const { data, error } = await admin
      .from('parent_links')
      .select('id')
      .eq('parent_id', parentId)
      .eq('child_id', childId)
      .eq('status', 'active')
      .limit(1)
    return !error && Array.isArray(data) && data.length > 0
  },
  async noteAttached(input) {
    const admin = ownerAdmin()
    if (!admin) return
    await noteCardAttached(admin, input)
  },
  async noteDetached(input) {
    const admin = ownerAdmin()
    if (!admin) return
    await noteCardDetached(admin, input)
  },
  async countCards(customerId) {
    const key = readStripeKey()
    if (!key) return null
    const list = await stripeClient(key).paymentMethods.list({ customer: customerId, type: 'card', limit: 10 })
    return list.data.length
  },
})

async function grantCart(ledger: Ledger, session: CompletedSession, deps: WebhookDeps) {
  const cartId = session.metadata?.cart_id || ''
  const cart = deps.loadCart ? await deps.loadCart(cartId) : null
  if (!cart) return { ok: false as const, error: 'no_cart' }
  const buyer = session.metadata?.user_id || session.metadata?.playerId || ''
  const child = cart.giftChildId
  const linked = !!(child && deps.parentLinked && await deps.parentLinked(buyer, child))
  return grantLinkedChild(ledger, session, cart, linked)
}

function evidenceFrom(event: InboundEvent, session?: CompletedSession): Omit<PaymentEvidence, 'userId' | 'action' | 'occurredAt'> {
  return {
    stripeEventId: event.id,
    stripePaymentMethodId: session?.paymentMethod || event.method?.id || null,
    stripeCustomerId: session?.customer || event.method?.customer || null,
    deviceUaHash: session?.metadata?.device_ua_hash || null,
    deviceUa: null,
    ipHash: session?.metadata?.ip_hash || null,
  }
}

async function noteSessionOwner(deps: WebhookDeps, event: InboundEvent): Promise<void> {
  const session = event.session
  if (!session || !deps.noteAttached) return
  const paid = session.payment_status === 'paid'
  const setup = session.mode === 'setup' && session.status === 'complete'
  if (!paid && !setup) return
  const userId = session.metadata?.user_id || session.metadata?.playerId || ''
  if (!userId) return
  const email = session.customerEmail && session.customerEmail.length >= 6 && session.customerEmail.length <= 120
    ? session.customerEmail
    : null
  await deps.noteAttached({
    userId,
    at: new Date().toISOString(),
    email,
    evidence: evidenceFrom(event, session),
  })
}

async function noteMethodOwner(deps: WebhookDeps, event: InboundEvent): Promise<void> {
  const method = event.method
  if (!method) return
  const admin = ownerAdmin()
  const userId = method.customer && admin ? await userForCustomer(admin, method.customer) : null
  if (!userId) return
  const email = method.email && method.email.length >= 6 && method.email.length <= 120 ? method.email : null
  const evidence = evidenceFrom(event)
  if (event.type === 'payment_method.detached') {
    const remaining = method.customer && deps.countCards ? await deps.countCards(method.customer).catch(() => null) : null
    if (deps.noteDetached) {
      await deps.noteDetached({ userId, at: new Date().toISOString(), email, remaining, evidence })
    }
    return
  }
  if (deps.noteAttached) {
    await deps.noteAttached({ userId, at: new Date().toISOString(), email, evidence })
  }
}

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
      const setup = event.session.mode === 'setup'
      if (!setup) {
        const cartId = event.session.metadata?.cart_id
        const result = cartId && deps.loadCart
          ? await grantCart(ledger, event.session, deps)
          : await grantCheckout(ledger, event.session)
        if (!result.ok) return json({ ok: false }, 400)
        await noteSessionOwner(deps, event)
        await ledger.markEvent(event.id, event.type)
        return json({ ok: true, ignored: result.ignored, duplicate: result.duplicate === true })
      }
      await noteSessionOwner(deps, event)
      await ledger.markEvent(event.id, event.type)
      return json({ ok: true })
    }
    if ((event.type === 'payment_method.attached' || event.type === 'payment_method.detached') && event.method && deps.noteAttached) {
      await noteMethodOwner(deps, event)
      await ledger.markEvent(event.id, event.type)
      return json({ ok: true })
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
