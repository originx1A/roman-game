/**
 * Deletes the account row and personal game data.
 * Off unless ACCOUNT_LEDGER_ENABLED=1 and a service role key is set.
 * supabase/migration-007-account-deletion.sql is NOT APPLIED.
 * This file does not delete coin_ledger. Those rows are the tax record.
 * Do not call this against a live project from tests or from a preview.
 */
import { accountDeleteSqlEnabled, consentRetainUntil, isUserId } from '../../src/game/accountDelete.ts'

const SUPABASE_URL = 'https://oelsglmfkpzbueqysvdm.supabase.co'

type Env = { ACCOUNT_LEDGER_ENABLED?: string; SUPABASE_SERVICE_ROLE_KEY?: string }

interface ConsentCopy {
  privacy_version: string | null
  terms_version: string | null
  policy_consented_at: string | null
  guardian_consent: boolean | null
  consent_type: string | null
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 ? value : null
}

function asConsent(row: unknown): ConsentCopy {
  const r = row && typeof row === 'object' ? row as Record<string, unknown> : {}
  return {
    privacy_version: asText(r.privacy_version),
    terms_version: asText(r.terms_version),
    policy_consented_at: asText(r.policy_consented_at),
    guardian_consent: typeof r.guardian_consent === 'boolean' ? r.guardian_consent : null,
    consent_type: asText(r.consent_type),
  }
}

/**
 * Returns true only when the player row and auth user are removed.
 * Returns false without calling fetch when the flag is off, the key is missing, or the id is not a user id.
 * A failed retention insert stops the rest, so a missing migration does not delete the live row.
 */
export async function deleteAccountDatabase(
  userId: string,
  opts: { fetchImpl?: typeof fetch; env?: Env; now?: number } = {},
): Promise<boolean> {
  const env = opts.env ?? {
    ACCOUNT_LEDGER_ENABLED: process.env.ACCOUNT_LEDGER_ENABLED,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!accountDeleteSqlEnabled(env.ACCOUNT_LEDGER_ENABLED, !!key) || !key) return false
  if (!isUserId(userId)) return false
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? Date.now()
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  }
  let consent: ConsentCopy = {
    privacy_version: null,
    terms_version: null,
    policy_consented_at: null,
    guardian_consent: null,
    consent_type: null,
  }
  try {
    const read = await fetchImpl(
      `${SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(userId)}&select=privacy_version,terms_version,policy_consented_at,guardian_consent,consent_type`,
      { headers: { apikey: key, authorization: `Bearer ${key}` } },
    )
    if (read.ok) {
      const rows = await read.json() as unknown
      consent = asConsent(Array.isArray(rows) ? rows[0] : null)
    }
  } catch {
    return false
  }

  const keep = await fetchImpl(`${SUPABASE_URL}/rest/v1/account_deletions?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      deleted_at: new Date(now).toISOString(),
      privacy_version: consent.privacy_version,
      terms_version: consent.terms_version,
      policy_consented_at: consent.policy_consented_at,
      guardian_consent: consent.guardian_consent,
      consent_type: consent.consent_type,
      retain_consent_until: consentRetainUntil(now),
    }),
  })
  if (!keep.ok) return false

  const remove = async (path: string): Promise<boolean> => {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers })
    return res.ok || res.status === 404
  }
  if (!await remove(`scores?player_id=eq.${encodeURIComponent(userId)}`)) return false
  if (!await remove(`player_saves?user_id=eq.${encodeURIComponent(userId)}`)) return false
  if (!await remove(`purchase_pins?user_id=eq.${encodeURIComponent(userId)}`)) return false
  if (!await remove(`players?id=eq.${encodeURIComponent(userId)}`)) return false
  const auth = await fetchImpl(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers,
  })
  return auth.ok || auth.status === 404
}
