import { json } from '../lib/http.ts'
import { deliverDueParentNotices } from '../lib/parentNoticeStore.ts'

function siteOrigin(): string {
  const raw = process.env.DEPLOY_PRIME_URL || process.env.URL || 'http://localhost:8888'
  return raw.replace(/\/$/, '')
}

/**
 * Sends parent notices that are due.
 * Returns before any blob, mail, or database call unless ACCOUNT_LEDGER_ENABLED=1 and RESEND_API_KEY are set.
 * Netlify runs the schedule on production only. Preview can call this URL; with the flag off it sends nothing.
 */
export default async function parentNoticeSend(_req: Request): Promise<Response> {
  try {
    return json(await deliverDueParentNotices(siteOrigin()))
  } catch (err) {
    console.error('parent notice send', err instanceof Error ? err.message : 'error')
    return json({ error: 'unavailable' }, 503)
  }
}
