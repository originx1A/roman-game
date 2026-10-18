/**
 * Kit API v4. The key is read only from KIT_API_KEY by the caller.
 * Create Broadcast subscriber_filter accepts `segment` or `tag` ids, not a form id
 * (https://developers.kit.com/api-reference/broadcasts/create-a-broadcast).
 * There is no single-recipient send on the free plan.
 */

export const KIT_API = 'https://api.kit.com'

export class KitRequestError extends Error {
  readonly status: number
  readonly retryable: boolean

  constructor(message: string, status: number, retryable: boolean) {
    super(message)
    this.name = 'KitRequestError'
    this.status = status
    this.retryable = retryable
  }
}

export interface FilterClause {
  type: 'segment' | 'tag'
  ids: number[]
}

export interface SubscriberFilterGroup {
  all: FilterClause[]
  any: null
  none: null
}

/** One filter group, as the v4 broadcast schema requires. */
export function subscriberFilter(target: { type: 'segment' | 'tag'; id: number }): SubscriberFilterGroup[] {
  return [{ all: [{ type: target.type, ids: [target.id] }], any: null, none: null }]
}

export interface BroadcastDraft {
  subject: string
  preview_text: string
  description: string
  content: string
  public: false
  published_at: string
  send_at: string
  thumbnail_url?: string
  thumbnail_alt?: string
  email_address?: string
  subscriber_filter: SubscriberFilterGroup[]
}

export interface KitApi {
  createBroadcast(draft: BroadcastDraft): Promise<number>
  ensureTag(name: string): Promise<number>
  createSubscriber(email: string): Promise<number>
  addToForm(formId: number, subscriberId: number): Promise<void>
  tagSubscriber(tagId: number, subscriberId: number): Promise<void>
  subscriberTagNames(subscriberId: number): Promise<string[]>
  findSubscriber(email: string): Promise<number | null>
  unsubscribe(subscriberId: number): Promise<void>
}

export interface KitClientOptions {
  apiKey: string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
  timeoutMs?: number
  maxAttempts?: number
}

const BASE_DELAY_MS = 250

/** Exponential backoff with jitter, in milliseconds. `attempt` is 0 for the first retry. */
export function retryDelayMs(attempt: number, random: () => number): number {
  const exp = BASE_DELAY_MS * 2 ** attempt
  return Math.round(exp * (0.5 + random() * 0.5))
}

export function retryAfterMs(header: string | null, nowMs: number): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const when = Date.parse(trimmed)
  if (Number.isNaN(when)) return null
  return Math.max(0, when - nowMs)
}

function logKit(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), component: 'kit', ...entry }))
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function kitRequest(opts: KitClientOptions, path: string, init: RequestInit): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const random = opts.random ?? Math.random
  const now = opts.now ?? Date.now
  const timeoutMs = opts.timeoutMs ?? 12_000
  const maxAttempts = opts.maxAttempts ?? 4
  const url = path.startsWith('http') ? path : `${KIT_API}${path}`
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(fetchImpl, url, {
        ...init,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'X-Kit-Api-Key': opts.apiKey,
          ...(init.headers ?? {}),
        },
      }, timeoutMs)
      if (res.status === 429 || res.status >= 500) {
        const wait = retryAfterMs(res.headers.get('retry-after'), now()) ?? retryDelayMs(attempt, random)
        if (attempt === maxAttempts - 1) {
          throw new KitRequestError(`kit HTTP ${res.status}`, res.status, true)
        }
        logKit({ level: 'warn', msg: 'kit retry', status: res.status, waitMs: wait, attempt })
        await sleep(wait)
        continue
      }
      if (res.status >= 400) {
        throw new KitRequestError(`kit HTTP ${res.status}`, res.status, false)
      }
      return res
    } catch (err) {
      if (err instanceof KitRequestError && !err.retryable) throw err
      lastError = err
      if (attempt === maxAttempts - 1) break
      const aborted = err instanceof Error && err.name === 'AbortError'
      logKit({ level: 'warn', msg: aborted ? 'kit timeout' : 'kit network', attempt })
      await sleep(retryDelayMs(attempt, random))
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new KitRequestError('kit request failed', 0, true)
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function subscriberId(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const root = body as { subscriber?: { id?: unknown }; id?: unknown }
  const id = root.subscriber?.id ?? root.id
  return typeof id === 'number' ? id : null
}

export function createKitClient(opts: KitClientOptions): KitApi {
  return {
    async createBroadcast(draft) {
      const res = await kitRequest(opts, '/v4/broadcasts', { method: 'POST', body: JSON.stringify(draft) })
      const body = await readBody(res)
      const id = body && typeof body === 'object' ? (body as { broadcast?: { id?: unknown } }).broadcast?.id : null
      if (typeof id !== 'number') throw new KitRequestError('kit broadcast response missing id', res.status, false)
      return id
    },
    async ensureTag(name) {
      const res = await kitRequest(opts, '/v4/tags', { method: 'POST', body: JSON.stringify({ name }) })
      const body = await readBody(res)
      const id = body && typeof body === 'object' ? (body as { tag?: { id?: unknown } }).tag?.id : null
      if (typeof id !== 'number') throw new KitRequestError('kit tag response missing id', res.status, false)
      return id
    },
    async createSubscriber(email) {
      const res = await kitRequest(opts, '/v4/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email_address: email }),
      })
      const id = subscriberId(await readBody(res))
      if (id == null) throw new KitRequestError('kit subscriber response missing id', res.status, false)
      return id
    },
    async addToForm(formId, subscriberIdToAdd) {
      await kitRequest(opts, `/v4/forms/${formId}/subscribers/${subscriberIdToAdd}`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
    async tagSubscriber(tagId, subscriberIdToTag) {
      await kitRequest(opts, `/v4/tags/${tagId}/subscribers/${subscriberIdToTag}`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
    async subscriberTagNames(subscriberIdToRead) {
      const res = await kitRequest(opts, `/v4/subscribers/${subscriberIdToRead}/tags`, { method: 'GET' })
      const body = await readBody(res)
      const tags = body && typeof body === 'object' ? (body as { tags?: { name?: unknown }[] }).tags : null
      if (!Array.isArray(tags)) return []
      return tags.flatMap((tag) => (typeof tag.name === 'string' ? [tag.name] : []))
    },
    async findSubscriber(email) {
      const query = new URLSearchParams({ email_address: email, status: 'all' })
      const res = await kitRequest(opts, `/v4/subscribers?${query.toString()}`, { method: 'GET' })
      const body = await readBody(res)
      if (!body || typeof body !== 'object') return null
      const list = (body as { subscribers?: { id?: unknown; email_address?: unknown }[] }).subscribers
      if (!Array.isArray(list)) return subscriberId(body)
      const found = list.find((row) => typeof row.email_address === 'string' && row.email_address.toLowerCase() === email)
      return found && typeof found.id === 'number' ? found.id : null
    },
    async unsubscribe(subscriberIdToCancel) {
      await kitRequest(opts, `/v4/subscribers/${subscriberIdToCancel}/unsubscribe`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    },
  }
}
