import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { json } from '../lib/http.ts'
import {
  OWNER_KEY_ENV,
  OWNER_SESSION_STORE,
  TOKEN_PREFIX,
  credentialsOf,
  credentialsOk,
  makeOwnerToken,
  ownerKeyConfigured,
  readNotBefore,
  slowNo,
  verifyOwnerToken,
} from '../lib/ownerAuth.ts'
import { ownerKeyMatches } from '../lib/gifts.ts'

/**
 * Owner login (10.09 admin lock).
 * GET → {configured, env} (never returns the password).
 * POST {key} → password check → {ok, token, expiresAt}. The owner page keeps the token on that device.
 * POST {token} → is this saved login still good? → {ok, expiresAt}.
 * POST {action:'logoutAll', token|key} → every saved login on every device stops working.
 * Too many wrong passwords from one network → 429 for 15 minutes (only a salted hash of the IP is kept, briefly).
 */
const FAIL_MAX = 8
const FAIL_WINDOW_MS = 15 * 60_000

type Store = ReturnType<typeof getStore>

function failKey(ip: string | undefined): string | null {
  if (!ip) return null
  const day = new Date().toISOString().slice(0, 10)
  return `fail/${createHash('sha256').update(`${day}:${ip}:${process.env[OWNER_KEY_ENV] ?? ''}`).digest('hex').slice(0, 32)}`
}

async function failState(store: Store | null, k: string | null): Promise<{ count: number; first: number }> {
  if (!store || !k) return { count: 0, first: 0 }
  try {
    const j = (await store.get(k, { type: 'json' })) as { count?: number; first?: number } | null
    if (j && typeof j.count === 'number' && typeof j.first === 'number' && Date.now() - j.first < FAIL_WINDOW_MS) return { count: j.count, first: j.first }
  } catch {
    /* ignore */
  }
  return { count: 0, first: 0 }
}

export default async function giftStatus(req: Request, context?: Context): Promise<Response> {
  const configured = ownerKeyConfigured()
  if (req.method === 'GET') return json({ configured, env: OWNER_KEY_ENV })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!configured) return json({ configured: false, env: OWNER_KEY_ENV, ok: false }, 503)
  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return json({ ok: false }, 400)
  }
  let store: Store | null = null
  try {
    store = getStore({ name: OWNER_SESSION_STORE, consistency: 'strong' })
  } catch {
    store = null
  }
  const notBefore = await readNotBefore(store)

  if (body.action === 'logoutAll') {
    if (!credentialsOk(credentialsOf(req, body), process.env, Date.now(), notBefore)) {
      await slowNo()
      return json({ configured: true, ok: false }, 401)
    }
    if (!store) return json({ ok: false, error: 'Could not reach storage.' }, 502)
    await store.setJSON('notBefore', { t: Date.now() })
    return json({ configured: true, ok: true, loggedOutAll: true })
  }

  // saved login check
  const token = typeof body.token === 'string' ? body.token : typeof body.key === 'string' && body.key.startsWith(TOKEN_PREFIX) ? body.key : ''
  if (token) {
    const p = verifyOwnerToken(token, process.env, Date.now(), notBefore)
    if (!p) return json({ configured: true, ok: false, expired: true }, 401)
    return json({ configured: true, ok: true, expiresAt: new Date(p.exp).toISOString() })
  }

  // password login, with a per-network lockout
  const fk = failKey(context?.ip)
  const fs = await failState(store, fk)
  if (fs.count >= FAIL_MAX) {
    const wait = Math.ceil((fs.first + FAIL_WINDOW_MS - Date.now()) / 60_000)
    return json({ configured: true, ok: false, error: `Too many wrong tries. Wait ${Math.max(1, wait)} min.` }, 429)
  }
  const ok = ownerKeyMatches(body.key)
  if (!ok) {
    if (store && fk) {
      try {
        await store.setJSON(fk, { count: fs.count + 1, first: fs.first || Date.now() })
      } catch {
        /* ignore */
      }
    }
    await slowNo()
    return json({ configured: true, ok: false }, 401)
  }
  if (store && fk && fs.count) {
    try {
      await store.delete(fk)
    } catch {
      /* ignore */
    }
  }
  const t = makeOwnerToken()
  return json({ configured: true, ok: true, token: t?.token, expiresAt: t?.expiresAt })
}
