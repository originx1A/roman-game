import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { ownerGate } from '../lib/ownerGate.ts'
import { BUG_STORE, type BugReport } from './bug-submit.ts'

/** Owner only: POST {key} → {reports: BugReport[]}. Newest first. */
export default async function bugList(req: Request): Promise<Response> {
  const gate = await ownerGate(req)
  if (gate.res) return gate.res
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
