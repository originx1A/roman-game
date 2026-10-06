import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'

export const BUG_STORE = 'roman-bug-reports'

export interface BugReport {
  id: string
  createdAt: number
  description: string
  screen: string
  userAgent: string
  resolved: boolean
}

/** Player → POST {description, screen?, userAgent?} → {ok, id}. No auth needed. */
export default async function bugSubmit(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let body: { description?: unknown; screen?: unknown; userAgent?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : ''
  if (!description) return json({ error: 'Please describe what happened.' }, 400)
  const report: BugReport = {
    id: `bug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    description,
    screen: typeof body.screen === 'string' ? body.screen.slice(0, 50) : 'unknown',
    userAgent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 200) : '',
    resolved: false,
  }
  try {
    const store = getStore({ name: BUG_STORE, consistency: 'strong' })
    await store.setJSON(report.id, report)
    return json({ ok: true, id: report.id })
  } catch (err) {
    console.error('bug-submit failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not save the report. Try again.' }, 502)
  }
}
