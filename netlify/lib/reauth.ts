import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Step-up proof for one purchase. Ten minutes, then it dies. This is not a gift code. */
export const REAUTH_TTL_MS = 10 * 60_000

export type ReauthMethod = 'pin' | 'picture' | 'password' | 'passkey'

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export async function issueReauth(
  admin: SupabaseClient,
  playerId: string,
  method: ReauthMethod,
  now = Date.now(),
): Promise<{ token: string; expiresAt: string } | null> {
  const token = newSecret()
  const expiresAt = new Date(now + REAUTH_TTL_MS).toISOString()
  const { error } = await admin.from('purchase_reauths').insert({
    token_hash: hashSecret(token),
    player_id: playerId,
    method,
    expires_at: expiresAt,
  })
  if (error) return null
  return { token, expiresAt }
}

/** Single use. A second purchase needs a new check. There is no "remember this" flag. */
export async function consumeReauth(admin: SupabaseClient, playerId: string, token: string, now = Date.now()): Promise<boolean> {
  if (!token || token.length < 20 || token.length > 200) return false
  const tokenHash = hashSecret(token)
  const { data, error } = await admin
    .from('purchase_reauths')
    .select('player_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error || !data || data.player_id !== playerId || data.used_at) return false
  if (Date.parse(data.expires_at) <= now) return false
  const { error: markError } = await admin
    .from('purchase_reauths')
    .update({ used_at: new Date(now).toISOString() })
    .eq('token_hash', tokenHash)
    .is('used_at', null)
  return !markError
}
