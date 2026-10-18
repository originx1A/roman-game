import { json } from '../lib/http.ts'
import { deleteAccountDatabase } from '../lib/accountDeleteSql.ts'
import { deleteParentNotice } from '../lib/parentNoticeStore.ts'
import { deletePinRecord } from '../lib/purchasePinStore.ts'
import { userFromRequest } from '../lib/supabaseUser.ts'

/**
 * Account → Delete account.
 * Always clears the purchase PIN blob and the parent-notice email.
 * Removes the player row, scores, cloud save, purchase PIN, and auth user
 * only when ACCOUNT_LEDGER_ENABLED=1 and migration 007 is present.
 * Does not delete coin_ledger.
 */
export default async function deleteAccount(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const user = await userFromRequest(req)
  if (!user) return json({ error: 'Sign in first.' }, 401)
  let database = false
  try {
    database = await deleteAccountDatabase(user.id)
  } catch (err) {
    console.error('delete account database', err instanceof Error ? err.message : 'error')
    database = false
  }
  let blobs = true
  try {
    await deletePinRecord(user.id)
    await deleteParentNotice(user.id, Date.now(), database)
  } catch (err) {
    blobs = false
    console.error('delete account blobs', err instanceof Error ? err.message : 'error')
  }
  return json({
    ok: true,
    database,
    blobs,
    kept: ['purchase and tax records', 'consent record without a name or email'],
  })
}
