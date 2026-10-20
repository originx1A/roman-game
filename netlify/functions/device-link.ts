import { json } from '../lib/http.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

const hits = new Map<string, { n: number; reset: number }>()

function limited(ip: string): boolean {
  const now = Date.now()
  const row = hits.get(ip)
  if (!row || row.reset < now) {
    hits.set(ip, { n: 1, reset: now + 10 * 60_000 })
    return false
  }
  row.n += 1
  return row.n > 8
}

/** Redeem a one-time device code or QR token and hand back a session hash. */
export default async function deviceLink(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Device link is not set up yet.' }, 503)

  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'local'
  if (limited(ip.split(',')[0].trim())) return json({ ok: false, error: 'Too many tries. Wait a few minutes.' }, 429)

  let secret = ''
  try {
    const body = (await req.json()) as { secret?: unknown }
    secret = typeof body.secret === 'string' ? body.secret.trim() : ''
  } catch {
    return json({ ok: false, error: 'That code did not work.' }, 400)
  }
  if (!/^\d{6}$/.test(secret) && !/^[a-f0-9]{32}$/i.test(secret)) {
    return json({ ok: false, error: 'That code did not work.' }, 400)
  }

  const { data, error } = await admin.rpc('device_link_redeem', { secret })
  const row = (data ?? {}) as { ok?: boolean; player_id?: string; error?: string }
  if (error || !row.ok || !row.player_id) {
    await admin.rpc('device_link_miss', { secret })
    return json({ ok: false, error: 'That code did not work.' }, 400)
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(row.player_id)
  if (userError || !userData.user) return json({ ok: false, error: 'Could not switch devices.' }, 502)

  let email = userData.user.email || ''
  if (!email || email.endsWith('@link.romansgame.invalid')) {
    email = `p${row.player_id.replace(/-/g, '')}@link.romansgame.invalid`
    const { error: updateError } = await admin.auth.admin.updateUserById(row.player_id, {
      email,
      email_confirm: true,
    })
    if (updateError) return json({ ok: false, error: 'Could not switch devices.' }, 502)
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) return json({ ok: false, error: 'Could not switch devices.' }, 502)
  return json({ ok: true, token_hash: tokenHash })
}
