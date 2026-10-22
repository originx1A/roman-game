import { cleanReceiptEmail, enablePaymentsDecision, receiptEmailOk } from '../lib/accountsRules.ts'
import { json } from '../lib/http.ts'
import { gateResponse, requireUser, userToken } from '../lib/payGate.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

export const TERMS_VERSION = '2026-10-20'

/**
 * Turns payments on for the signed-in account.
 * Requires an adult attestation, the terms tick, and a receipt email.
 * Does not clear a parent lock. Does not write public.players.
 */
export default async function enablePayments(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  const playerId = await requireUser(userToken(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)

  let adult = false
  let terms = false
  let email: unknown
  try {
    const body = (await req.json()) as { adult?: unknown; terms?: unknown; email?: unknown }
    adult = body.adult === true
    terms = body.terms === true
    email = body.email
  } catch {
    return json({ ok: false, error: 'Missing details.' }, 400)
  }

  const { data: player, error: playerError } = await admin.from('players').select('age_13_plus').eq('id', playerId).maybeSingle()
  if (playerError || !player) return json({ ok: false, error: 'Payments stay off on this account.' }, 403)
  const { data: pay, error: payError } = await admin
    .from('account_payments')
    .select('parent_locked')
    .eq('player_id', playerId)
    .maybeSingle()
  if (payError) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)

  const decision = enablePaymentsDecision({
    adult,
    terms,
    email,
    age13Plus: player.age_13_plus === true,
    parentLocked: pay?.parent_locked === true,
  })
  if (!decision.ok) return gateResponse(decision)
  if (!receiptEmailOk(email)) return json({ ok: false, error: 'Add an email for receipts.' }, 400)

  const now = new Date().toISOString()
  const fields = {
    payments_enabled: true,
    receipt_email: cleanReceiptEmail(email),
    terms_accepted_at: now,
    terms_version: TERMS_VERSION,
    adult_confirmed_at: now,
    enabled_at: now,
    updated_at: now,
  }
  const { data: updated, error: updateError } = await admin
    .from('account_payments')
    .update(fields)
    .eq('player_id', playerId)
    .eq('parent_locked', false)
    .select('player_id')
  if (updateError) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  if (Array.isArray(updated) && updated.length > 0) return json({ ok: true, paymentsEnabled: true })
  if (pay) return json({ ok: false, error: 'A parent turned payments off. They have to turn them back on.' }, 403)
  const { error: insertError } = await admin.from('account_payments').insert({
    player_id: playerId,
    parent_locked: false,
    ...fields,
  })
  if (insertError) return json({ ok: false, error: 'A parent turned payments off. They have to turn them back on.' }, 403)
  return json({ ok: true, paymentsEnabled: true })
}
