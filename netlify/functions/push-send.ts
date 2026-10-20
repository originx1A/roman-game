import webpush from 'web-push'
import { json } from '../lib/http.ts'
import { bearer, supabaseAdmin, supabaseAsUser } from '../lib/supabaseAdmin.ts'

/** Tell a friend about a challenge. Skips quietly when push is not configured. */
export default async function pushSend(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:play@romansgame.com'
  const admin = supabaseAdmin()
  if (!pub || !priv || !admin) return json({ ok: true, skipped: true })

  const token = bearer(req)
  if (!token) return json({ ok: false }, 401)
  const user = await supabaseAsUser(token).auth.getUser(token)
  const uid = user.data.user?.id
  if (!uid) return json({ ok: false }, 401)

  let toName = ''
  let title = "Roman's Game"
  let body = 'A friend challenged you.'
  try {
    const payload = (await req.json()) as { toName?: unknown; title?: unknown; body?: unknown }
    toName = typeof payload.toName === 'string' ? payload.toName.trim() : ''
    if (typeof payload.title === 'string' && payload.title.trim()) title = payload.title.trim().slice(0, 80)
    if (typeof payload.body === 'string' && payload.body.trim()) body = payload.body.trim().slice(0, 180)
  } catch {
    return json({ ok: false }, 400)
  }
  if (!toName) return json({ ok: false }, 400)

  const { data: players } = await admin.from('players').select('id, public_name').ilike('public_name', toName).limit(1)
  const other = players?.[0]?.id as string | undefined
  if (!other || other === uid) return json({ ok: true, skipped: true })

  const { data: subs } = await admin.from('push_subs').select('endpoint, p256dh, auth').eq('player_id', other)
  if (!subs?.length) return json({ ok: true, skipped: true })

  webpush.setVapidDetails(subject, pub, priv)
  await Promise.all(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: './' }),
        )
        .catch(() => undefined),
    ),
  )
  return json({ ok: true })
}
