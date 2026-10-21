import { hashSecret, newSecret } from '../lib/reauth.ts'
import { parentSlotsLeft } from '../lib/accountsRules.ts'
import { json } from '../lib/http.ts'
import { loadPayRow, requireUser, userToken } from '../lib/payGate.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

const INVITE_MS = 72 * 60 * 60 * 1000

/**
 * One-tap parent link. The child creates a token (QR). A parent with payments on accepts it.
 * At most two pending or active parents. The child cannot delete the parent's account.
 */
export default async function parentLink(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  const playerId = await requireUser(userToken(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)

  let action = ''
  let token = ''
  try {
    const body = (await req.json()) as { action?: unknown; token?: unknown }
    action = typeof body.action === 'string' ? body.action : ''
    token = typeof body.token === 'string' ? body.token : ''
  } catch {
    return json({ ok: false, error: 'Missing link.' }, 400)
  }

  if (action === 'create') {
    const { count, error: countError } = await admin
      .from('parent_links')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', playerId)
      .in('status', ['pending', 'active'])
    if (countError) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
    if (!parentSlotsLeft(count ?? 0)) return json({ ok: false, error: 'This account already has two parents.' }, 409)
    const secret = newSecret(16)
    const until = new Date(Date.now() + INVITE_MS).toISOString()
    const { error } = await admin.from('parent_links').insert({
      child_id: playerId,
      token_hash: hashSecret(secret),
      status: 'pending',
      invite_until: until,
    })
    if (error) return json({ ok: false, error: 'Could not make the link.' }, 409)
    return json({ ok: true, token: secret, inviteUntil: until })
  }

  if (action === 'accept') {
    if (token.length < 20) return json({ ok: false, error: "That link doesn't work." }, 400)
    const parent = await loadPayRow(playerId)
    if (!parent.ok) return json({ ok: false, error: parent.error }, parent.status)
    if (!parent.row.paymentsEnabled || parent.row.parentLocked || parent.row.age13Plus !== true) {
      return json({ ok: false, error: 'Turn payments on with your own card before linking.' }, 403)
    }
    const { data: link, error: linkError } = await admin
      .from('parent_links')
      .select('id, child_id, status, invite_until')
      .eq('token_hash', hashSecret(token))
      .maybeSingle()
    if (linkError || !link || link.status !== 'pending') return json({ ok: false, error: "That link doesn't work." }, 400)
    if (link.child_id === playerId) return json({ ok: false, error: "That link doesn't work." }, 400)
    if (Date.parse(link.invite_until) <= Date.now()) return json({ ok: false, error: "That link doesn't work." }, 400)
    const { data: updated, error: updateError } = await admin
      .from('parent_links')
      .update({ parent_id: playerId, status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', link.id)
      .eq('status', 'pending')
      .select('id')
    if (updateError || !Array.isArray(updated) || updated.length === 0) {
      return json({ ok: false, error: "That link doesn't work." }, 400)
    }
    return json({ ok: true })
  }

  return json({ ok: false, error: 'Missing link.' }, 400)
}
