import { json, PURCHASES_UNAVAILABLE } from '../lib/http.ts'
import {
  consumePinGrant,
  createPurchasePin,
  pinStatus,
  requestPinReset,
  resetPurchasePin,
  resetRedirect,
  verifyPurchasePin,
} from '../lib/purchasePinStore.ts'
import { sendSignInLink, userFromRequest } from '../lib/supabaseUser.ts'

const SIGN_IN = 'Sign in to buy'
const VERIFY_EMAIL = 'Confirm the sign-in email before using a purchase PIN.'

/**
 * Purchase PIN for the signed-in account.
 * The digits are hashed before they are stored. They are not logged.
 */
export default async function purchasePin(req: Request): Promise<Response> {
  const user = await userFromRequest(req)
  if (!user) return json({ error: SIGN_IN }, 401)

  if (req.method === 'GET') {
    try {
      const status = await pinStatus(user.id, user.lastSignInAt)
      return json({ ...status, emailVerified: user.emailVerified })
    } catch (err) {
      console.error('purchase-pin read failed', err instanceof Error ? err.message : 'error')
      return json({ error: PURCHASES_UNAVAILABLE }, 503)
    }
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let action = ''
  let pin = ''
  let again = ''
  let grant = ''
  try {
    const body = (await req.json()) as { action?: unknown; pin?: unknown; again?: unknown; grant?: unknown }
    action = typeof body.action === 'string' ? body.action : ''
    pin = typeof body.pin === 'string' ? body.pin : ''
    again = typeof body.again === 'string' ? body.again : ''
    grant = typeof body.grant === 'string' ? body.grant : ''
  } catch {
    return json({ error: 'Choose a 4-digit PIN.' }, 400)
  }

  try {
    if (!user.emailVerified && (action === 'create' || action === 'reset' || action === 'verify')) {
      return json({ error: VERIFY_EMAIL }, 403)
    }
    if (action === 'create') {
      const result = await createPurchasePin(user.id, pin, again)
      return pinResponse(result)
    }
    if (action === 'verify') {
      const result = await verifyPurchasePin(user.id, pin)
      return pinResponse(result)
    }
    if (action === 'forgot') {
      const deploy = process.env.DEPLOY_PRIME_URL || process.env.URL || ''
      const result = await requestPinReset(user.id, user.email, resetRedirect(deploy), sendSignInLink)
      return pinResponse(result)
    }
    if (action === 'reset') {
      const result = await resetPurchasePin(user.id, pin, again, user.lastSignInAt)
      return pinResponse(result)
    }
    if (action === 'consume') {
      const ok = await consumePinGrant(user.id, grant)
      if (!ok) return json({ error: 'Enter the purchase PIN.' }, 403)
      return json({ ok: true })
    }
    return json({ error: 'Choose a 4-digit PIN.' }, 400)
  } catch (err) {
    console.error('purchase-pin failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 503)
  }
}

function pinResponse(result: { ok: true; grant?: string } | { ok: false; status: number; error: string }): Response {
  if (!result.ok) return json({ error: result.error }, result.status)
  return json({ ok: true, grant: result.grant })
}
