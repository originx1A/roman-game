import { getSupabase } from '../cloud/cloud'

export interface AuthConfig {
  passkey: boolean
  google: boolean
  vapidPublic: string
}

export async function loadAuthConfig(): Promise<AuthConfig> {
  try {
    const res = await fetch('/api/auth-config')
    if (!res.ok) return { passkey: false, google: false, vapidPublic: '' }
    const data = (await res.json()) as Partial<AuthConfig>
    return {
      passkey: !!data.passkey,
      google: !!data.google,
      vapidPublic: typeof data.vapidPublic === 'string' ? data.vapidPublic : '',
    }
  } catch {
    return { passkey: false, google: false, vapidPublic: '' }
  }
}

function keyBytes(publicKey: string): Uint8Array {
  const pad = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const b64 = (publicKey + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Ask for a ping, then store the browser endpoint on this player. */
export async function enablePush(): Promise<boolean> {
  const cfg = await loadAuthConfig()
  if (!cfg.vapidPublic || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(cfg.vapidPublic) as BufferSource,
  })
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false
  const sb = await getSupabase()
  const uid = (await sb?.auth.getSession())?.data.session?.user.id
  if (!sb || !uid) return false
  const { error } = await sb.from('push_subs').upsert(
    { player_id: uid, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: 'player_id,endpoint' },
  )
  return !error
}
