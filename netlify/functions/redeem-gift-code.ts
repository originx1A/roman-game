import { cancelGiftCode, redeemGiftCode } from '../lib/accountsLedger.ts'
import { json } from '../lib/http.ts'
import { requireUser, userToken } from '../lib/payGate.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'
import { supabaseLedger } from '../lib/supabaseLedger.ts'

/**
 * Redeem a paid gift code, show it to the buyer, or let the buyer cancel it before it is used.
 * Codes do not expire. Redeeming does not ask for a card.
 */
export default async function redeemGift(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  const playerId = await requireUser(userToken(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)

  let action = 'redeem'
  let code = ''
  let sessionId = ''
  try {
    const body = (await req.json()) as { action?: unknown; code?: unknown; sessionId?: unknown }
    if (body.action === 'show' || body.action === 'cancel' || body.action === 'redeem') action = body.action
    code = typeof body.code === 'string' ? body.code : ''
    sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  } catch {
    return json({ ok: false, error: 'Missing code.' }, 400)
  }

  const ledger = supabaseLedger(admin)
  try {
    if (action === 'show') {
      if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) return json({ ok: false, error: 'Missing code.' }, 400)
      const gift = await ledger.findGiftBySession(sessionId)
      if (!gift || gift.buyerId !== playerId || !gift.reveal) return json({ ok: false, error: "That code doesn't work." }, 404)
      return json({ ok: true, code: gift.reveal, itemId: gift.itemId })
    }
    if (action === 'cancel') {
      const result = await cancelGiftCode(ledger, code, playerId)
      if (!result.ok) return json({ ok: false, error: result.error }, result.status)
      return json({ ok: true })
    }
    const result = await redeemGiftCode(ledger, code, playerId)
    if (!result.ok) return json({ ok: false, error: result.error }, result.status)
    return json({ ok: true, itemId: result.itemId, coins: result.coins, label: result.label })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'not_ready') return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
    console.error('redeem-gift-code failed', message || 'error')
    return json({ ok: false, error: 'Gifts are unavailable right now.' }, 502)
  }
}
