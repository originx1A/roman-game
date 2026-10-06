import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { OWNER_KEY_ENV, ownerKeyConfigured, ownerKeyMatches } from '../lib/gifts.ts'
import { ANALYTICS_STORE, dayKeyUtc, type StoredEvent } from '../lib/analytics.ts'

/**
 * 10.06: owner-only feedback management.
 * POST {key, action, ids?} →
 *   action 'delete'    {ids:[blobKey...]} → delete those feedback events
 *   action 'archive'    {ids:[blobKey...]} → hide those feedback events (kept in storage)
 *   action 'unarchive'  {ids:[blobKey...]} → restore archived feedback events
 *   action 'deleteAll'                     → delete every feedback event (other event types untouched)
 * Only `feedback` events are ever mutated; app_open / level_clear / return_visit are never touched.
 */
const KEY_RE = /^e\/\d{4}-\d{2}-\d{2}\/.+$/
const MAX_IDS = 500

export default async function analyticsManage(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ownerKeyConfigured()) return json({ error: `Add ${OWNER_KEY_ENV} in Netlify first.` }, 503)
  let body: { key?: unknown; action?: unknown; ids?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (!ownerKeyMatches(body.key)) {
    await new Promise((r) => setTimeout(r, 600))
    return json({ error: 'Wrong owner passphrase.' }, 401)
  }
  const action = body.action
  if (!['delete', 'deleteAll', 'archive', 'unarchive'].includes(action as string)) {
    return json({ error: 'Bad request.' }, 400)
  }
  const store = getStore({ name: ANALYTICS_STORE, consistency: 'strong' })
  try {
    if (action === 'deleteAll') {
      let deleted = 0
      const now = new Date()
      for (let i = 0; i < 90 && deleted < 5000; i++) {
        const d = new Date(now.getTime() - i * 86_400_000)
        const { blobs } = await store.list({ prefix: `e/${dayKeyUtc(d)}/` })
        for (const b of blobs) {
          const ev = (await store.get(b.key, { type: 'json' }).catch(() => null)) as StoredEvent | null
          if (ev && ev.ev === 'feedback') {
            await store.delete(b.key)
            deleted++
          }
        }
      }
      return json({ ok: true, deleted })
    }
    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((x): x is string => typeof x === 'string' && KEY_RE.test(x)).slice(0, MAX_IDS)
      : []
    if (!ids.length) return json({ error: 'No valid note ids.' }, 400)
    let n = 0
    for (const id of ids) {
      const ev = (await store.get(id, { type: 'json' }).catch(() => null)) as StoredEvent | null
      if (!ev || ev.ev !== 'feedback') continue // never touch other event types
      if (action === 'delete') {
        await store.delete(id)
        n++
      } else {
        ev.archived = action === 'archive'
        await store.setJSON(id, ev)
        n++
      }
    }
    const resultKey = action === 'delete' ? 'deleted' : action === 'archive' ? 'archived' : 'unarchived'
    return json({ ok: true, [resultKey]: n })
  } catch (err) {
    console.error('analytics-manage failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not update the notes.' }, 502)
  }
}
