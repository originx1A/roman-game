import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { ownerGate } from '../lib/ownerGate.ts'
import { BUG_STORE, type BugReport } from './bug-submit.ts'

/** Owner only: POST {key, id, action: 'resolve'|'reopen'|'delete'} → {ok}. */
export default async function bugResolve(req: Request): Promise<Response> {
  const gate = await ownerGate(req)
  if (gate.res) return gate.res
  const body = gate.body as { key?: unknown; id?: unknown; action?: unknown }
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action
  if (!id || !['resolve', 'reopen', 'delete'].includes(action as string)) {
    return json({ error: 'Bad request.' }, 400)
  }
  try {
    const store = getStore({ name: BUG_STORE, consistency: 'strong' })
    if (action === 'delete') {
      await store.delete(id)
      return json({ ok: true })
    }
    const report = (await store.get(id, { type: 'json' })) as BugReport | null
    if (!report) return json({ error: 'Not found.' }, 404)
    report.resolved = action === 'resolve'
    await store.setJSON(id, report)
    return json({ ok: true })
  } catch (err) {
    console.error('bug-resolve failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not update the report.' }, 502)
  }
}
