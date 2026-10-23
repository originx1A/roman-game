import { hashIp, hashUa } from '../lib/authCrypto.ts'
import { json } from '../lib/http.ts'
import { clearOwner, type PaymentEvidence } from '../lib/paymentOwner.ts'
import { requireUser } from '../lib/payGate.ts'

export interface RemoveDeps {
  userId(token: string): Promise<string | null>
  clear(userId: string): Promise<void>
  disablePayments(userId: string): Promise<void>
  record(row: PaymentEvidence): Promise<void>
  detach(userId: string): Promise<void>
}

function bearer(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

/**
 * Takes the card off the signed-in account and returns it to kid mode.
 * Past evidence rows stay. A new verified card can set owner = adult again.
 */
export async function handlePaymentRemove(req: Request, deps: RemoveDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const playerId = await deps.userId(bearer(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)
  const at = new Date().toISOString()
  await deps.detach(playerId).catch(() => undefined)
  await deps.record({
    userId: playerId,
    action: 'detached',
    stripeEventId: null,
    stripePaymentMethodId: null,
    stripeCustomerId: null,
    occurredAt: at,
    deviceUaHash: hashUa(req.headers.get('user-agent') ?? ''),
    deviceUa: (req.headers.get('user-agent') ?? '').slice(0, 180) || null,
    ipHash: hashIp(req.headers.get('x-nf-client-connection-ip') || ''),
  })
  await deps.clear(playerId)
  await deps.disablePayments(playerId)
  return json({ ok: true, owner_role: clearOwner().ownerRole })
}

export default function paymentsRemove(req: Request): Promise<Response> {
  return handlePaymentRemove(req, {
    userId: requireUser,
    async clear(userId) {
      const { ownerAdmin, writeOwner, clearOwner: blank } = await import('../lib/paymentOwner.ts')
      const admin = ownerAdmin()
      if (!admin) throw new Error('owner')
      await writeOwner(admin, userId, blank())
    },
    async disablePayments(userId) {
      const { ownerAdmin, disablePayments: turnOff } = await import('../lib/paymentOwner.ts')
      const admin = ownerAdmin()
      if (!admin) return
      await turnOff(admin, userId)
    },
    async record(row) {
      const { ownerAdmin, addEvidence } = await import('../lib/paymentOwner.ts')
      const admin = ownerAdmin()
      if (!admin) return
      await addEvidence(admin, row)
    },
    async detach(userId) {
      const { ownerAdmin } = await import('../lib/paymentOwner.ts')
      const { readStripeKey, stripeClient, isLiveStripeKey } = await import('../lib/stripeServer.ts')
      const { CHECKOUT_TEST_ONLY } = await import('../lib/coinPacks.ts')
      const admin = ownerAdmin()
      const key = readStripeKey()
      if (!admin || !key || (CHECKOUT_TEST_ONLY && isLiveStripeKey(key))) return
      const { data } = await admin
        .from('payment_evidence')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .not('stripe_customer_id', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(1)
      const customer = Array.isArray(data) && data[0] && typeof (data[0] as { stripe_customer_id?: unknown }).stripe_customer_id === 'string'
        ? (data[0] as { stripe_customer_id: string }).stripe_customer_id
        : ''
      if (!customer) return
      const stripe = stripeClient(key)
      const list = await stripe.paymentMethods.list({ customer, type: 'card', limit: 10 })
      for (const method of list.data) {
        await stripe.paymentMethods.detach(method.id)
      }
    },
  })
}
