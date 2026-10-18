/**
 * Daily Kit broadcast, welcome letter, and unsubscribe.
 * Real newsletter sends require KIT_SEND_ENABLED and Netlify CONTEXT=production.
 * KIT_DRY_RUN=true or ?dryRun=1 builds the payload and does not send.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { json } from './http.ts'
import {
  type BroadcastDraft,
  type KitApi,
  createKitClient,
  subscriberFilter,
} from './kitClient.ts'
import { isLowStock, parsePool, unusedStories } from './newsRotation.ts'
import {
  NEWS_INDEX_URL,
  type Story,
  broadcastHtml,
  loadPublishedStories,
  parseStoryPageImage,
  renderRss,
  storyForDate,
} from './newsSource.ts'
import { torontoDateKey, torontoParts, torontoShouldSend } from './newsTime.ts'
import { sendResend } from './resendMail.ts'
import { NEWS_FROM, SUPPORT_EMAIL, WELCOME_TAG, buildWelcomeDelivery } from './welcomeCopy.ts'

export const KIT_NEWS_STORE = 'kit-news'
export const DEFAULT_FORM_ID = 10053148
const LOCK_MS = 2 * 60 * 1000
const STORY_ID_RE = /^[a-z0-9-]{1,120}$/i

export interface JsonStore {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean }): Promise<{ modified?: boolean } | void>
  delete(key: string): Promise<void>
}

export interface NewsEnv {
  KIT_API_KEY?: string
  KIT_SEND_ENABLED?: string
  KIT_DRY_RUN?: string
  KIT_ADMIN_SECRET?: string
  KIT_FORM_ID?: string
  KIT_SEGMENT_ID?: string
  KIT_WEBHOOK_SECRET?: string
  RESEND_API_KEY?: string
  NEWS_POSTAL_ADDRESS?: string
  NEWS_SOURCE_URL?: string
  CONTEXT?: string
  URL?: string
  DEPLOY_PRIME_URL?: string
}

export interface Deps {
  env: NewsEnv
  store: JsonStore
  fetchImpl?: typeof fetch
  kit?: KitApi
  now?: Date
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export interface JobResult {
  ok: boolean
  action: string
  reason?: string
  storyId?: string
  broadcastId?: number
  dryRun?: boolean
}

export function logNews(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), component: 'kit-news', ...entry }))
}

export function truthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? '')
}

export function formIdOf(env: NewsEnv): number {
  const raw = env.KIT_FORM_ID?.trim() || String(DEFAULT_FORM_ID)
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : DEFAULT_FORM_ID
}

export function formTagName(env: NewsEnv): string {
  return `form-${formIdOf(env)}`
}

export function newsletterEnabled(env: NewsEnv): boolean {
  return env.CONTEXT === 'production' && truthy(env.KIT_SEND_ENABLED) && Boolean(env.KIT_API_KEY?.trim())
}

export function isDryRun(env: NewsEnv, url?: URL): boolean {
  return truthy(env.KIT_DRY_RUN) || url?.searchParams.get('dryRun') === '1'
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function emailHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

/** Constant-time compare. An unset expected secret never matches. */
export function safeEqual(provided: string, expected: string | undefined): boolean {
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length))
    return false
  }
  return timingSafeEqual(a, b)
}

export function siteOrigin(env: NewsEnv): string {
  const raw = env.CONTEXT === 'production' ? env.URL || env.DEPLOY_PRIME_URL : env.DEPLOY_PRIME_URL || env.URL
  return (raw || 'http://localhost:8888').replace(/\/$/, '')
}

export function memoryJsonStore(): JsonStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  let tail = Promise.resolve()
  const lock = <T>(fn: () => T): Promise<T> => {
    const run = tail.then(() => fn())
    tail = run.then(() => undefined, () => undefined)
    return run
  }
  return {
    data,
    get(key) {
      return lock(() => (data.has(key) ? structuredClone(data.get(key)) : null))
    },
    setJSON(key, value, opts) {
      return lock(() => {
        if (opts?.onlyIfNew && data.has(key)) return { modified: false }
        data.set(key, structuredClone(value))
        return { modified: true }
      })
    },
    delete(key) {
      return lock(() => {
        data.delete(key)
      })
    },
  }
}

function wrote(result: { modified?: boolean } | void): boolean {
  if (!result) return true
  return result.modified !== false
}

async function insertNew(store: JsonStore, key: string, value: unknown): Promise<boolean> {
  try {
    return wrote(await store.setJSON(key, value, { onlyIfNew: true }))
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    const message = err instanceof Error ? err.message : ''
    if (name === 'BlobAlreadyExistsError' || /already exists/i.test(message)) return false
    throw err
  }
}

function kitFor(deps: Deps): KitApi {
  if (deps.kit) return deps.kit
  const key = deps.env.KIT_API_KEY?.trim() ?? ''
  return createKitClient({
    apiKey: key,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
    random: deps.random,
  })
}

interface SendRecord {
  status: 'sending' | 'sent' | 'failed'
  at: string
  storyId: string
  broadcastId?: number
  error?: string
}

function asSendRecord(raw: unknown): SendRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<SendRecord>
  if (row.status !== 'sending' && row.status !== 'sent' && row.status !== 'failed') return null
  if (typeof row.at !== 'string' || typeof row.storyId !== 'string') return null
  return {
    status: row.status,
    at: row.at,
    storyId: row.storyId,
    broadcastId: typeof row.broadcastId === 'number' ? row.broadcastId : undefined,
    error: typeof row.error === 'string' ? row.error : undefined,
  }
}

function broadcastKey(storyId: string): string {
  return `broadcast/${storyId}`
}

async function claimBroadcast(store: JsonStore, storyId: string, now: number, force: boolean): Promise<'go' | 'skip' | 'busy'> {
  const key = broadcastKey(storyId)
  const existing = asSendRecord(await store.get(key, { type: 'json' }))
  if (existing?.status === 'sent' && !force) return 'skip'
  if (existing?.status === 'sending' && !force && now - Date.parse(existing.at) < LOCK_MS) return 'busy'
  const next: SendRecord = { status: 'sending', at: new Date(now).toISOString(), storyId }
  if (!existing) {
    const won = await insertNew(store, key, next)
    return won ? 'go' : 'busy'
  }
  await store.setJSON(key, next)
  return 'go'
}

export function broadcastDraft(story: Story, target: { type: 'segment' | 'tag'; id: number }, sendAt: Date): BroadcastDraft {
  const published = new Date(`${story.date}T13:07:00.000Z`)
  const draft: BroadcastDraft = {
    subject: story.title,
    preview_text: story.excerpt.slice(0, 140),
    description: story.excerpt.slice(0, 500),
    content: broadcastHtml(story),
    public: false,
    published_at: Number.isNaN(published.getTime()) ? sendAt.toISOString() : published.toISOString(),
    send_at: new Date(sendAt.getTime() + 60_000).toISOString(),
    subscriber_filter: subscriberFilter(target),
  }
  if (story.image) {
    draft.thumbnail_url = story.image
    draft.thumbnail_alt = story.title.slice(0, 140)
  }
  return draft
}

async function resolveTarget(deps: Deps, kit: KitApi): Promise<{ type: 'segment' | 'tag'; id: number; name: string }> {
  const segment = deps.env.KIT_SEGMENT_ID?.trim()
  if (segment && /^\d+$/.test(segment)) {
    return { type: 'segment', id: Number(segment), name: `segment ${segment}` }
  }
  const name = formTagName(deps.env)
  const id = await kit.ensureTag(name)
  return { type: 'tag', id, name }
}

async function alertSupport(deps: Deps, subject: string, text: string): Promise<void> {
  const apiKey = deps.env.RESEND_API_KEY?.trim()
  if (deps.env.CONTEXT !== 'production' || !apiKey) {
    logNews({ level: 'error', msg: 'ERROR support alert not sent', subject, detail: text })
    return
  }
  try {
    const sent = await sendResend(apiKey, {
      from: NEWS_FROM,
      to: SUPPORT_EMAIL,
      subject,
      text,
      html: `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`,
    }, deps.fetchImpl)
    if (!sent.ok) logNews({ level: 'error', msg: 'ERROR support alert rejected', status: sent.status, subject })
  } catch (err) {
    logNews({ level: 'error', msg: 'ERROR support alert failed', subject, detail: err instanceof Error ? err.message : 'error' })
  }
}

async function maybeLowStock(deps: Deps, now: Date): Promise<void> {
  const raw = await deps.store.get('story-pool', { type: 'json' })
  const pool = parsePool(raw)
  if (!pool || !isLowStock(pool)) return
  const unused = unusedStories(pool).length
  const day = torontoDateKey(now)
  const key = `alerts/low-stock/${day}`
  const claimed = await insertNew(deps.store, key, { at: now.toISOString(), unused })
  if (!claimed) return
  logNews({ level: 'warn', msg: 'story pool low', unused, under: 14 })
  await alertSupport(
    deps,
    "Roman's World News: story pool is low",
    `Fewer than 14 unused stories remain in the story pool (${unused} unused). Add stories before the queue runs out.`,
  )
}

async function enrichImage(story: Story, fetchImpl: typeof fetch): Promise<Story> {
  if (story.image) return story
  try {
    const res = await fetchImpl(story.link, { headers: { accept: 'text/html' } })
    if (!res.ok) return story
    const image = parseStoryPageImage(await res.text(), story.link)
    return image ? { ...story, image } : story
  } catch {
    return story
  }
}

export async function deliverStory(deps: Deps, story: Story, opts: { dryRun: boolean; force: boolean }): Promise<JobResult> {
  const now = deps.now ?? new Date()
  const fetchImpl = deps.fetchImpl ?? fetch
  const full = await enrichImage(story, fetchImpl)
  const previewTarget = deps.env.KIT_SEGMENT_ID?.trim() && /^\d+$/.test(deps.env.KIT_SEGMENT_ID)
    ? { type: 'segment' as const, id: Number(deps.env.KIT_SEGMENT_ID), name: `segment ${deps.env.KIT_SEGMENT_ID}` }
    : { type: 'tag' as const, id: 0, name: formTagName(deps.env) }

  if (opts.dryRun) {
    const payload = broadcastDraft(full, { type: previewTarget.type, id: previewTarget.id }, now)
    logNews({
      level: 'info',
      msg: 'dry-run',
      storyId: full.id,
      filter: previewTarget.name,
      sendDisabled: !newsletterEnabled(deps.env),
      payload,
    })
    return { ok: true, action: 'dry-run', dryRun: true, storyId: full.id }
  }

  if (!newsletterEnabled(deps.env)) {
    logNews({ level: 'info', msg: 'send disabled', job: 'broadcast', storyId: full.id })
    return { ok: true, action: 'skipped', reason: 'send disabled', storyId: full.id }
  }

  const claim = await claimBroadcast(deps.store, full.id, now.getTime(), opts.force)
  if (claim === 'skip') {
    logNews({ level: 'info', msg: 'already sent', storyId: full.id })
    const prior = asSendRecord(await deps.store.get(broadcastKey(full.id), { type: 'json' }))
    return { ok: true, action: 'skipped', reason: 'already-sent', storyId: full.id, broadcastId: prior?.broadcastId }
  }
  if (claim === 'busy') {
    logNews({ level: 'info', msg: 'send in progress', storyId: full.id })
    return { ok: true, action: 'skipped', reason: 'in-progress', storyId: full.id }
  }

  const kit = kitFor(deps)
  try {
    const target = await resolveTarget(deps, kit)
    const payload = broadcastDraft(full, target, now)
    logNews({ level: 'info', msg: 'sending broadcast', storyId: full.id, filter: target.name })
    const broadcastId = await kit.createBroadcast(payload)
    await deps.store.setJSON(broadcastKey(full.id), {
      status: 'sent',
      at: new Date().toISOString(),
      storyId: full.id,
      broadcastId,
    })
    logNews({ level: 'info', msg: 'broadcast sent', storyId: full.id, broadcastId })
    return { ok: true, action: 'sent', storyId: full.id, broadcastId }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error'
    await deps.store.setJSON(broadcastKey(full.id), {
      status: 'failed',
      at: new Date().toISOString(),
      storyId: full.id,
      error: detail,
    })
    logNews({ level: 'error', msg: 'ERROR broadcast failed', storyId: full.id, detail })
    await alertSupport(deps, "Roman's World News send failed", `Story ${full.id} did not send. ${detail}`)
    return { ok: false, action: 'failed', reason: detail, storyId: full.id }
  }
}

async function catalog(deps: Deps): Promise<Story[]> {
  return loadPublishedStories(deps.fetchImpl ?? fetch, deps.env.NEWS_SOURCE_URL?.trim() || NEWS_INDEX_URL)
}

export async function runDaily(deps: Deps, opts: { dryRun: boolean; ignoreSchedule?: boolean }): Promise<JobResult> {
  const now = deps.now ?? new Date()
  const parts = torontoParts(now)
  if (!opts.ignoreSchedule && !opts.dryRun && !torontoShouldSend(now)) {
    logNews({ level: 'info', msg: 'outside toronto send window', date: parts.dateKey, hour: parts.hour, minute: parts.minute })
    return { ok: true, action: 'skipped', reason: 'schedule' }
  }
  if (!opts.dryRun) {
    try {
      await retryPendingUnsubscribes(deps)
      await flushPending(deps)
      await maybeLowStock(deps, now)
    } catch (err) {
      logNews({ level: 'error', msg: 'ERROR low-stock check failed', detail: err instanceof Error ? err.message : 'error' })
    }
  }
  let stories: Story[]
  try {
    stories = await catalog(deps)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error'
    logNews({ level: 'error', msg: 'ERROR news index unavailable', detail })
    if (!opts.dryRun && newsletterEnabled(deps.env)) {
      await alertSupport(deps, "Roman's World News send failed", `The news index could not be read. ${detail}`)
    }
    return { ok: false, action: 'failed', reason: 'news-index' }
  }
  const story = storyForDate(stories, parts.dateKey)
  if (!story) {
    logNews({ level: 'info', msg: 'no story for toronto date', date: parts.dateKey })
    return { ok: true, action: 'skipped', reason: 'no-story' }
  }
  return deliverStory(deps, story, { dryRun: opts.dryRun, force: false })
}

export async function sendRequested(deps: Deps, opts: { storyId?: string; force: boolean; dryRun: boolean }): Promise<JobResult> {
  const now = deps.now ?? new Date()
  let stories: Story[]
  try {
    stories = await catalog(deps)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error'
    logNews({ level: 'error', msg: 'ERROR news index unavailable', detail })
    return { ok: false, action: 'failed', reason: 'news-index' }
  }
  const story = opts.storyId
    ? stories.find((item) => item.id === opts.storyId) ?? null
    : storyForDate(stories, torontoDateKey(now))
  if (!story) {
    logNews({ level: 'info', msg: opts.storyId ? 'story not in the published index' : 'no story for toronto date', storyId: opts.storyId, date: torontoDateKey(now) })
    return { ok: false, action: 'skipped', reason: opts.storyId ? 'unknown-story' : 'no-story' }
  }
  return deliverStory(deps, story, { dryRun: opts.dryRun, force: opts.force })
}

interface WelcomeRecord {
  status: 'pending' | 'sent' | 'failed'
  at: string
  email: string
}

function asWelcome(raw: unknown): WelcomeRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<WelcomeRecord>
  if (row.status !== 'pending' && row.status !== 'sent' && row.status !== 'failed') return null
  if (typeof row.email !== 'string' || typeof row.at !== 'string') return null
  return { status: row.status, at: row.at, email: row.email }
}

function welcomeKey(email: string): string {
  return `welcome/${emailHash(email)}`
}

function suppressedKey(email: string): string {
  return `suppressed/${emailHash(email)}`
}

export async function isSuppressed(store: JsonStore, email: string): Promise<boolean> {
  const raw = await store.get(suppressedKey(email), { type: 'json' })
  return Boolean(raw && typeof raw === 'object')
}

function unsubscribeUrl(env: NewsEnv, token: string): string {
  return `${siteOrigin(env)}/api/kit-unsubscribe?token=${token}`
}

async function ensureToken(store: JsonStore, email: string, subscriberId: number | null): Promise<string> {
  const existing = await store.get(`unsub-email/${emailHash(email)}`, { type: 'json' })
  if (existing && typeof existing === 'object' && typeof (existing as { token?: unknown }).token === 'string') {
    const token = (existing as { token: string }).token
    await store.setJSON(`unsub/${token}`, { email, subscriberId })
    return token
  }
  const token = randomBytes(32).toString('hex')
  await store.setJSON(`unsub/${token}`, { email, subscriberId })
  await store.setJSON(`unsub-email/${emailHash(email)}`, { token })
  return token
}

export async function sendWelcome(deps: Deps, email: string, subscriberId: number | null, opts: { dryRun: boolean }): Promise<JobResult> {
  const normalized = normalizeEmail(email)
  if (await isSuppressed(deps.store, normalized)) {
    logNews({ level: 'info', msg: 'welcome skipped suppressed', emailHash: emailHash(normalized).slice(0, 12) })
    return { ok: true, action: 'skipped', reason: 'suppressed' }
  }
  const key = welcomeKey(normalized)
  const prior = asWelcome(await deps.store.get(key, { type: 'json' }))
  if (prior?.status === 'sent') return { ok: true, action: 'skipped', reason: 'already-sent' }

  const kit = kitFor(deps)
  if (!opts.dryRun && newsletterEnabled(deps.env) && subscriberId != null) {
    try {
      const names = await kit.subscriberTagNames(subscriberId)
      if (names.some((name) => name.toLowerCase() === WELCOME_TAG)) {
        await deps.store.setJSON(key, { status: 'sent', at: new Date().toISOString(), email: normalized })
        return { ok: true, action: 'skipped', reason: 'tag' }
      }
    } catch (err) {
      logNews({ level: 'warn', msg: 'welcome tag lookup failed', detail: err instanceof Error ? err.message : 'error' })
    }
  }

  const address = deps.env.NEWS_POSTAL_ADDRESS?.trim() ?? ''
  const token = await ensureToken(deps.store, normalized, subscriberId)
  const delivery = buildWelcomeDelivery({
    to: normalized,
    unsubscribeUrl: unsubscribeUrl(deps.env, token),
    postalAddress: address,
  })

  if (opts.dryRun) {
    logNews({ level: 'info', msg: 'dry-run', job: 'welcome', emailHash: emailHash(normalized).slice(0, 12), subject: delivery.subject })
    return { ok: true, action: 'dry-run', dryRun: true }
  }
  if (!newsletterEnabled(deps.env)) {
    await deps.store.setJSON(key, { status: 'pending', at: new Date().toISOString(), email: normalized })
    await rememberPending(deps.store, normalized)
    logNews({ level: 'info', msg: 'send disabled', job: 'welcome', emailHash: emailHash(normalized).slice(0, 12) })
    return { ok: true, action: 'skipped', reason: 'send disabled' }
  }
  if (!address) {
    logNews({ level: 'error', msg: 'ERROR NEWS_POSTAL_ADDRESS unset', job: 'welcome' })
    return { ok: false, action: 'failed', reason: 'postal-address' }
  }
  const resendKey = deps.env.RESEND_API_KEY?.trim()
  if (!resendKey) {
    logNews({ level: 'error', msg: 'ERROR welcome not sent, RESEND_API_KEY unset' })
    return { ok: false, action: 'failed', reason: 'resend' }
  }
  if (prior?.status !== 'pending') {
    const won = await insertNew(deps.store, key, { status: 'pending', at: new Date().toISOString(), email: normalized })
    if (!won && asWelcome(await deps.store.get(key, { type: 'json' }))?.status === 'sent') {
      return { ok: true, action: 'skipped', reason: 'already-sent' }
    }
  }
  try {
    const sent = await sendResend(resendKey, delivery, deps.fetchImpl)
    if (!sent.ok) throw new Error(`resend HTTP ${sent.status}`)
    await deps.store.setJSON(key, { status: 'sent', at: new Date().toISOString(), email: normalized })
    if (subscriberId != null) {
      try {
        const tagId = await kit.ensureTag(WELCOME_TAG)
        await kit.tagSubscriber(tagId, subscriberId)
      } catch (err) {
        logNews({ level: 'warn', msg: 'welcome tag failed', detail: err instanceof Error ? err.message : 'error' })
      }
    }
    logNews({ level: 'info', msg: 'welcome sent', emailHash: emailHash(normalized).slice(0, 12) })
    return { ok: true, action: 'sent' }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error'
    await deps.store.setJSON(key, { status: 'failed', at: new Date().toISOString(), email: normalized })
    logNews({ level: 'error', msg: 'ERROR welcome failed', detail })
    await alertSupport(deps, "Roman's World News welcome failed", `Welcome email failed. ${detail}`)
    return { ok: false, action: 'failed', reason: detail }
  }
}

async function flushPending(deps: Deps): Promise<void> {
  if (!newsletterEnabled(deps.env) || isDryRun(deps.env)) return
  const index = await deps.store.get('welcome-pending-index', { type: 'json' })
  const hashes = Array.isArray(index) ? index.filter((item): item is string => typeof item === 'string') : []
  for (const hash of hashes) {
    const row = asWelcome(await deps.store.get(`welcome/${hash}`, { type: 'json' }))
    if (!row || row.status === 'sent') continue
    await sendWelcome(deps, row.email, null, { dryRun: false })
  }
}

async function rememberPending(store: JsonStore, email: string): Promise<void> {
  const hash = emailHash(email)
  const raw = await store.get('welcome-pending-index', { type: 'json' })
  const hashes = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
  if (!hashes.includes(hash)) await store.setJSON('welcome-pending-index', [...hashes, hash].slice(-5000))
}

export async function enrollSubscriber(deps: Deps, emailRaw: string, opts: { dryRun: boolean; explicit: boolean }): Promise<JobResult & { fallback?: boolean; status: number }> {
  const email = normalizeEmail(emailRaw)
  if (!validEmail(email)) return { ok: false, action: 'rejected', reason: 'email', status: 400 }
  if (await isSuppressed(deps.store, email)) {
    if (!opts.explicit) {
      logNews({ level: 'info', msg: 'subscribe blocked suppressed', emailHash: emailHash(email).slice(0, 12) })
      return { ok: true, action: 'skipped', reason: 'suppressed', status: 200 }
    }
    await deps.store.delete(suppressedKey(email))
  }
  const productionKey = deps.env.CONTEXT === 'production' && Boolean(deps.env.KIT_API_KEY?.trim())
  if (opts.dryRun || !productionKey) {
    logNews({
      level: 'info',
      msg: opts.dryRun ? 'dry-run' : 'send disabled',
      job: 'subscribe',
      emailHash: emailHash(email).slice(0, 12),
    })
    return {
      ok: !opts.dryRun ? false : true,
      action: opts.dryRun ? 'dry-run' : 'skipped',
      reason: opts.dryRun ? 'dry-run' : 'send disabled',
      dryRun: opts.dryRun,
      fallback: !opts.dryRun && deps.env.CONTEXT === 'production' && !deps.env.KIT_API_KEY?.trim(),
      status: 200,
    }
  }
  const kit = kitFor(deps)
  try {
    const subscriberId = await kit.createSubscriber(email)
    await kit.addToForm(formIdOf(deps.env), subscriberId)
    const tagId = await kit.ensureTag(formTagName(deps.env))
    await kit.tagSubscriber(tagId, subscriberId)
    const welcome = await sendWelcome(deps, email, subscriberId, { dryRun: false })
    return { ...welcome, status: welcome.ok ? 200 : 502 }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error'
    logNews({ level: 'error', msg: 'ERROR subscribe failed', detail })
    await alertSupport(deps, "Roman's World News subscribe failed", `Could not add a subscriber to the news form. ${detail}`)
    return { ok: false, action: 'failed', reason: detail, status: 502 }
  }
}

interface UnsubRecord {
  email: string
  subscriberId: number | null
}

function asUnsub(raw: unknown): UnsubRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<UnsubRecord>
  if (typeof row.email !== 'string') return null
  return { email: normalizeEmail(row.email), subscriberId: typeof row.subscriberId === 'number' ? row.subscriberId : null }
}

export async function unsubscribeByToken(deps: Deps, token: string): Promise<{ ok: boolean; status: number }> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { ok: false, status: 400 }
  const record = asUnsub(await deps.store.get(`unsub/${token}`, { type: 'json' }))
  if (!record) return { ok: false, status: 404 }
  const email = record.email
  await deps.store.setJSON(suppressedKey(email), { at: new Date().toISOString(), email })
  const kitReady = deps.env.CONTEXT === 'production' && Boolean(deps.env.KIT_API_KEY?.trim())
  if (!kitReady) {
    await queuePendingUnsub(deps.store, email, record.subscriberId)
    logNews({ level: 'info', msg: 'send disabled', job: 'unsubscribe', emailHash: emailHash(email).slice(0, 12) })
    return { ok: true, status: 200 }
  }
  try {
    const kit = kitFor(deps)
    const subscriberId = record.subscriberId ?? await kit.findSubscriber(email)
    if (subscriberId == null) throw new Error('subscriber not found')
    await kit.unsubscribe(subscriberId)
    await deps.store.delete(`pending-unsub/${emailHash(email)}`)
    logNews({ level: 'info', msg: 'unsubscribed', emailHash: emailHash(email).slice(0, 12) })
    return { ok: true, status: 200 }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'error'
    await queuePendingUnsub(deps.store, email, record.subscriberId)
    logNews({ level: 'error', msg: 'ERROR kit unsubscribe failed', detail })
    await alertSupport(deps, "Roman's World News unsubscribe failed", `Kit unsubscribe failed and will be retried. ${detail}`)
    return { ok: true, status: 200 }
  }
}

async function retryPendingUnsubscribes(deps: Deps): Promise<void> {
  if (!newsletterEnabled(deps.env)) return
  const kit = kitFor(deps)
  const marker = await deps.store.get('pending-unsub-index', { type: 'json' })
  const hashes = Array.isArray(marker) ? marker.filter((item): item is string => typeof item === 'string') : []
  for (const hash of hashes) {
    const raw = await deps.store.get(`pending-unsub/${hash}`, { type: 'json' })
    const row = raw && typeof raw === 'object' ? raw as { email?: unknown; subscriberId?: unknown } : null
    if (!row || typeof row.email !== 'string') continue
    try {
      const subscriberId = typeof row.subscriberId === 'number' ? row.subscriberId : await kit.findSubscriber(row.email)
      if (subscriberId == null) continue
      await kit.unsubscribe(subscriberId)
      await deps.store.delete(`pending-unsub/${hash}`)
    } catch (err) {
      logNews({ level: 'error', msg: 'ERROR pending unsubscribe retry failed', detail: err instanceof Error ? err.message : 'error' })
    }
  }
}

async function queuePendingUnsub(store: JsonStore, email: string, subscriberId: number | null): Promise<void> {
  const hash = emailHash(email)
  await store.setJSON(`pending-unsub/${hash}`, { email, subscriberId, at: new Date().toISOString() })
  const raw = await store.get('pending-unsub-index', { type: 'json' })
  const hashes = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
  if (!hashes.includes(hash)) await store.setJSON('pending-unsub-index', [...hashes, hash].slice(-5000))
}

async function readPayload(req: Request): Promise<{ email?: string; source?: string; storyId?: string; force?: unknown }> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    try {
      const body = await req.json() as { email?: unknown; email_address?: unknown; source?: unknown; storyId?: unknown; story?: unknown; force?: unknown }
      return {
        email: typeof body.email === 'string' ? body.email : typeof body.email_address === 'string' ? body.email_address : undefined,
        source: typeof body.source === 'string' ? body.source : undefined,
        storyId: typeof body.storyId === 'string' ? body.storyId : typeof body.story === 'string' ? body.story : undefined,
        force: body.force,
      }
    } catch {
      return {}
    }
  }
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const form = await req.formData()
    const email = form.get('email_address') ?? form.get('email')
    const story = form.get('storyId') ?? form.get('story')
    const force = form.get('force')
    return {
      email: typeof email === 'string' ? email : undefined,
      storyId: typeof story === 'string' ? story : undefined,
      force: typeof force === 'string' ? force : undefined,
    }
  }
  return {}
}

function wantsHtml(req: Request): boolean {
  const type = req.headers.get('content-type') ?? ''
  return type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')
}

export async function handleDaily(req: Request, deps: Deps): Promise<Response> {
  const url = new URL(req.url)
  const result = await runDaily({ ...deps, now: deps.now ?? new Date() }, { dryRun: isDryRun(deps.env, url) })
  return json(result, result.ok ? 200 : 502)
}

export async function handleSendNow(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!safeEqual(req.headers.get('x-kit-admin-secret') ?? '', deps.env.KIT_ADMIN_SECRET)) {
    return json({ error: 'unauthorized' }, 401)
  }
  const url = new URL(req.url)
  const body = await readPayload(req)
  const storyId = url.searchParams.get('storyId') || url.searchParams.get('story') || body.storyId
  const force = url.searchParams.get('force') === '1' || body.force === 1 || body.force === true || body.force === '1'
  if (force && !storyId) return json({ error: 'force requires a story id' }, 400)
  if (storyId && !STORY_ID_RE.test(storyId)) return json({ error: 'story id' }, 400)
  const result = await sendRequested(deps, { storyId, force: Boolean(force && storyId), dryRun: isDryRun(deps.env, url) })
  const status = result.reason === 'unknown-story' || result.reason === 'no-story' ? 404 : result.ok ? 200 : 502
  return json(result, status)
}

export async function handleSubscribe(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const url = new URL(req.url)
  const body = await readPayload(req)
  const html = wantsHtml(req)
  const result = await enrollSubscriber(deps, body.email ?? '', { dryRun: isDryRun(deps.env, url), explicit: true })
  if (html) {
    const to = result.ok ? '/news/?subscribed=1' : '/news/?subscribed=0'
    return new Response(null, { status: 303, headers: { location: to } })
  }
  return json(result, result.status)
}

export async function handleWebhook(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!safeEqual(req.headers.get('x-kit-webhook-secret') ?? '', deps.env.KIT_WEBHOOK_SECRET)) {
    return json({ error: 'unauthorized' }, 401)
  }
  let email = ''
  try {
    const body = await req.json() as {
      email_address?: unknown
      subscriber?: { email_address?: unknown }
    }
    if (typeof body.email_address === 'string') email = body.email_address
    else if (typeof body.subscriber?.email_address === 'string') email = body.subscriber.email_address
  } catch {
    return json({ error: 'body' }, 400)
  }
  const result = await enrollSubscriber(deps, email, { dryRun: isDryRun(deps.env), explicit: true })
  return json(result, result.status)
}

const UNSUB_HTML = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Unsubscribed</title><body style="font-family:sans-serif;background:#14141c;color:#f4fbff;padding:2rem"><h1>You're unsubscribed</h1><p>You won't get Roman's World News, or the welcome letter. The game account is separate.</p></body></html>`

export async function handleUnsubscribe(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method' }, 405)
  const url = new URL(req.url)
  let token = url.searchParams.get('token') ?? ''
  if (!token && req.method === 'POST') {
    const type = req.headers.get('content-type') ?? ''
    if (type.includes('application/x-www-form-urlencoded') || type.includes('application/json')) {
      const text = await req.text()
      const fromBody = /token=([a-f0-9]{64})/i.exec(text)?.[1]
      if (fromBody) token = fromBody
    }
  }
  const result = await unsubscribeByToken(deps, token)
  if (!result.ok) return json({ error: result.status === 404 ? 'unknown' : 'token' }, result.status)
  if (req.method === 'GET') {
    return new Response(UNSUB_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
  }
  return new Response('unsubscribed', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}

export async function handleFeed(deps: Deps, selfUrl: string): Promise<Response> {
  try {
    const stories = await catalog(deps)
    const xml = renderRss(stories, selfUrl)
    return new Response(xml, {
      status: 200,
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  } catch (err) {
    logNews({ level: 'error', msg: 'ERROR feed failed', detail: err instanceof Error ? err.message : 'error' })
    return new Response('feed unavailable', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
}
