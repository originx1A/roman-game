import { json, PURCHASES_UNAVAILABLE } from '../lib/http.ts'
import { listLedgerCredits, spentCadCents } from '../lib/accountMoney.ts'
import { userIdFromRequest } from '../lib/supabaseUser.ts'

/**
 * Credits already recorded for this account, plus the CAD spent in the last 7 days.
 * The client adds a credit only if this device has not applied that session yet.
 */
export default async function coinLedger(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const userId = await userIdFromRequest(req)
  if (!userId) return json({ error: 'Sign in to buy' }, 401)
  try {
    const [credits, spent] = await Promise.all([listLedgerCredits(userId), spentCadCents(userId)])
    return json({
      credits: credits.map((c) => ({ sessionId: c.sessionId, coins: c.coins, packId: c.packId })),
      spentCadCents: spent,
    })
  } catch (err) {
    console.error('coin-ledger failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 503)
  }
}
