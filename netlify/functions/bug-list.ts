import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { ownerKeyMatches } from '../lib/gifts.ts'
import { BUG_STORE, type BugReport } from './bug-submit.ts'

/** Owner only: POST {key} → {reports: BugReport[]}. Newest first. */
export default async function bugList(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let body: { key?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (!ownerKeyMatches(body.key)) {
    await new Promise((r) => setTimeout(r, 600))
    return json({ error: 'Wrong owner passphrase.' }, 401)
  }
  try {
    const store = getStore({ name: BUG_STORE, consistency: 'strong' })
    const { blobs } = await store.list()
    const reports: BugReport[] = []
    for (const b of blobs) {
      const r = (await store.get(b.key, { type: 'json' })) as BugReport | null
      if (r && r.id) reports.push(r)
    }
    reports.sort((a, b) => b.createdAt - a.createdAt)
    return json({ ok: true, reports })
  } catch (err) {
    console.error('bug-list failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not load reports.' }, 502)
  }
}
