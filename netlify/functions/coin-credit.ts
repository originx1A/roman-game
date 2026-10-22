import { chargeMatchesPack } from '../../src/game/shopOffers.ts'
import { CHECKOUT_TEST_ONLY, webPackById } from '../lib/coinPacks.ts'
import { json } from '../lib/http.ts'
import { isLiveStripeKey, isTestCheckoutSessionId, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { dbNotReady, gateResponse, requestCountry, requireCheckoutGate } from '../lib/payGate.ts'
import { bearer, supabaseAdmin, supabaseAsUser } from '../lib/supabaseAdmin.ts'

/**
 * Credits a paid Checkout session once, on the server.
 * A webhook records the receipt. The signed-in player claims it.
 * Coins land in player_balances. Treats and buddies are listed for the device
 * to apply only when this claim is new. A Starter can be claimed again.
 * Live sessions are ignored until Tony turns test-only off.
 */
export default async function coinCredit(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const raw = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (signature && webhookSecret) {
    const admin = supabaseAdmin()
    if (!admin) return json({ ok: false, error: 'Coin credit is not set up yet.' }, 503)
    const key = readStripeKey()
    if (!key || (CHECKOUT_TEST_ONLY && isLiveStripeKey(key))) return json({ ok: false }, 503)
    try {
      const event = stripeClient(key).webhooks.constructEvent(raw, signature, webhookSecret)
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const pack = webPackById(session.metadata?.packId)
        if (session.livemode && CHECKOUT_TEST_ONLY) return json({ ok: true, ignored: 'live' })
        if (session.id && pack && session.payment_status === 'paid' && chargeMatchesPack(pack, session.currency, session.amount_total)) {
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
  if (!isTestCheckoutSessionId(sessionId)) {
    return json({ ok: false, error: CHECKOUT_TEST_ONLY ? 'Live checkout is not turned on yet.' : 'Missing session' }, 400)
  }

  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Coin credit is not set up yet.' }, 503)

  const token = bearer(req)
  if (!token) return json({ ok: false, error: 'Sign in first.' }, 401)
  const userClient = supabaseAsUser(token)
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  const uid = userData.user?.id
  if (userError || !uid) return json({ ok: false, error: 'Sign in first.' }, 401)

  const gate = await requireCheckoutGate({
    token,
    country: requestCountry(req),
    requireReauth: false,
  })
  if (!gate.ok) return gateResponse(gate)

  const key = readStripeKey()
  if (!key || (CHECKOUT_TEST_ONLY && isLiveStripeKey(key))) {
    return json({ ok: false, error: 'Purchases are unavailable right now.' }, 503)
  }

  const { data: purchase, error: purchaseError } = await admin
    .from('purchases')
    .select('status, device_claimed_at, player_id')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (purchaseError && !dbNotReady(purchaseError)) return json({ ok: false, error: 'Purchases are unavailable right now.' }, 502)
  if (!purchaseError && purchase && purchase.player_id && purchase.player_id !== uid) {
    return json({ ok: true, duplicate: true, coins: 0, treats: 0, pets: [], label: '', offerId: '' })
  }
  if (!purchaseError && purchase && (purchase.status === 'revoked' || purchase.status === 'blocked')) {
    return json({ ok: false, error: 'That payment was reversed.' }, 402)
  }
  const deviceClaimed = !purchaseError && !!purchase?.device_claimed_at

  const { data: receipt } = await admin.from('stripe_receipts').select('coins, pack_id, player_id').eq('session_id', sessionId).maybeSingle()
  let pack = webPackById(typeof receipt?.pack_id === 'string' ? receipt.pack_id : undefined)
  if (receipt && receipt.player_id && receipt.player_id !== uid) return json({ ok: true, duplicate: true, coins: 0, treats: 0, pets: [], label: '', offerId: '' })

  if (!pack) {
    const session = await stripeClient(key).checkout.sessions.retrieve(sessionId)
    pack = webPackById(session.metadata?.packId)
    if (!pack || session.payment_status !== 'paid' || session.metadata?.productId !== pack.productId) {
      return json({ ok: false, error: 'That payment is not ready.' }, 402)
    }
    if (session.livemode || !chargeMatchesPack(pack, session.currency, session.amount_total)) {
      return json({ ok: false, error: 'That payment does not match this pack.' }, 402)
    }
    await admin.from('stripe_receipts').upsert({ session_id: sessionId, pack_id: pack.id, coins: pack.coins, player_id: uid })
  }

  if (pack.once) {
    const { data: owned } = await admin
      .from('player_items')
      .select('item_id')
      .eq('player_id', uid)
      .eq('item_type', 'bundle')
      .eq('item_id', pack.id)
      .maybeSingle()
    if (owned) {
      return json({ ok: true, duplicate: true, coins: pack.coins, treats: pack.treats, pets: pack.pets, label: pack.label, offerId: pack.id })
    }
  }

  const { data, error } = await admin.rpc('apply_stripe_credit', { player: uid, op: sessionId, amount: pack.coins })
  if (error) return json({ ok: false, error: 'Coin credit is waiting on the shop database update.' }, 502)
  const result = (data ?? {}) as { ok?: boolean; duplicate?: boolean; error?: string }
  if (result.ok === false) return json({ ok: false, error: 'Coin credit is waiting on the shop database update.' }, 502)
  if (!receipt?.player_id) await admin.from('stripe_receipts').update({ player_id: uid }).eq('session_id', sessionId)
  const serverDuplicate = result.duplicate === true
  let duplicate = serverDuplicate
  if (purchase && !deviceClaimed) {
    await admin.from('purchases').update({ device_claimed_at: new Date().toISOString() }).eq('session_id', sessionId).is('device_claimed_at', null)
    duplicate = false
  }
  if (!serverDuplicate && pack.once) {
    await admin.from('player_items').insert({
      player_id: uid,
      item_type: 'bundle',
      item_id: pack.id,
      op_id: crypto.randomUUID(),
    })
  }
  return json({
    ok: true,
    duplicate,
    coins: pack.coins,
    treats: pack.treats,
    pets: pack.pets,
    label: pack.label,
    offerId: pack.id,
  })
}
