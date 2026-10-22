import type { SupabaseClient } from '@supabase/supabase-js'
import { dbNotReady } from './payGate.ts'

type PendingCart = {
  player_id: string | null
  gift_mode: string | null
  gift_child_id: string | null
}

/**
 * How many Starters this account already holds, plus a checkout still open for them.
 * A gift code has no receiving account yet, so those carts are not counted.
 * A missing table counts as zero so a project that has not been migrated can still price the first one.
 */
export async function countStarterReceipts(admin: SupabaseClient, accountId: string): Promise<number | 'unavailable'> {
  const entitled = await admin
    .from('entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', accountId)
    .in('item_id', ['starter', 'starter_bundle'])
    .is('revoked_at', null)
  if (entitled.error) return dbNotReady(entitled.error) ? 0 : 'unavailable'

  const pending = await admin
    .from('carts')
    .select('player_id, gift_mode, gift_child_id')
    .eq('holds_starter', true)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
  if (pending.error) return dbNotReady(pending.error) ? entitled.count ?? 0 : 'unavailable'
  const waiting = ((pending.data ?? []) as PendingCart[]).filter((row) => targetsAccount(row, accountId)).length
  return (entitled.count ?? 0) + waiting
}

function targetsAccount(row: PendingCart, accountId: string): boolean {
  if (row.gift_child_id) return row.gift_child_id === accountId
  if (row.gift_mode === 'code') return false
  return row.player_id === accountId
}
