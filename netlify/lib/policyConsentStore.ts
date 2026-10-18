/**
 * Account copy of the sign-up consent.
 * Off unless ACCOUNT_LEDGER_ENABLED=1. The columns are in
 * supabase/migration-006-policy-consent.sql, which is NOT APPLIED.
 * Do not turn the flag on until that file has been applied.
 */
import { POLICY_VERSION } from '../../src/game/legalCopy.ts'

const SUPABASE_URL = 'https://oelsglmfkpzbueqysvdm.supabase.co'

export function policyConsentWriteEnabled(flag: string | undefined, hasKey: boolean): boolean {
  return flag === '1' && hasKey
}

/**
 * Writes policy_version, policy_consented_at, and guardian_consent.
 * Returns false without calling Supabase when the flag is off or the key is missing.
 * Never logs the key or the token.
 */
export async function writePolicyConsent(userId: string, guardian: boolean): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!policyConsentWriteEnabled(process.env.ACCOUNT_LEDGER_ENABLED, !!key) || !key) return false
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        policy_version: POLICY_VERSION,
        policy_consented_at: new Date().toISOString(),
        guardian_consent: guardian === true,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
