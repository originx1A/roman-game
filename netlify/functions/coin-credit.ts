import { webPackById } from '../lib/coinPacks.ts'
import { json } from '../lib/http.ts'
import { isCheckoutSessionId, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { bearer, supabaseAdmin, supabaseAsUser } from '../lib/supabaseAdmin.ts'

/**
 * Credits a paid Checkout session once, on the server.
 * A webhook records the receipt. The signed-in player claims it.
 * The existing checkout functions are left as they are.
 */
export default async function coinCredit(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Coin credit is not set up yet.' }, 503)

  const raw = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (signature && webhookSecret) {
    const key = readStripeKey()
    if (!key) return json({ ok: false }, 503)
    try {
      const event = stripeClient(key).webhooks.constructEvent(raw, signature, webhookSecret)
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const pack = webPackById(session.metadata?.packId)
        if (session.id && pack && session.payment_status === 'paid') {
          await admin.from('stripe_receipts').upsert({
            session_id: session.id,
            pack_id: pack.id,
            coins: pack.coins,
          })
        }
      }
      return json({ ok: true })
    } catch {
      return json({ ok: false }, 400)
    }
  }

  let sessionId = ''
  try {
    const body = JSON.parse(raw) as { sessionId?: unknown }
    sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  } catch {
    return json({ ok: false, error: 'Missing session' }, 400)
  }
  if (!isCheckoutSessionId(sessionId)) return json({ ok: false, error: 'Missing session' }, 400)

  const token = bearer(req)
  if (!token) return json({ ok: false, error: 'Sign in first.' }, 401)
  const userClient = supabaseAsUser(token)
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  const uid = userData.user?.id
  if (userError || !uid) return json({ ok: false, error: 'Sign in first.' }, 401)

  let coins = 0
  const { data: receipt } = await admin.from('stripe_receipts').select('coins, player_id').eq('session_id', sessionId).maybeSingle()
  if (receipt && typeof receipt.coins === 'number') {
    if (receipt.player_id && receipt.player_id !== uid) return json({ ok: true, duplicate: true })
    coins = receipt.coins
  } else {
    const key = readStripeKey()
    if (!key) return json({ ok: false, error: 'Purchases are unavailable right now.' }, 503)
    const session = await stripeClient(key).checkout.sessions.retrieve(sessionId)
    const pack = webPackById(session.metadata?.packId)
    if (!pack || session.payment_status !== 'paid' || session.metadata?.productId !== pack.productId) {
      return json({ ok: false, error: 'That payment is not ready.' }, 402)
    }
    coins = pack.coins
    await admin.from('stripe_receipts').upsert({ session_id: sessionId, pack_id: pack.id, coins, player_id: uid })
  }

  const { data, error } = await admin.rpc('apply_stripe_credit', { player: uid, op: sessionId, amount: coins })
  if (error) return json({ ok: false }, 502)
  if (!receipt?.player_id) await admin.from('stripe_receipts').update({ player_id: uid }).eq('session_id', sessionId)
  const result = (data ?? {}) as { ok?: boolean }
  return json({ ok: result.ok !== false })
}
