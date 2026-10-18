import { randomBytes } from 'node:crypto'
import { AUDIO_PRODUCTS, purchaseBySlug } from '../../src/store/catalog.ts'
import { isCheckoutSessionId } from './stripeServer.ts'

export const AUDIO_GRANT_STORE = 'roman-audiobook-grants'
export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000
export const MAX_DOWNLOADS_PER_PRODUCT = 10

/** The part of a Netlify Blobs store these grants use. Tests pass an in-memory one. */
export interface BlobStore {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean }): Promise<{ modified: boolean }>
}

export interface AudioGrant {
  token: string
  sessionId: string
  email: string | null
  purchaseSlug: string
  title: string
  slugs: string[]
  createdAt: number
  expiresAt: number
  downloads: Record<string, number>
  emailed: boolean
}

export interface PaidSession {
  id: string
  payment_status: string | null
  status: string | null
  currency: string | null
  amount_subtotal: number | null
  email: string | null
  store: string | null
  slug: string | null
}

export function memoryBlobStore(): BlobStore {
  const data = new Map<string, unknown>()
  return {
    async get(key) {
      return data.has(key) ? data.get(key) : null
    },
    async setJSON(key, value, opts) {
      if (opts?.onlyIfNew && data.has(key)) return { modified: false }
      data.set(key, structuredClone(value))
      return { modified: true }
    },
  }
}

export function sessionKey(sessionId: string): string {
  return `session:${sessionId}`
}

export function tokenKey(token: string): string {
  return `token:${token}`
}

/** 32 bytes, base64url, no padding. */
export function isDownloadToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function makeDownloadToken(): string {
  return randomBytes(32).toString('base64url')
}

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]+$/.test(value)
}

export function parseGrant(raw: unknown): AudioGrant | null {
  if (!raw || typeof raw !== 'object') return null
  const grant = raw as Record<string, unknown>
  if (!isDownloadToken(grant.token)) return null
  if (!isCheckoutSessionId(grant.sessionId)) return null
  if (!isSlug(grant.purchaseSlug)) return null
  if (typeof grant.title !== 'string' || !grant.title) return null
  if (!Array.isArray(grant.slugs) || grant.slugs.length === 0 || !grant.slugs.every(isSlug)) return null
  if (typeof grant.createdAt !== 'number' || typeof grant.expiresAt !== 'number') return null
  if (typeof grant.emailed !== 'boolean') return null
  if (grant.email !== null && typeof grant.email !== 'string') return null
  if (!grant.downloads || typeof grant.downloads !== 'object' || Array.isArray(grant.downloads)) return null
  const downloads: Record<string, number> = {}
  for (const [slug, count] of Object.entries(grant.downloads as Record<string, unknown>)) {
    if (!isSlug(slug) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null
    downloads[slug] = count
  }
  return {
    token: grant.token,
    sessionId: grant.sessionId,
    email: grant.email,
    purchaseSlug: grant.purchaseSlug,
    title: grant.title,
    slugs: grant.slugs,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
    downloads,
    emailed: grant.emailed,
  }
}

export function normalizeCheckoutSession(session: {
  id: string
  payment_status?: string | null
  status?: string | null
  currency?: string | null
  amount_subtotal?: number | null
  customer_email?: string | null
  customer_details?: { email?: string | null } | null
  metadata?: { store?: string | null; slug?: string | null } | null
}): PaidSession {
  return {
    id: session.id,
    payment_status: session.payment_status ?? null,
    status: session.status ?? null,
    currency: session.currency ?? null,
    amount_subtotal: session.amount_subtotal ?? null,
    email: session.customer_details?.email || session.customer_email || null,
    store: session.metadata?.store ?? null,
    slug: session.metadata?.slug ?? null,
  }
}

export type ClaimResult =
  | { ok: true; grant: AudioGrant }
  | { ok: false; reason: 'expired' | 'not-included' | 'limit' }

/** Pure check. Does not mutate the grant. A slug must be one of the paid stories this purchase granted. */
export function claimDownload(grant: AudioGrant, slug: string, now = Date.now()): ClaimResult {
  if (now >= grant.expiresAt) return { ok: false, reason: 'expired' }
  const product = AUDIO_PRODUCTS.find((item) => item.slug === slug && item.priceCents > 0)
  if (!product || !grant.slugs.includes(slug)) return { ok: false, reason: 'not-included' }
  const used = grant.downloads[slug] ?? 0
  if (used >= MAX_DOWNLOADS_PER_PRODUCT) return { ok: false, reason: 'limit' }
  return {
    ok: true,
    grant: { ...grant, downloads: { ...grant.downloads, [slug]: used + 1 } },
  }
}

async function rememberToken(store: BlobStore, grant: AudioGrant): Promise<AudioGrant> {
  const saved = parseGrant(await store.get(tokenKey(grant.token), { type: 'json' }))
  if (saved) return saved
  await store.setJSON(tokenKey(grant.token), grant)
  return grant
}

/** Records a paid audiobook session once. The same session always returns the same token. */
export async function fulfillPaidSession(store: BlobStore, session: PaidSession, now = Date.now(), token = makeDownloadToken()): Promise<AudioGrant | null> {
  if (session.store !== 'audiobook' || !isCheckoutSessionId(session.id)) return null
  const purchase = session.slug ? purchaseBySlug(session.slug) : null
  if (!purchase) return null
  if (session.payment_status !== 'paid' || session.status !== 'complete') return null
  if (session.currency !== 'cad' || session.amount_subtotal !== purchase.priceCents) return null

  const existing = parseGrant(await store.get(sessionKey(session.id), { type: 'json' }))
  if (existing) return rememberToken(store, existing)

  const grant: AudioGrant = {
    token,
    sessionId: session.id,
    email: session.email,
    purchaseSlug: purchase.slug,
    title: purchase.title,
    slugs: purchase.slugs,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
    downloads: {},
    emailed: false,
  }
  const created = await store.setJSON(sessionKey(session.id), grant, { onlyIfNew: true })
  if (!created.modified) {
    const raced = parseGrant(await store.get(sessionKey(session.id), { type: 'json' }))
    return raced ? rememberToken(store, raced) : null
  }
  await store.setJSON(tokenKey(grant.token), grant)
  return grant
}

export async function recordDownload(store: BlobStore, token: string, slug: string, now = Date.now()): Promise<ClaimResult | { ok: false; reason: 'missing' }> {
  if (!isDownloadToken(token)) return { ok: false, reason: 'missing' }
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = parseGrant(await store.get(tokenKey(token), { type: 'json' }))
    if (!current) return { ok: false, reason: 'missing' }
    const claimed = claimDownload(current, slug, now)
    if (!claimed.ok) return claimed
    const count = claimed.grant.downloads[slug]
    const slot = await store.setJSON(`count:${token}:${slug}:${count}`, { at: now }, { onlyIfNew: true })
    if (!slot.modified) continue
    await store.setJSON(tokenKey(token), claimed.grant)
    await store.setJSON(sessionKey(current.sessionId), claimed.grant)
    return claimed
  }
  return { ok: false, reason: 'limit' }
}

export async function markEmailed(store: BlobStore, token: string): Promise<void> {
  const current = parseGrant(await store.get(tokenKey(token), { type: 'json' }))
  if (!current || current.emailed) return
  const next = { ...current, emailed: true }
  await store.setJSON(tokenKey(token), next)
  await store.setJSON(sessionKey(current.sessionId), next)
}

export function thanksView(grant: AudioGrant, now = Date.now()) {
  return {
    title: grant.title,
    token: grant.token,
    expiresAt: grant.expiresAt,
    expired: now >= grant.expiresAt,
    items: grant.slugs.map((slug) => {
      const product = AUDIO_PRODUCTS.find((item) => item.slug === slug)
      const used = grant.downloads[slug] ?? 0
      return {
        slug,
        title: product?.title ?? slug,
        runtime: product?.runtime ?? '',
        downloadsRemaining: Math.max(0, MAX_DOWNLOADS_PER_PRODUCT - used),
      }
    }),
  }
}
