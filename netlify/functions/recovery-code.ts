import { makeCode, sha256Hex } from '../lib/accountsLedger.ts'
import { json } from '../lib/http.ts'
import { requireUser, userToken } from '../lib/payGate.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

const hits = new Map<string, { n: number; reset: number }>()

function limited(key: string): boolean {
  const now = Date.now()
  const row = hits.get(key)
  if (!row || row.reset < now) {
    hits.set(key, { n: 1, reset: now + 10 * 60_000 })
    return false
  }
  row.n += 1
  return row.n > 8
}

/**
 * One-time recovery save card. The code is stored as a hash and is not dated.
 * Redeeming it signs that account in on this device. It does not reveal a password.
 */
export default async function recoveryCode(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)

  let action = ''
  let code = ''
  try {
    const body = (await req.json()) as { action?: unknown; code?: unknown }
    action = typeof body.action === 'string' ? body.action : ''
    code = typeof body.code === 'string' ? body.code : ''
  } catch {
    return json({ ok: false, error: 'Missing code.' }, 400)
  }

  if (action === 'issue') {
    const playerId = await requireUser(userToken(req))
    if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)
    const { count, error: countError } = await admin
      .from('recovery_codes')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .is('used_at', null)
    if (countError) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
    if ((count ?? 0) >= 5) return json({ ok: false, error: 'You already have recovery codes waiting.' }, 409)
    const secret = makeCode('SAVE')
    const { error } = await admin.from('recovery_codes').insert({
      player_id: playerId,
      code_hash: sha256Hex(secret),
    })
    if (error) return json({ ok: false, error: 'Could not make a recovery code.' }, 502)
    return json({ ok: true, code: secret })
  }

  if (action === 'redeem') {
    const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
    if (limited(ip)) return json({ ok: false, error: 'Too many tries. Wait a few minutes.' }, 429)
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
    if (!/^SAVE-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(normalized)) {
      return json({ ok: false, error: "That code doesn't work." }, 400)
    }
    const { data: row, error } = await admin
      .from('recovery_codes')
      .select('id, player_id, used_at')
      .eq('code_hash', sha256Hex(normalized))
      .maybeSingle()
    if (error || !row || row.used_at) return json({ ok: false, error: "That code doesn't work." }, 400)
    const { data: marked } = await admin
      .from('recovery_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('used_at', null)
      .select('id')
    if (!Array.isArray(marked) || marked.length === 0) return json({ ok: false, error: "That code doesn't work." }, 400)

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(row.player_id)
    if (userError || !userData.user) return json({ ok: false, error: 'Could not sign in.' }, 502)
    let email = userData.user.email || ''
    if (!email || email.endsWith('@link.romansgame.invalid')) {
      email = `p${row.player_id.replace(/-/g, '')}@link.romansgame.invalid`
      const { error: updateError } = await admin.auth.admin.updateUserById(row.player_id, { email, email_confirm: true })
      if (updateError) return json({ ok: false, error: 'Could not sign in.' }, 502)
    }
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = link?.properties?.hashed_token
    if (linkError || !tokenHash) return json({ ok: false, error: 'Could not sign in.' }, 502)
    return json({ ok: true, token_hash: tokenHash })
  }

  return json({ ok: false, error: 'Missing code.' }, 400)
}
