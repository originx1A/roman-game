import { parentSwitch } from '../lib/accountsRules.ts'
import { json } from '../lib/http.ts'
import { requireUser, userToken } from '../lib/payGate.ts'
import { consumeReauth as burnReauth } from '../lib/reauth.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

/**
 * A linked parent turns payments off, or back on, using the parent's own re-auth.
 * The child cannot call this. Off stays off until a parent turns it on.
 */
export default async function parentPayments(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  const parentId = await requireUser(userToken(req))
  if (!parentId) return json({ ok: false, error: 'Sign in first.' }, 401)

  let childId = ''
  let action: 'off' | 'on' | '' = ''
  let reauthToken = ''
  try {
    const body = (await req.json()) as { childId?: unknown; action?: unknown; reauthToken?: unknown }
    childId = typeof body.childId === 'string' ? body.childId : ''
    action = body.action === 'off' || body.action === 'on' ? body.action : ''
    reauthToken = typeof body.reauthToken === 'string' ? body.reauthToken : ''
  } catch {
    return json({ ok: false, error: 'Missing parent check.' }, 400)
  }
  if (!childId || !action) return json({ ok: false, error: 'Missing parent check.' }, 400)
  if (!await burnReauth(admin, parentId, reauthToken)) {
    return json({ ok: false, error: 'Enter your password, PIN, or passkey.' }, 401)
  }

  const { data: link } = await admin
    .from('parent_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_id', childId)
    .eq('status', 'active')
    .maybeSingle()
  const { data: childPay } = await admin
    .from('account_payments')
    .select('receipt_email, terms_accepted_at, adult_confirmed_at')
    .eq('player_id', childId)
    .maybeSingle()
  const attested = !!(childPay?.receipt_email && childPay?.terms_accepted_at && childPay?.adult_confirmed_at)
  const result = parentSwitch({ callerIsParent: !!link, action, attested })
  if (!result.ok) return json({ ok: false, error: result.error }, result.status)

  const now = new Date().toISOString()
  const { error } = await admin.from('account_payments').upsert({
    player_id: childId,
    payments_enabled: result.paymentsEnabled,
    parent_locked: result.parentLocked,
    parent_locked_by: result.parentLocked ? parentId : null,
    parent_locked_at: result.parentLocked ? now : null,
    updated_at: now,
  })
  if (error) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  return json({ ok: true, paymentsEnabled: result.paymentsEnabled, parentLocked: result.parentLocked })
}
