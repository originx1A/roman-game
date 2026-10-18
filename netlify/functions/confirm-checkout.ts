import { getStore } from '@netlify/blobs'
import { webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE } from '../lib/http.ts'
import { markSpendPaid, writeLedgerCredit } from '../lib/accountMoney.ts'
import { buildPurchaseRecord, PURCHASE_STORE } from '../lib/purchases.ts'
import { packCadCents } from '../../src/game/economy.ts'
import { isCheckoutSessionId, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { userIdFromRequest } from '../lib/supabaseUser.ts'

function formatMoney(cents: number, currency: string): string {
  const dollars = (Math.max(0, cents) / 100).toFixed(2)
  if (currency === 'CAD') return `CA$${dollars}`
  if (currency === 'USD') return `US$${dollars}`
  return `${currency} ${dollars}`
}


/**
 * Looks up the Checkout Session at Stripe. Coins are returned only when Stripe
 * says the payment is paid, and only once per session id.
 * Sessions created for an account must be confirmed by that same account.
 * Older sessions with no account id still credit the device that returns.
 */
export default async function confirmCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = readStripeKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)

  let sessionId: unknown
  try {
    const body = (await req.json()) as { sessionId?: unknown }
    sessionId = body.sessionId
  } catch {
    return json({ error: 'Missing session' }, 400)
  }
  if (!isCheckoutSessionId(sessionId)) return json({ error: 'Missing session' }, 400)

  try {
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return json({ ok: false, reason: 'Payment is not complete. No coins were added.' })
    }

    const pack = webPackById(session.metadata?.packId)
    if (!pack || session.metadata?.productId !== pack.productId) {
      return json({ ok: false, reason: 'That pack is not sold on the website.' })
    }
    if (session.currency !== pack.currency || session.amount_total !== pack.unitAmount) {
      return json({ ok: false, reason: 'Payment did not match this pack. No coins were added.' })
    }

    const accountId = typeof session.metadata?.userId === 'string' ? session.metadata.userId : ''
    if (accountId) {
      const caller = await userIdFromRequest(req)
      if (!caller || caller !== accountId) {
        return json({ ok: false, reason: 'Sign in to finish adding these coins.' }, 401)
      }
    }

    const store = getStore({ name: PURCHASE_STORE, consistency: 'strong' })
    const { modified } = await store.setJSON(
      session.id,
      buildPurchaseRecord(session, pack),
      { onlyIfNew: true },
    )
    if (!modified) {
      return json({ ok: true, alreadyRedeemed: true, coins: 0, label: pack.label, packId: pack.id })
    }
    if (accountId) {
      try {
        await writeLedgerCredit({
          sessionId: session.id,
          userId: accountId,
          packId: pack.id,
          coins: pack.coins,
          at: new Date().toISOString(),
          cadCents: packCadCents(pack.id),
          usdCents: session.amount_total ?? pack.unitAmount,
        })
        await markSpendPaid(accountId, session.id, pack.id)
      } catch (err) {
        console.error('coin ledger write failed', err instanceof Error ? err.message : 'error')
      }
    }
    const amount = session.amount_total
    const currency = (session.currency || pack.currency || 'usd').toUpperCase()
    const taxCents = session.total_details?.amount_tax
    return json({
      ok: true,
      alreadyRedeemed: false,
      coins: pack.coins,
      label: pack.label,
      packId: pack.id,
      total: typeof amount === 'number' ? formatMoney(amount, currency) : undefined,
      tax: typeof taxCents === 'number' ? `Tax: ${formatMoney(taxCents, currency)}` : undefined,
    })
  } catch (err) {
    console.error('confirm-checkout failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}
