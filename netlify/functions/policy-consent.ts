import { json } from '../lib/http.ts'
import { writePolicyConsent } from '../lib/policyConsentStore.ts'
import { userFromRequest } from '../lib/supabaseUser.ts'
import { PRIVACY_VERSION, PURCHASE_TERMS_VERSION, TERMS_VERSION } from '../../src/game/legalCopy.ts'

/**
 * Records Terms + Privacy consent on the account.
 * writePolicyConsent no-ops unless the ledger flag is on. Migration 006 is not applied.
 */
export default async function policyConsent(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const user = await userFromRequest(req)
  if (!user) return json({ error: 'Sign in first.' }, 401)
  let guardian = false
  let kind: 'signup' | 'purchase' = 'signup'
  try {
    const body = (await req.json()) as { guardian?: unknown; kind?: unknown }
    guardian = body.guardian === true
    if (body.kind === 'purchase') kind = 'purchase'
  } catch {
    guardian = false
  }
  const stored = await writePolicyConsent(user.id, guardian, kind)
  return json({
    ok: true,
    stored,
    privacyVersion: PRIVACY_VERSION,
    termsVersion: TERMS_VERSION,
    purchaseTermsVersion: PURCHASE_TERMS_VERSION,
  })
}
