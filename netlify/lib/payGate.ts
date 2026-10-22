import { json } from './http.ts'
import { bearer, supabaseAdmin, supabaseAsUser } from './supabaseAdmin.ts'

/**
 * EU, EEA, and UK country codes. Checkout is refused when the edge tells us
 * the request is from one of these. Play is not affected. A missing header
 * does not block (local dev and preview have no geo header).
 */
export const PAYMENTS_BLOCKED_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'UK', 'IS', 'LI', 'NO',
])

export interface CheckoutGateInput {
  signedIn: boolean
  /** False until enable-payments has recorded the adult attestation, receipt email, and terms. */
  paymentsEnabled: boolean
  /** Set by a linked parent. The account holder cannot clear it. */
  parentLocked: boolean
  /** players.age_13_plus. Null means there is no player row. This migration does not write that column. */
  age13Plus: boolean | null
  reauthOk: boolean
  country: string | null
  /** Create-checkout requires a fresh per-purchase check. Confirm and claim do not ask again. */
  requireReauth: boolean
}

export type GateResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Whether this signed-in account may open or finish a purchase.
 * Purchases have no daily amount limit. The per-purchase check has no off switch.
 */
export function checkoutAllowed(input: CheckoutGateInput): GateResult {
  if (!input.signedIn) return { ok: false, status: 401, error: 'Sign in first.' }
  if (input.age13Plus !== true) return { ok: false, status: 403, error: 'Payments stay off on this account.' }
  if (input.parentLocked) {
    return { ok: false, status: 403, error: 'A parent turned payments off. They have to turn them back on.' }
  }
  if (!input.paymentsEnabled) return { ok: false, status: 403, error: 'Turn payments on before buying.' }
  if (input.requireReauth && !input.reauthOk) {
    return { ok: false, status: 401, error: 'Enter your password, PIN, or passkey to buy.' }
  }
  const country = (input.country || '').toUpperCase()
  if (country && PAYMENTS_BLOCKED_COUNTRIES.has(country)) {
    return { ok: false, status: 403, error: "Purchases aren't available in this country yet." }
  }
  return { ok: true }
}

export function requestCountry(req: Request): string | null {
  const raw = req.headers.get('x-country') || req.headers.get('cf-ipcountry') || ''
  const code = raw.split(',')[0].trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return null
  return code
}

export function dbNotReady(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = error.message || ''
  return error.code === '42P01' || error.code === 'PGRST205' || /relation|schema cache|does not exist/i.test(msg)
}

export async function requireUser(token: string): Promise<string | null> {
  if (!token) return null
  const { data, error } = await supabaseAsUser(token).auth.getUser(token)
  if (error || !data.user?.id) return null
  return data.user.id
}

export interface PayRow {
  paymentsEnabled: boolean
  parentLocked: boolean
  age13Plus: boolean | null
  email: string | null
  attested: boolean
}

export async function loadPayRow(playerId: string): Promise<{ ok: true; row: PayRow } | { ok: false; status: number; error: string }> {
  const admin = supabaseAdmin()
  if (!admin) return { ok: false, status: 503, error: 'Accounts are not set up yet.' }
  const { data: player, error: playerError } = await admin.from('players').select('age_13_plus').eq('id', playerId).maybeSingle()
  if (playerError) {
    if (dbNotReady(playerError)) return { ok: false, status: 503, error: 'Accounts are not set up yet.' }
    return { ok: false, status: 502, error: 'Purchases are unavailable right now.' }
  }
  if (!player) return { ok: false, status: 403, error: 'Payments stay off on this account.' }
  const { data: pay, error: payError } = await admin
    .from('account_payments')
    .select('payments_enabled, parent_locked, receipt_email, terms_accepted_at, adult_confirmed_at')
    .eq('player_id', playerId)
    .maybeSingle()
  if (payError) {
    if (dbNotReady(payError)) return { ok: false, status: 503, error: 'Accounts are not set up yet.' }
    return { ok: false, status: 502, error: 'Purchases are unavailable right now.' }
  }
  const attested = !!(pay?.receipt_email && pay?.terms_accepted_at && pay?.adult_confirmed_at)
  return {
    ok: true,
    row: {
      paymentsEnabled: pay?.payments_enabled === true && attested,
      parentLocked: pay?.parent_locked === true,
      age13Plus: player.age_13_plus === true,
      email: typeof pay?.receipt_email === 'string' ? pay.receipt_email : null,
      attested,
    },
  }
}

/** Shared check for every checkout path. Create-checkout also passes requireReauth. */
export async function requireCheckoutGate(opts: {
  token: string
  reauthToken?: string
  country: string | null
  requireReauth: boolean
}): Promise<{ ok: true; playerId: string; email: string | null } | { ok: false; status: number; error: string }> {
  const playerId = await requireUser(opts.token)
  if (!playerId) return { ok: false, status: 401, error: 'Sign in first.' }
  const loaded = await loadPayRow(playerId)
  if (!loaded.ok) return loaded
  let reauthOk = false
  if (opts.requireReauth) {
    const admin = supabaseAdmin()
    if (!admin) return { ok: false, status: 503, error: 'Accounts are not set up yet.' }
    const { consumeReauth } = await import('./reauth.ts')
    reauthOk = await consumeReauth(admin, playerId, opts.reauthToken || '')
  }
  const gate = checkoutAllowed({
    signedIn: true,
    paymentsEnabled: loaded.row.paymentsEnabled,
    parentLocked: loaded.row.parentLocked,
    age13Plus: loaded.row.age13Plus,
    reauthOk,
    country: opts.country,
    requireReauth: opts.requireReauth,
  })
  if (!gate.ok) return gate
  return { ok: true, playerId, email: loaded.row.email }
}

export function gateResponse(result: { status: number; error: string }): Response {
  return json({ ok: false, error: result.error }, result.status)
}

export function userToken(req: Request): string {
  return bearer(req)
}
