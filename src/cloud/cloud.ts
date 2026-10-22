import { gaEvent } from '../game/analytics'
import { resetManagedCaptcha, takeManagedCaptcha } from './useTurnstile'
import { getPlayerName, isUnsetAccountName } from '../game/playerName'
import { rememberPlayerName } from '../game/storage'
/**
 * Player accounts + score saving (Supabase, project romans-game).
 *
 * - Sign-in: email magic link, or the code from that same email (no passwords). The session
 *   lives in localStorage, but the player row and every score live on the server, so a cache clear
 *   only means "sign in again". The code is {{ .Token }} in the Magic Link email; Tony adds that.
 * - Scores: queued locally first, then sent. Offline / Supabase down / not signed in = they wait
 *   in the queue (max 200) and flush on sign-in, on `online`, and after each new game.
 * - supabase-js is loaded lazily, so the game never waits on it and works fully without it.
 */
import type { SupabaseClient, Session } from '@supabase/supabase-js'

/** Longest player name (matches players_display_name_len in supabase/schema.sql) */
export const NAME_MAX = 24

export const SUPABASE_URL = 'https://oelsglmfkpzbueqysvdm.supabase.co'
/** Publishable (public) key: safe in the browser; RLS decides what it can do */
export const SUPABASE_KEY = 'sb_publishable_-lwtjOa1ekpRv6bdjOoTmg_lL3Tmne8'

export interface ScoreRow {
  score: number
  level: number
  moves: number
  time_seconds: number
  mode: 'normal' | 'trial' | 'daily' | 'endless' | 'remix' | 'other'
  puzzle_id?: string
  /** Toronto date (YYYY-MM-DD) of a scored daily puzzle win */
  daily_date?: string
  /** ISO time the game ended (kept so queued scores are not re-sent twice) */
  at: string
  /**
   * Local only — never sent. The same key is queued at most once, so a re-render
   * of the same win cannot save a second copy.
   */
  dedupeKey?: string
  /** Local only. The outbox and submit_score share this id so a retry cannot insert twice. */
  opId?: string
}

export interface CloudState {
  status: 'off' | 'signed-out' | 'signed-in' | 'error'
  email?: string
  /** null = signed in but no name yet (show the one-time prompt) */
  name?: string | null
  /** The unique name shown on the leaderboard (server adds 02, 03... if the name was taken) */
  publicName?: string
  pending: number
  lastSync?: string
}

const QUEUE_KEY = 'rg.cloud.queue.v1'
const CONSENT_KEY = 'rg.cloud.consent.v1'
/** Stable key for this project. Same origin, every page, every reload. */
export const AUTH_STORAGE_KEY = 'sb-oelsglmfkpzbueqysvdm-auth-token'
export const PROFILE_CACHE_KEY = 'rg.cloud.profile.v1'

export interface StoredSessionUser {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: { id: string; email?: string }
}

/** The login saved in localStorage, if it still has both tokens. */
export function readStoredSession(store: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): StoredSessionUser | null {
  try {
    const raw = store?.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<StoredSessionUser>
    if (!s?.access_token || !s.refresh_token || !s.user?.id) return null
    return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user: { id: s.user.id, email: s.user.email } }
  } catch {
    return null
  }
}

interface ProfileCache { userId: string; email?: string; name?: string | null; publicName?: string }

function readProfileCache(userId: string): ProfileCache | null {
  try {
    const c = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null') as ProfileCache | null
    return c && c.userId === userId ? c : null
  } catch {
    return null
  }
}

function writeProfileCache(userId: string, email: string | undefined, name: string | null | undefined, publicName?: string) {
  try {
    const prev = readProfileCache(userId)
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      userId,
      email: email ?? prev?.email,
      name: name === undefined ? prev?.name ?? null : name,
      publicName: publicName ?? prev?.publicName,
    }))
  } catch {
    /* private mode */
  }
}

/** True only while Sign out is running. A failed token refresh must not delete the login. */
let explicitSignOut = false

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** localStorage adapter. removeItem ignores the auth key unless the player chose Sign out. */
const authStorage = {
  getItem: (key: string) => browserStorage()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => {
    browserStorage()?.setItem(key, value)
  },
  removeItem: (key: string) => {
    if ((key === AUTH_STORAGE_KEY || key === `${AUTH_STORAGE_KEY}-user`) && !explicitSignOut) return
    browserStorage()?.removeItem(key)
  },
}

/** Used by the auth client. A refresh failure must not delete the saved login. */
export function releaseAuthKey(key: string): void {
  authStorage.removeItem(key)
}

/** Move scores played as a guest onto this account. Local board progress stays on the device. */
export function mergeGuestQueue(userId: string): number {
  const anon = readQueue(null)
  if (!anon.length) return 0
  const mine = readQueue(userId)
  const seen = new Set(mine.map((r) => r.dedupeKey).filter(Boolean))
  const extra = anon.filter((r) => !r.dedupeKey || !seen.has(r.dedupeKey))
  writeQueue([...mine, ...extra], userId)
  writeQueue([], null)
  return extra.length
}
/** Same Kit form as romansgame.com/news/#signup (public form endpoint, no secret key in the client) */
export const KIT_FORM_URL = 'https://app.kit.com/forms/10053148/subscriptions'

export interface Consent {
  age13: boolean
  optIn: boolean
}
/** Choices made on the sign-in sheet, kept until the account row is created after the magic link */
export function loadConsent(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
    return c && typeof c.age13 === 'boolean' ? { age13: c.age13, optIn: !!c.optIn } : null
  } catch {
    return null
  }
}
export function saveConsent(c: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c))
  } catch {
    /* private mode: the name sheet asks again */
  }
}

/** Public Kit form. Used only when this site's API says the key is not configured yet. */
async function subscribeNewsViaKitForm(email: string): Promise<boolean> {
  try {
    const body = new FormData()
    body.append('email_address', email)
    const r = await fetch(KIT_FORM_URL, { method: 'POST', body, headers: { Accept: 'application/json' } })
    return r.ok
  } catch {
    return false
  }
}

/**
 * In-game opt-in. The server puts the address on Kit form 10053148 and sends the one-time welcome.
 * Never throws. A preview deploy does not fall through to Kit.
 */
export async function subscribeNews(email: string): Promise<boolean> {
  try {
    const r = await fetch('/api/kit-subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, source: 'game' }),
    })
    const data = (await r.json().catch(() => null)) as { ok?: boolean; fallback?: boolean } | null
    if (data?.fallback) return subscribeNewsViaKitForm(email)
    return r.ok && data?.ok !== false
  } catch {
    return false
  }
}
const MAX_QUEUE = 200
let clientP: Promise<SupabaseClient | null> | null = null
/**
 * Queues are per player: signed in -> `rg.cloud.queue.v1.<user id>`, signed out -> the shared
 * `rg.cloud.queue.v1` (games played before signing in; they go to whoever signs in next).
 * Switching player signs out only after a new sign-in link is actually sent. Not now leaves
 * player A signed in. Once A is signed out, A's unsent scores stay under A's id and only send
 * when A signs in again; they are never mixed into player B.
 * Declared before `state`: the first queue read runs while this module is still starting.
 * A `let` below that call is still in the temporal dead zone in dev and the game white-screens.
 */
let queueOwner: string | null = null

/** Point the queue at the saved login and fold guest scores into it. Safe to call more than once. */
function adoptQueueOwner(): string | null {
  const saved = readStoredSession()
  if (!saved) return queueOwner
  if (queueOwner !== saved.user.id) {
    queueOwner = saved.user.id
    mergeGuestQueue(saved.user.id)
  }
  return queueOwner
}

function restoredState(): CloudState {
  const saved = readStoredSession()
  if (!saved) return { status: 'off', pending: readQueue(null).length }
  adoptQueueOwner()
  const cached = readProfileCache(saved.user.id)
  return {
    status: 'signed-in',
    email: saved.user.email ?? cached?.email,
    name: cached?.name,
    publicName: cached?.publicName,
    pending: readQueue(saved.user.id).length,
  }
}
let state: CloudState = restoredState()
const listeners = new Set<(s: CloudState) => void>()

function set(patch: Partial<CloudState>) {
  state = { ...state, ...patch, pending: readQueue().length }
  for (const l of listeners) l(state)
}
export function cloudState(): CloudState {
  return state
}
export function onCloud(fn: (s: CloudState) => void): () => void {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

function queueKey(owner: string | null = queueOwner): string {
  return owner ? `${QUEUE_KEY}.${owner}` : QUEUE_KEY
}
function readQueue(owner: string | null = queueOwner): ScoreRow[] {
  try {
    const q = JSON.parse(localStorage.getItem(queueKey(owner)) || '[]')
    return Array.isArray(q) ? q : []
  } catch {
    return []
  }
}
function writeQueue(q: ScoreRow[], owner: string | null = queueOwner) {
  try {
    if (!q.length) localStorage.removeItem(queueKey(owner))
    else localStorage.setItem(queueKey(owner), JSON.stringify(q.slice(-MAX_QUEUE)))
  } catch {
    /* storage full / private mode: the score just isn't queued */
  }
}

/** Tests swap in a fake client so a score upload never touches the live project. */
export function useCloudClientForTests(sb: SupabaseClient | null): void {
  clientP = Promise.resolve(sb)
}

/** Set just before Google linking. The authorize GET forwards spare query params to Google, so the token travels on this header instead. */
let googleCaptcha: string | null = null

function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input)
  if (!googleCaptcha || !url.includes('/user/identities/authorize')) return fetch(input, init)
  const token = googleCaptcha
  googleCaptcha = null
  const headers = new Headers(init?.headers)
  if (input instanceof Request) {
    input.headers.forEach((value, key) => {
      if (!headers.has(key)) headers.set(key, value)
    })
  }
  headers.set('x-captcha-token', token)
  return fetch(input, { ...init, headers })
}

function client(): Promise<SupabaseClient | null> {
  if (!clientP) {
    clientP = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_KEY, {
          global: { fetch: authFetch },
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'implicit',
            storage: authStorage,
            storageKey: AUTH_STORAGE_KEY,
          },
        }),
      )
      .catch(() => {
        clientP = null // offline on first load: try again later
        return null
      })
  }
  return clientP
}

/** The shared Supabase client. Null when the browser cannot load it. */
export function getSupabase(): Promise<SupabaseClient | null> {
  return client()
}

let anonHeld = false

/** Profile switches sign out on purpose. Hold the silent account until the new session is in. */
export function holdAnonymous(hold: boolean): void {
  anonHeld = hold
}

export function resumePlayAccount(): void {
  anonHeld = false
  void ensureAnonymous()
}

async function ensurePlayerRow(sb: SupabaseClient): Promise<void> {
  await sb.rpc('ensure_player').then(() => undefined, () => undefined)
}

let anonBusy = false

/** Silent anonymous account. Play already started. Failures retry in the background. */
async function ensureAnonymous(attempt = 0): Promise<void> {
  if (anonBusy && attempt === 0) return
  anonBusy = true
  try {
    if (anonHeld || explicitSignOut) return
    if (typeof window === 'undefined') return
    if (readStoredSession()) return
    const sb = await client()
    if (!sb || anonHeld) return
    const { data } = await sb.auth.getSession()
    if (data.session || anonHeld) return
    const captchaToken = await takeManagedCaptcha()
    if (anonHeld || explicitSignOut || readStoredSession()) return
    if (!captchaToken) {
      resetManagedCaptcha()
      if (attempt >= 5) return
      window.setTimeout(() => void ensureAnonymous(attempt + 1), Math.min(30_000, 2000 * 2 ** attempt))
      return
    }
    const { error } = await sb.auth.signInAnonymously({ options: { captchaToken } })
    resetManagedCaptcha()
    if (!error || anonHeld) return
    if (attempt >= 5) return
    window.setTimeout(() => void ensureAnonymous(attempt + 1), Math.min(30_000, 2000 * 2 ** attempt))
  } finally {
    anonBusy = false
  }
}

/**
 * Continue with Google on the current player.
 * options.captchaToken is set for the same shape as the other auth calls.
 * This client builds the authorize URL without that field, and spare query params are copied to Google,
 * so the token is also sent on x-captcha-token.
 */
export async function linkGoogle(redirectTo: string, captchaToken: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  googleCaptcha = captchaToken
  const { error } = await sb.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo, captchaToken },
  } as unknown as Parameters<SupabaseClient['auth']['linkIdentity']>[0])
  googleCaptcha = null
  if (error) {
    if (/captcha/i.test(error.message ?? '')) return { ok: false, error: "The captcha check didn't go through. Try again." }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

function sessionFromStore(): Session | null {
  const saved = readStoredSession()
  if (!saved) return null
  return saved as unknown as Session
}

async function loadPlayer(sb: SupabaseClient, session: Session | null) {
  if (!session && !explicitSignOut) session = sessionFromStore()
  if (!session) {
    queueOwner = null
    try { localStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* ignore */ }
    return set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined })
  }
  if (queueOwner !== session.user.id) {
    queueOwner = session.user.id
    mergeGuestQueue(session.user.id)
  }
  const cached = readProfileCache(session.user.id)
  // Stay signed in immediately, before the player row comes back.
  set({
    status: 'signed-in',
    email: session.user.email ?? cached?.email,
    name: state.name ?? cached?.name,
    publicName: state.publicName ?? cached?.publicName,
  })
  const { data, error } = await sb.from('players').select('display_name, public_name').eq('id', session.user.id).maybeSingle()
  if (error) {
    writeProfileCache(session.user.id, session.user.email, state.name, state.publicName)
    void flushScores()
    return
  }
  const name = data?.display_name ?? null
  const publicName = data?.public_name
  set({ status: 'signed-in', email: session.user.email, name, publicName })
  writeProfileCache(session.user.id, session.user.email, name, publicName)
  void ensurePlayerRow(sb)
  void flushScores().then(() => syncCard())
}

function refreshIfDue(sb: SupabaseClient) {
  if (explicitSignOut) return
  const saved = readStoredSession()
  if (!saved?.expires_at) return
  if (saved.expires_at * 1000 - Date.now() > 60_000) return
  void sb.auth.refreshSession().catch(() => undefined)
}

/** Call once at startup. Never throws, never blocks. Restores a saved login before any sign-in prompt. */
export async function initCloud(): Promise<void> {
  try {
    const sb = await client()
    if (!sb) {
      if (!readStoredSession()) set({ status: 'off' })
      return
    }
    const { data } = await sb.auth.getSession()
    await loadPlayer(sb, data.session ?? sessionFromStore())
    sb.auth.onAuthStateChange((event, session) => {
      // A failed refresh emits SIGNED_OUT and tries to delete storage. Keep the saved login.
      if (event === 'SIGNED_OUT' && !explicitSignOut && readStoredSession()) {
        void loadPlayer(sb, sessionFromStore())
        return
      }
      if (event === 'SIGNED_IN' && state.status !== 'signed-in') gaEvent('sign_in')
      void loadPlayer(sb, session)
      if (!session && !explicitSignOut && !anonHeld && !readStoredSession()) void ensureAnonymous()
    })
    window.addEventListener('online', () => {
      refreshIfDue(sb)
      void flushScores()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshIfDue(sb)
    })
    window.setInterval(() => refreshIfDue(sb), 60_000)
    if (!data.session && !readStoredSession()) void ensureAnonymous()
  } catch {
    if (!readStoredSession()) set({ status: 'off' })
  }
}

/** Same string for signInWithOtp and verifyOtp. Trimmed and lowercased, nothing else. */
export function signInEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Digits from the email code. Spaces are dropped. Supabase may send 6 to 10 digits. */
export function signInCode(token: string): string {
  return token.replace(/\s/g, '').replace(/\D/g, '').slice(0, 10)
}

/** The sheet shows Supabase's own words. The usual OTP failure gets a plain sentence. */
export function explainCodeError(message: string | undefined): string {
  const raw = message?.trim() ?? ''
  if (!raw) return 'Code expired or already used, send a new one.'
  if (/captcha/i.test(raw)) return "The captcha check didn't go through. Try again."
  if (/rate/i.test(raw)) return 'Too many tries. Wait a minute and try again.'
  if (/expired|already used|otp_expired|is invalid/i.test(raw)) return `Code expired or already used, send a new one. ${raw}`
  return raw
}

/** A captcha rejection is not a wrong code. Do not try another OTP type with the same token. */
function captchaFailure(message: string | undefined): boolean {
  return /captcha/i.test(message ?? '')
}

/** Wrong OTP type and a burned code look the same. Only those may try the next type. */
function otpTypeMismatch(message: string | undefined): boolean {
  const raw = message?.trim() ?? ''
  if (captchaFailure(raw)) return false
  return /expired|already used|otp_expired|is invalid/i.test(raw)
}

type SignInResult = { ok: boolean; error?: string; email?: string; sentAt?: number }

/** One network send at a time, shared by every sign-in button (Home, Board, Victory). */
let sendFlight: { email: string; promise: Promise<SignInResult> } | null = null
/** One verify per address+code. A second tap reuses the first result instead of burning the code. */
const verifyOnce = new Map<string, Promise<{ ok: boolean; error?: string }>>()

export async function sendMagicLink(email: string, captchaToken?: string): Promise<SignInResult> {
  const address = signInEmail(email)
  if (!captchaToken) return { ok: false, error: "This page couldn't complete the check. Try again." }
  if (sendFlight) {
    console.info(`[signin] send skipped email=${address} inFlight=${sendFlight.email}`)
    return sendFlight.email === address ? sendFlight.promise : { ok: false, error: 'A code is already on its way.' }
  }
  const sentAt = Date.now()
  console.info(`[signin] send email=${address} at=${new Date(sentAt).toISOString()}`)
  const promise = (async (): Promise<SignInResult> => {
    const sb = await client()
    if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
    // The link returns to the page the player is on, including a deploy preview.
    // verifyOtp does not send this URL. A preview origin cannot change the code check.
    const redirect = `${window.location.origin}${window.location.pathname}`
    const { error } = await sb.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: redirect, shouldCreateUser: true, captchaToken },
    })
    if (error) {
      if (captchaFailure(error.message)) return { ok: false, error: "The captcha check didn't go through. Try again." }
      return { ok: false, error: error.message?.trim() || "Couldn't send the link. Check the email and try again." }
    }
    return { ok: true, email: address, sentAt }
  })().finally(() => {
    if (sendFlight?.promise === promise) sendFlight = null
  })
  sendFlight = { email: address, promise }
  return promise
}

/**
 * The code from the same email as the magic link.
 * Anything from 6 to 10 digits is accepted. A shorter prefix is refused here so it is never sent:
 * Supabase would burn the real code. Type every digit from the email.
 * verifyOtp signs the player in and fires SIGNED_IN. The listener in initCloud then runs
 * loadPlayer, which copies this device's queued scores onto the account and flushes them.
 * That is the same path as opening the link.
 */
export async function verifyEmailCode(email: string, token: string, captchaToken?: string): Promise<{ ok: boolean; error?: string }> {
  const address = signInEmail(email)
  const code = signInCode(token)
  if (!/^\d{6,10}$/.test(code)) return { ok: false, error: 'Enter the code from your email.' }
  if (!captchaToken) return { ok: false, error: "This page couldn't complete the check. Try again." }
  const key = `${address}|${code}`
  const existing = verifyOnce.get(key)
  if (existing) {
    console.info(`[signin] verify skipped email=${address} digits=${code.length}`)
    return existing
  }
  const promise = (async () => {
    const sb = await client()
    if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
    // email is the type the merged sign-in uses. If Supabase stored the code as a magic link
    // or a new-user signup, that call says the token is invalid and the next type is tried once.
    // The captcha token is single-use, so only the first verifyOtp may carry it.
    let last = ''
    let sentCaptcha = false
    for (const type of ['email', 'magiclink', 'signup'] as const) {
      console.info(`[signin] verify type=${type} email=${address} digits=${code.length} at=${new Date().toISOString()}`)
      const { data, error } = await sb.auth.verifyOtp({
        email: address,
        token: code,
        type,
        options: sentCaptcha ? undefined : { captchaToken },
      })
      sentCaptcha = true
      const message = error?.message
      console.info(`[signin] verify result type=${type} ok=${!error && !!data.session} message=${message ?? ''}`)
      if (!error && data.session) return { ok: true }
      last = message ?? ''
      if (captchaFailure(message)) return { ok: false, error: explainCodeError(message) }
      if (!otpTypeMismatch(message)) return { ok: false, error: explainCodeError(message) }
    }
    return { ok: false, error: explainCodeError(last) }
  })()
  verifyOnce.set(key, promise)
  // A burned or accepted code stays cached so a second tap does not call verify again.
  // Offline and rate-limit failures are dropped so the same code can be tried once the wait is over.
  void promise.then((result) => {
    if (result.ok) return
    if (/expired|already used|invalid/i.test(result.error ?? '')) return
    if (verifyOnce.get(key) === promise) verifyOnce.delete(key)
  })
  return promise
}

export async function savePlayerName(name: string, consent: Consent): Promise<{ ok: boolean; error?: string; publicName?: string }> {
  if (!consent.age13) return { ok: false, error: 'Ask a parent to sign up for you.' }
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const { data } = await sb.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return { ok: false, error: 'Please sign in first.' }
  const display_name = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  // insert first; if the row already exists, update just the name (players can only write display_name,
  // so an upsert, which also writes id, is refused by the column grant)
  let { data: row, error } = await sb.from('players').insert({ id: uid, display_name, age_13_plus: true, marketing_opt_in: consent.optIn }).select('display_name, public_name').single()
  if (error?.code === '23505') {
    ;({ data: row, error } = await sb.from('players').update({ display_name }).eq('id', uid).select('display_name, public_name').single())
  }
  if (!row) return { ok: false, error: "Couldn't save your name. Try again." }
  if (error) return { ok: false, error: "Couldn't save your name. Try again." }
  set({ name: row.display_name, publicName: row.public_name })
  rememberPlayerName(row.public_name || row.display_name)
  saveConsent(consent)
  if (consent.optIn && data.session?.user.email) void subscribeNews(data.session.user.email)
  void flushScores()
  return { ok: true, publicName: row.public_name }
}

/** Change the signed-in player's name. Does not touch consent, email, or the session. */
export async function renamePlayer(name: string): Promise<{ ok: boolean; error?: string; publicName?: string }> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const { data } = await sb.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return { ok: false, error: 'Please sign in first.' }
  const display_name = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  if (!display_name) return { ok: false, error: 'Type a name.' }
  const { data: row, error } = await sb.from('players').update({ display_name }).eq('id', uid).select('display_name, public_name').maybeSingle()
  if (error || !row) return { ok: false, error: "Couldn't save your name. Try again." }
  set({ name: row.display_name, publicName: row.public_name })
  rememberPlayerName(row.public_name || row.display_name)
  return { ok: true, publicName: row.public_name }
}

export interface LeaderboardRow {
  name: string
  level: number
  best_score: number
  best_time_seconds: number
  rank: number
}

export interface PublicScoreRow {
  name: string
  score: number
  time_seconds: number
  mode: string
  created_at: string
  daily_date?: string | null
}

/**
 * Read public.public_scores. Never writes.
 * Asks for daily_date (migration 005). If that column is not on the view yet, reads the columns that already exist.
 */
export async function loadPublicScores(): Promise<PublicScoreRow[] | null> {
  try {
    const sb = await client()
    if (!sb) return null
    const withDate = await pagePublicScores(sb, 'name, score, time_seconds, mode, created_at, daily_date')
    if (withDate !== 'no-daily-date') return withDate
    const plain = await pagePublicScores(sb, 'name, score, time_seconds, mode, created_at')
    return plain === 'no-daily-date' ? null : plain
  } catch {
    return null
  }
}

async function pagePublicScores(sb: SupabaseClient, columns: string): Promise<PublicScoreRow[] | null | 'no-daily-date'> {
  const pageSize = 1000
  const out: PublicScoreRow[] = []
  for (let page = 0; page < 8; page++) {
    const from = page * pageSize
    const { data, error } = await sb
      .from('public_scores')
      .select(columns)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) {
      if (error.code === '42703' || /daily_date/i.test(error.message)) return 'no-daily-date'
      return out.length ? out : null
    }
    const rows = (Array.isArray(data) ? data : []) as unknown as PublicScoreRow[]
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

/** Read the public leaderboard view. Never writes. */
export async function loadLeaderboard(limit = 15): Promise<LeaderboardRow[]> {
  try {
    const sb = await client()
    if (!sb) return []
    const { data, error } = await sb
      .from('leaderboard')
      .select('name, level, best_score, best_time_seconds, rank')
      .order('best_score', { ascending: false })
      .limit(limit)
    if (error || !Array.isArray(data)) return []
    return data as LeaderboardRow[]
  } catch {
    return []
  }
}

export async function signOut(): Promise<void> {
  explicitSignOut = true
  try {
    const sb = await client()
    // local scope: only this device; this player's unsent scores stay queued under their id
    await sb?.auth.signOut({ scope: 'local' }).catch(() => undefined)
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(PROFILE_CACHE_KEY)
    } catch { /* ignore */ }
    queueOwner = null
    set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined })
  } finally {
    explicitSignOut = false
    if (!anonHeld) void ensureAnonymous()
  }
}

const DEDUPE_STORE = 'rg.cloud.dedupe.v1'
const seenDedupe = new Set<string>()

function dedupeSeen(key: string): boolean {
  if (seenDedupe.has(key)) return true
  try {
    const prev = JSON.parse(sessionStorage.getItem(DEDUPE_STORE) || '[]')
    if (Array.isArray(prev) && prev.includes(key)) {
      seenDedupe.add(key)
      return true
    }
  } catch {
    /* private mode: the queue check below still blocks a second copy */
  }
  return readQueue().some((r) => r.dedupeKey === key)
}

function rememberDedupe(key: string) {
  seenDedupe.add(key)
  try {
    const prev = JSON.parse(sessionStorage.getItem(DEDUPE_STORE) || '[]')
    const list = Array.isArray(prev) ? prev.filter((x): x is string => typeof x === 'string') : []
    if (!list.includes(key)) list.push(key)
    sessionStorage.setItem(DEDUPE_STORE, JSON.stringify(list.slice(-80)))
  } catch {
    /* the in-memory set still covers this page */
  }
}

/** Rows ready for insert. Local-only fields (queued-at time, dedupe key) stay off the server. */
export function scoreRowsForServer(q: ScoreRow[], now = Date.now()): Array<Omit<ScoreRow, 'at' | 'dedupeKey' | 'opId'>> {
  const weekAgo = new Date(now - 6 * 86_400_000).toISOString().slice(0, 10)
  return q.map(({ at: _at, dedupeKey: _dedupe, opId: _op, ...r }) => (r.daily_date && r.daily_date < weekAgo ? { ...r, daily_date: undefined } : r))
}

/**
 * The name the Board should use. A chosen account name wins. The default account
 * name yields to the name already saved on this device.
 */
export function accountNameFromDevice(): string {
  let playerName = ''
  let displayName = ''
  try {
    const settings = JSON.parse(localStorage.getItem('roman.settings.v1') || 'null') as { playerName?: string } | null
    if (typeof settings?.playerName === 'string') playerName = settings.playerName
  } catch {
    /* ignore */
  }
  try {
    const profile = JSON.parse(localStorage.getItem('roman.profile.v1') || 'null') as { displayName?: string } | null
    if (typeof profile?.displayName === 'string') displayName = profile.displayName
  } catch {
    /* ignore */
  }
  return getPlayerName({
    publicName: state.publicName,
    name: state.name,
    playerName,
    displayName,
  })
}

/** Home and victory copy. A signed-in player never sees the guest "Save my scores" prompt. */
export function scoreSaveLabel(s: Pick<CloudState, 'status' | 'pending'>): string {
  if (s.status === 'signed-in') {
    if (s.pending > 0) return `☁ Saving ${s.pending} ${s.pending === 1 ? 'score' : 'scores'}…`
    return '☁ Scores saved'
  }
  return s.pending ? `☁ Save my scores (${s.pending} waiting)` : '☁ Save my scores'
}

/** Queue a finished game and try to send everything queued. Safe to call offline. Same dedupeKey is stored once. */
export function saveScore(row: Omit<ScoreRow, 'at'>): void {
  adoptQueueOwner()
  if (row.dedupeKey && dedupeSeen(row.dedupeKey)) return
  const clean: ScoreRow = {
    score: Math.max(0, Math.min(1_000_000, Math.round(row.score) || 0)),
    level: Math.max(1, Math.min(100, Math.round(row.level) || 1)),
    moves: Math.max(0, Math.min(100_000, Math.round(row.moves) || 0)),
    time_seconds: Math.max(0, Math.min(86_400, Math.round(row.time_seconds) || 0)),
    mode: row.mode,
    puzzle_id: row.puzzle_id?.slice(0, 80),
    ...(row.mode === 'daily' && row.daily_date && /^\d{4}-\d{2}-\d{2}$/.test(row.daily_date) ? { daily_date: row.daily_date } : {}),
    at: new Date().toISOString(),
    ...(row.dedupeKey ? { dedupeKey: row.dedupeKey.slice(0, 160) } : {}),
    opId: row.opId ?? crypto.randomUUID(),
  }
  writeQueue([...readQueue(), clean])
  if (clean.dedupeKey) rememberDedupe(clean.dedupeKey)
  void import('../game/outbox').then(({ enqueueOp }) =>
    enqueueOp(
      'score',
      {
        score: clean.score,
        level: clean.level,
        moves: clean.moves,
        time_seconds: clean.time_seconds,
        mode: clean.mode,
        puzzle_id: clean.puzzle_id ?? null,
        daily_date: clean.daily_date ?? null,
      },
      clean.opId,
    ),
  )
  set({})
  void flushScores()
}

type WriteError = { code?: string; message?: string } | null

function checkFailed(error: WriteError): boolean {
  if (!error) return false
  return error.code === '23514' || /check constraint/i.test(error.message ?? '')
}

/** Drop keys the server should not see as null. */
function scorePayload(row: Omit<ScoreRow, 'at' | 'dedupeKey'>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    score: row.score,
    level: row.level,
    moves: row.moves,
    time_seconds: row.time_seconds,
    mode: row.mode,
  }
  if (row.puzzle_id) out.puzzle_id = row.puzzle_id
  if (row.daily_date) out.daily_date = row.daily_date
  return out
}

/** The client memory can be empty after a failed refresh even though the login is still saved. */
async function sessionForWrites(sb: SupabaseClient): Promise<Session | null> {
  const { data } = await sb.auth.getSession()
  const current = data.session
  const expiresAt = current?.expires_at ? current.expires_at * 1000 : 0
  const usable = !!current?.access_token && !!current.user?.id && (!expiresAt || expiresAt - Date.now() > 30_000)
  if (usable && current) return current
  const saved = readStoredSession()
  if (!saved) return current?.user?.id ? current : null
  const { data: next, error } = await sb.auth.setSession({
    access_token: saved.access_token,
    refresh_token: saved.refresh_token,
  })
  if (!error && next.session?.user?.id) return next.session
  return current?.user?.id ? current : null
}

/** Scores need a players row (foreign key). Create one from the name already on this device. */
async function ensureNamedPlayer(sb: SupabaseClient, uid: string): Promise<boolean> {
  const found = await sb.from('players').select('display_name, public_name').eq('id', uid).maybeSingle()
  if (found.error) return false
  const deviceName = accountNameFromDevice()
  if (found.data?.display_name) {
    let name = found.data.display_name as string
    let publicName = (found.data.public_name as string | undefined) || name
    // The default account name must not hide the name already chosen on this device.
    if (isUnsetAccountName(publicName) && deviceName && !isUnsetAccountName(deviceName)) {
      const renamed = await sb.from('players').update({ display_name: deviceName }).eq('id', uid).select('display_name, public_name').maybeSingle()
      if (!renamed.error && renamed.data?.display_name) {
        name = renamed.data.display_name as string
        publicName = (renamed.data.public_name as string | undefined) || name
      }
    }
    set({ name, publicName })
    writeProfileCache(uid, state.email, name, publicName)
    if (!isUnsetAccountName(publicName)) rememberPlayerName(publicName)
    return true
  }
  const display_name = deviceName
  if (!display_name) return false
  const age13 = loadConsent()?.age13 !== false
  if (!age13) return false
  let { data: row, error } = await sb
    .from('players')
    .insert({ id: uid, display_name, age_13_plus: true, marketing_opt_in: !!loadConsent()?.optIn })
    .select('display_name, public_name')
    .single()
  if (error?.code === '23505') {
    ;({ data: row, error } = await sb.from('players').select('display_name, public_name').eq('id', uid).maybeSingle())
  }
  if (error || !row?.display_name) return false
  const name = row.display_name as string
  const publicName = (row.public_name as string | undefined) || name
  set({ name, publicName })
  writeProfileCache(uid, state.email, name, publicName)
  rememberPlayerName(publicName)
  return true
}

async function insertScoreBatch(sb: SupabaseClient, rows: Array<Omit<ScoreRow, 'at' | 'dedupeKey'>>): Promise<WriteError> {
  const { error } = await sb.from('scores').insert(rows.map(scorePayload))
  return error
}

/** One row. A check failure retries without daily_date, then with mode "other" for remix. */
async function insertScoreOne(sb: SupabaseClient, row: ScoreRow): Promise<boolean> {
  const [clean] = scoreRowsForServer([row])
  let error = await insertScoreBatch(sb, [clean])
  if (!error) return true
  if (checkFailed(error) && clean.daily_date) {
    const { daily_date: _day, ...rest } = clean
    error = await insertScoreBatch(sb, [rest])
    if (!error) return true
  }
  if (checkFailed(error) && (clean.mode === 'remix' || row.mode === 'remix')) {
    const { daily_date: _day, ...rest } = clean
    error = await insertScoreBatch(sb, [{ ...rest, mode: 'other' }])
    if (!error) return true
  }
  return false
}

function rpcMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = error.message || ''
  return error.code === 'PGRST202' || error.code === '42883' || /submit_score|schema cache/i.test(msg)
}

/** One server call per score. A missing function falls back to a plain insert. */
async function submitQueuedScores(
  sb: SupabaseClient,
  q: ScoreRow[],
  rows: Array<Omit<ScoreRow, 'at' | 'dedupeKey' | 'opId'>>,
): Promise<boolean> {
  let missing = false
  for (let i = 0; i < q.length; i++) {
    const op = q[i].opId
    if (!op) {
      missing = true
      break
    }
    const row = rows[i]
    const { error } = await sb.rpc('submit_score', {
      op,
      score: row.score,
      level: row.level,
      moves: row.moves,
      time_seconds: row.time_seconds,
      mode: row.mode,
      puzzle_id: row.puzzle_id ?? null,
      daily_date: row.daily_date ?? null,
    })
    if (rpcMissing(error)) {
      missing = true
      break
    }
    if (error) return false
  }
  if (!missing) return true
  const { error } = await sb.from('scores').insert(rows)
  return !error
}

let flushing = false
let flushAgain = false
export async function flushScores(): Promise<void> {
  if (flushing) {
    flushAgain = true
    return
  }
  if (state.status !== 'signed-in') return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const owner = adoptQueueOwner()
  if (owner) mergeGuestQueue(owner)
  const q = owner ? readQueue(owner) : []
  if (!owner || !q.length) return
  flushing = true
  try {
    const sb = await client()
    if (!sb) return
    const session = await sessionForWrites(sb)
    if (!session || session.user.id !== owner) return
    const ready = await ensureNamedPlayer(sb, owner)
    if (!ready) return
    const rows = scoreRowsForServer(q)
    const sentRpc = await submitQueuedScores(sb, q, rows)
    if (sentRpc) {
      writeQueue(readQueue(owner).slice(q.length), owner)
      set({ lastSync: new Date().toISOString() })
    } else {
      const kept: ScoreRow[] = []
      let sent = 0
      for (const row of q) {
        if (await insertScoreOne(sb, row)) sent += 1
        else kept.push(row)
      }
      const fresh = readQueue(owner).slice(q.length)
      writeQueue([...kept, ...fresh], owner)
      if (sent > 0) set({ lastSync: new Date().toISOString() })
    }
    void syncCard()
  } catch {
    /* stays queued */
  } finally {
    flushing = false
    if (flushAgain) {
      flushAgain = false
      void flushScores()
    }
  }
}

/** Server-verified Unseen card progress for the signed-in player (null = signed out / unknown) */
export interface CardProgress { boards: number; days: number; pieces: number; needed: number; earned: boolean }
let cardProgress: CardProgress | null = null
const cardListeners = new Set<(p: CardProgress | null) => void>()
export function onCardProgress(fn: (p: CardProgress | null) => void): () => void {
  cardListeners.add(fn)
  fn(cardProgress)
  return () => cardListeners.delete(fn)
}
function setCard(p: CardProgress | null) {
  cardProgress = p
  for (const l of cardListeners) l(p)
}
onCloud((s) => {
  if (s.status !== 'signed-in' && cardProgress) setCard(null)
})
/** Ask the server to count saved wins and award the card at 50/50. Idempotent. */
export async function syncCard(): Promise<void> {
  if (state.status !== 'signed-in') return
  try {
    const sb = await client()
    if (!sb) return
    const { data, error } = await sb.rpc('claim_unseen_card')
    const row = Array.isArray(data) ? data[0] : data
    if (!error && row) setCard({ boards: row.boards, days: row.days, pieces: row.pieces, needed: row.needed, earned: !!row.earned })
  } catch {
    /* keep the local count */
  }
}
