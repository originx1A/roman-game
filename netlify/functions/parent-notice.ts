import { json } from '../lib/http.ts'
import {
  cancelParentNotice,
  deliverUserNotice,
  scheduleParentNotice,
} from '../lib/parentNoticeStore.ts'
import { userFromRequest } from '../lib/supabaseUser.ts'
import {
  followUpAt,
  parentCancelPage,
  parentMailEnabled,
  type ParentCancelState,
  type ParentNotice,
} from '../../src/game/parentNotice.ts'

function siteOrigin(): string {
  const raw = process.env.DEPLOY_PRIME_URL || process.env.URL || 'http://localhost:8888'
  return raw.replace(/\/$/, '')
}

function html(state: ParentCancelState, status = 200): Response {
  return new Response(parentCancelPage(state), {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}

function statusBody(notice: ParentNotice | null) {
  const mail = parentMailEnabled(process.env.ACCOUNT_LEDGER_ENABLED, process.env.RESEND_API_KEY)
  if (!notice) return { ok: true, scheduled: false, mail }
  return {
    ok: true,
    scheduled: notice.cancelledAt == null,
    confirmAt: notice.createdAt,
    followUpAt: followUpAt(notice.createdAt),
    confirmSent: notice.confirmSentAt != null,
    followUpSent: notice.followUpSentAt != null,
    cancelled: notice.cancelledAt != null,
    databaseDeleted: notice.databaseDeleted,
    mail,
  }
}

/**
 * Parent confirmation and the day-later cancel link.
 * POST schedules the notice for a guardian account.
 * GET ?cancel= token runs the cancel.
 * GET with a session reports the schedule. It does not return the email or the token.
 * Mail and the database delete stay off unless ACCOUNT_LEDGER_ENABLED=1.
 */
export default async function parentNotice(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === 'GET' && url.searchParams.has('cancel')) {
    const token = url.searchParams.get('cancel') || ''
    try {
      const result = await cancelParentNotice(token)
      return html(result)
    } catch (err) {
      console.error('parent notice cancel', err instanceof Error ? err.message : 'error')
      return html('error', 503)
    }
  }

  const user = await userFromRequest(req)
  if (!user) return json({ error: 'Sign in first.' }, 401)

  if (req.method === 'GET') {
    try {
      const notice = await deliverUserNotice(user.id, siteOrigin())
      return json(statusBody(notice))
    } catch (err) {
      console.error('parent notice read', err instanceof Error ? err.message : 'error')
      return json({ error: 'Try again in a minute.' }, 503)
    }
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let guardian = false
  let nickname: unknown = null
  try {
    const body = await req.json() as { guardian?: unknown; nickname?: unknown }
    guardian = body.guardian === true
    nickname = body.nickname
  } catch {
    guardian = false
  }
  if (!guardian || !user.email) return json({ ok: true, scheduled: false })
  try {
    const notice = await scheduleParentNotice({
      userId: user.id,
      email: user.email,
      nickname,
      now: Date.now(),
    })
    if (!notice) return json({ ok: true, scheduled: false })
    const sent = await deliverUserNotice(user.id, siteOrigin())
    return json(statusBody(sent ?? notice))
  } catch (err) {
    console.error('parent notice schedule', err instanceof Error ? err.message : 'error')
    return json({ error: 'Try again in a minute.' }, 503)
  }
}
