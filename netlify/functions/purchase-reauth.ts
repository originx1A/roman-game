import { createClient } from '@supabase/supabase-js'
import { json } from '../lib/http.ts'
import { requireUser, userToken } from '../lib/payGate.ts'
import { issueReauth, type ReauthMethod } from '../lib/reauth.ts'
import { SUPABASE_PUBLISHABLE, SUPABASE_URL, supabaseAdmin } from '../lib/supabaseAdmin.ts'

const hits = new Map<string, { n: number; reset: number }>()

function limited(playerId: string): boolean {
  const now = Date.now()
  const row = hits.get(playerId)
  if (!row || row.reset < now) {
    hits.set(playerId, { n: 1, reset: now + 10 * 60_000 })
    return false
  }
  row.n += 1
  return row.n > 8
}

/**
 * Proves the account holder is present before a purchase.
 * PIN, picture password, account password, or (via the passkey function) a passkey.
 * There is no option to turn this off. A success returns a one-time token.
 */
export default async function purchaseReauth(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  const playerId = await requireUser(userToken(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)

  let method: ReauthMethod | '' = ''
  let secret = ''
  let captchaToken: string | undefined
  try {
    const body = (await req.json()) as { method?: unknown; secret?: unknown; captchaToken?: unknown; turnstile_token?: unknown }
    if (body.method === 'pin' || body.method === 'picture' || body.method === 'password') method = body.method
    secret = typeof body.secret === 'string' ? body.secret : ''
    captchaToken = readCaptcha(body)
  } catch {
    return json({ ok: false, error: 'Enter your password, PIN, or passkey to buy.' }, 400)
  }
  if (!method || !secret) return json({ ok: false, error: 'Enter your password, PIN, or passkey to buy.' }, 400)

  const ok = method === 'password' ? await passwordOk(admin, playerId, secret, captchaToken) : await profileOk(admin, playerId, method, secret)
  if (ok === 'captcha') return json({ ok: false, error: 'turnstile_required' }, 403)
  if (!ok) {
    if (limited(playerId)) return json({ ok: false, error: 'Too many tries. Wait a few minutes.' }, 429)
    return json({ ok: false, error: 'That did not match.' }, 401)
  }
  const issued = await issueReauth(admin, playerId, method)
  if (!issued) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  return json({ ok: true, reauthToken: issued.token, expiresAt: issued.expiresAt })
}

async function profileOk(admin: NonNullable<ReturnType<typeof supabaseAdmin>>, playerId: string, kind: 'pin' | 'picture', secret: string): Promise<boolean> {
  const { data, error } = await admin.rpc('check_profile_secret', { target: playerId, kind, secret })
  if (error || !data || typeof data !== 'object') return false
  const row = data as { ok?: boolean; open?: boolean }
  if (row.open === true) return false
  return row.ok === true
}

function readCaptcha(body: { captchaToken?: unknown; turnstile_token?: unknown }): string | undefined {
  const raw = body.captchaToken ?? body.turnstile_token
  if (typeof raw !== 'string') return undefined
  const token = raw.trim()
  if (token.length < 10 || token.length > 2048) return undefined
  return token
}

async function passwordOk(
  admin: NonNullable<ReturnType<typeof supabaseAdmin>>,
  playerId: string,
  secret: string,
  captchaToken?: string,
): Promise<boolean | 'captcha'> {
  const { data, error } = await admin.auth.admin.getUserById(playerId)
  const email = data.user?.email || ''
  if (error || !email || email.endsWith('@link.romansgame.invalid') || email.endsWith('@romansgame.invalid')) return false
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } })
  const signed = await client.auth.signInWithPassword({ email, password: secret, options: { captchaToken } })
  const blob = `${signed.error?.code ?? ''} ${signed.error?.message ?? ''}`.toLowerCase()
  if (blob.includes('captcha')) return 'captcha'
  return !signed.error && signed.data.user?.id === playerId
}
