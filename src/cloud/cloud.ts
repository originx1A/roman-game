import { gaEvent } from '../game/analytics'
/**
 * Player accounts + score saving (Supabase, project romans-game).
 *
 * - Sign-in: email, then the 6-digit code from that email (Supabase email OTP). The same
 *   email still includes a link. A player who set a password can instead sign in with their
 *   name and that password (POST /api/auth/signin). The session stays in localStorage until
 *   Log out or the storage is cleared. Closing the app keeps it. Log out uses scope global,
 *   so romansgame.com is revoked too. On load and when the window is focused, getUser()
 *   checks the session and drops it if it was revoked. A network miss keeps it.
 *   The code is {{ .Token }} in the Magic Link email; Tony adds that.
 * - Scores: queued locally first, then sent. Offline / Supabase down / not signed in = they wait
 *   in the queue (max 200) and flush on sign-in, on `online`, and after each new game.
 * - supabase-js is loaded lazily, so the game never waits on it and works fully without it.
 */
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import { explainSignInError } from './signInError'

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
}

export interface CloudState {
  status: 'off' | 'signed-out' | 'signed-in' | 'error'
  email?: string
  /** null = signed in but no name yet (show the one-time prompt) */
  name?: string | null
  /** The unique name shown on the leaderboard (server adds 02, 03... if the name was taken) */
  publicName?: string
  /**
   * true: the account already has age_confirmed_at (or an existing players.age_13_plus row).
   * false: this sign-in still needs the one-time boxes.
   * undefined: signed out, or the read failed and a named account is already there.
   */
  ageConfirmed?: boolean
  pending: number
  lastSync?: string
}

const QUEUE_KEY = 'rg.cloud.queue.v1'
const CONSENT_KEY = 'rg.cloud.consent.v1'
/** Same Kit form as romansgame.com/news/#signup (public form endpoint, no secret key in the client) */
export const KIT_FORM_URL = 'https://app.kit.com/forms/10053148/subscriptions'

export interface Consent {
  age13: boolean
  optIn: boolean
}
/**
 * Device copy of the boxes, kept only until the account row is written.
 * It is not the gate. A new device asks again until account_flags.age_confirmed_at is set.
 */
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
/** Declared before readQueue(): the first queue read happens while this module is still starting. */
let queueOwner: string | null = null
let state: CloudState = { status: 'off', pending: readQueue().length }
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

/**
 * Queues are per player: signed in -> `rg.cloud.queue.v1.<user id>`, signed out -> the shared
 * `rg.cloud.queue.v1` (games played before signing in; they go to whoever signs in next).
 * "Switch player" signs out, so player A's unsent scores stay under A's id and only send when A
 * signs in again; they are never mixed into player B.
 */
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

export function cloudClient(): Promise<SupabaseClient | null> {
  return client()
}

function client(): Promise<SupabaseClient | null> {
  if (!clientP) {
    clientP = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
        }),
      )
      .catch(() => {
        clientP = null // offline on first load: try again later
        return null
      })
  }
  return clientP
}

/** true / false when the read settled. undefined when the network failed and we cannot tell. */
async function readAgeConfirmed(sb: SupabaseClient, userId: string, age13Plus: boolean | null): Promise<boolean | undefined> {
  const flags = await sb.from('account_flags').select('age_confirmed_at').eq('user_id', userId).maybeSingle()
  if (!flags.error && flags.data?.age_confirmed_at) return true
  if (flags.error && flags.error.code !== 'PGRST205' && flags.error.code !== '42P01' && !/account_flags/.test(flags.error.message || '')) {
    // Offline or a real error. An existing 13+ player is not asked again. A brand-new account is.
    if (age13Plus === true) return true
    if (age13Plus === null) return undefined
    return false
  }
  if (age13Plus === true) {
    // Existing account that confirmed before this table existed. Copy it once. Ignore a missing table.
    if (!flags.error && !flags.data) {
      const at = new Date().toISOString()
      void sb.from('account_flags').insert({ user_id: userId, age_confirmed_at: at, terms_confirmed_at: at, news_opt_in: false })
    }
    return true
  }
  if (age13Plus === null && flags.error) return undefined
  return false
}

async function loadPlayer(sb: SupabaseClient, session: Session | null) {
  if (!session) {
    queueOwner = null
    return set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined, ageConfirmed: undefined })
  }
  if (queueOwner !== session.user.id) {
    queueOwner = session.user.id
    // games played while signed out belong to the player who signs in now
    const anon = readQueue(null)
    if (anon.length) {
      writeQueue([...readQueue(), ...anon])
      writeQueue([], null)
    }
  }
  const { data, error } = await sb.from('players').select('display_name, public_name, age_13_plus').eq('id', session.user.id).maybeSingle()
  const age13Plus = error ? null : data?.age_13_plus === true ? true : data ? false : null
  let ageConfirmed = await readAgeConfirmed(sb, session.user.id, age13Plus)
  if (confirmedHint && confirmedHint === session.user.id) ageConfirmed = true
  if (error) return set({ status: 'signed-in', email: session.user.email, name: state.name ?? null, ageConfirmed })
  set({ status: 'signed-in', email: session.user.email, name: data?.display_name ?? null, publicName: data?.public_name, ageConfirmed })
  if (data) void flushScores().then(() => syncCard())
}

function sessionRejected(error: { status?: number; name?: string; message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.name === 'AuthRetryableFetchError') return false
  if (error.name === 'AuthSessionMissingError') return true
  const code = (error.code || '').toLowerCase()
  if (code === 'session_not_found' || code === 'user_not_found' || code === 'bad_jwt' || code === 'refresh_token_not_found') return true
  const status = error.status ?? 0
  if (status === 401 || status === 403) return true
  if (status >= 500 || status === 0) return false
  const msg = (error.message || '').toLowerCase()
  if (msg.includes('fetch') || msg.includes('network')) return false
  return msg.includes('jwt') || msg.includes('session') || msg.includes('revoked')
}

/** Set when name+password sign-in already returned age_confirmed_at, before the table read finishes. */
let confirmedHint: string | null = null

/** Ask the auth server if this device's session still exists. A network miss keeps the saved session. */
async function recheckSession(sb: SupabaseClient): Promise<void> {
  const { data: local } = await sb.auth.getSession()
  if (!local.session) {
    queueOwner = null
    if (state.status !== 'signed-out') {
      set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined, ageConfirmed: undefined })
    }
    return
  }
  // Paint the saved login first, so a reload or a restarted phone is already signed in.
  if (state.status !== 'signed-in') await loadPlayer(sb, local.session)
  const { data, error } = await sb.auth.getUser()
  if (error && !sessionRejected(error)) return
  if (error || !data.user) {
    // Already revoked on the server (including from romansgame.com). Clear this device only.
    await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
    queueOwner = null
    confirmedHint = null
    set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined, ageConfirmed: undefined })
    return
  }
  await loadPlayer(sb, local.session)
}

let cloudStarted = false

/** Call once at startup. Never throws, never blocks. */
export async function initCloud(): Promise<void> {
  if (cloudStarted) return
  cloudStarted = true
  try {
    const sb = await client()
    if (!sb) {
      cloudStarted = false
      return set({ status: 'off' })
    }
    await recheckSession(sb)
    sb.auth.onAuthStateChange((_e, session) => {
      if (_e === 'SIGNED_IN' && state.status !== 'signed-in') gaEvent('sign_in')
      if (_e === 'INITIAL_SESSION' || _e === 'TOKEN_REFRESHED') return
      void loadPlayer(sb, session)
    })
    window.addEventListener('online', () => void flushScores())
    window.addEventListener('focus', () => { void recheckSession(sb) })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void recheckSession(sb)
    })
  } catch {
    cloudStarted = false
    set({ status: 'off' })
  }
}

export async function sendMagicLink(email: string, captchaToken?: string): Promise<{ ok: boolean; error?: string }> {
  if (!captchaToken) return { ok: false, error: "This page couldn't complete the check. Try again." }
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const redirect = `${window.location.origin}${window.location.pathname}`
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirect, shouldCreateUser: true, captchaToken },
  })
  if (error) return { ok: false, error: explainSignInError(error) }
  return { ok: true }
}

/**
 * The code from the same email as the magic link. The project sends 6 to 8 digits.
 * verifyOtp signs the player in and fires SIGNED_IN. The listener in initCloud then runs
 * loadPlayer, which copies this device's queued scores onto the account and flushes them.
 * That is the same path as opening the link.
 */
export async function verifyEmailCode(email: string, token: string, captchaToken?: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const code = token.replace(/\s/g, '')
  if (!/^\d{6,8}$/.test(code)) return { ok: false, error: 'Enter the code from your email.' }
  if (!captchaToken) return { ok: false, error: "This page couldn't complete the check. Try again." }
  const { data, error } = await sb.auth.verifyOtp({
    email: email.trim(),
    token: code,
    type: 'email',
    options: { captchaToken },
  })
  if (error || !data.session) {
    return { ok: false, error: explainSignInError(error, "That code didn't work. Check it and try again.") }
  }
  return { ok: true }
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
  const at = new Date().toISOString()
  await sb.from('account_flags').insert({
    user_id: uid,
    age_confirmed_at: at,
    terms_confirmed_at: at,
    news_opt_in: consent.optIn,
  })
  set({ name: row.display_name, publicName: row.public_name, ageConfirmed: true })
  saveConsent(consent)
  if (consent.optIn && data.session?.user.email) void subscribeNews(data.session.user.email)
  void flushScores()
  return { ok: true, publicName: row.public_name }
}

/**
 * Keep a name+password API session in the same localStorage slot this game already restores.
 * Call this after POST /api/auth/signin returns session tokens.
 */
export async function persistServerSession(accessToken: string, refreshToken: string): Promise<boolean> {
  const sb = await client()
  if (!sb) return false
  const { data, error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error || !data.session) return false
  await loadPlayer(sb, data.session)
  return true
}

/** Name and password, for a player who set one. Same endpoint as PR #63. Email code stays available. */
export async function signInWithName(name: string, password: string, captchaToken?: string): Promise<{ ok: boolean; error?: string }> {
  const player = name.trim().replace(/\s+/g, ' ')
  if (player.length < 3) return { ok: false, error: 'Type your player name.' }
  if (!password) return { ok: false, error: 'Type your password.' }
  if (!captchaToken) return { ok: false, error: "This page couldn't complete the check. Try again." }
  let res: Response
  try {
    res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ name: player, password, captchaToken, stay_signed_in: true }),
    })
  } catch {
    return { ok: false, error: "You're offline. Try again when you're connected." }
  }
  const data = (await res.json().catch(() => null)) as {
    error?: string
    user_id?: string
    flags?: { age_confirmed_at?: string | null }
    session?: { access_token?: string; refresh_token?: string }
  } | null
  if (!res.ok || !data?.session?.access_token || !data.session.refresh_token) {
    if (data?.error === 'invalid_credentials') return { ok: false, error: 'That name or password did not match.' }
    if (data?.error === 'turnstile_required') return { ok: false, error: "This page couldn't complete the check. Try again." }
    return { ok: false, error: 'Could not sign in. You can use the email code instead.' }
  }
  if (data.user_id && data.flags?.age_confirmed_at) confirmedHint = data.user_id
  const saved = await persistServerSession(data.session.access_token, data.session.refresh_token)
  if (!saved) return { ok: false, error: 'Could not sign in. You can use the email code instead.' }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  const sb = await client()
  // Global: revokes this account on every device, including romansgame.com.
  // Unsent scores stay queued on this device under the player id.
  await sb?.auth.signOut({ scope: 'global' }).catch(() => undefined)
  queueOwner = null
  confirmedHint = null
  set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined, ageConfirmed: undefined })
}

/** Queue a finished game and try to send everything queued. Safe to call offline. */
export function saveScore(row: Omit<ScoreRow, 'at'>): void {
  const clean: ScoreRow = {
    score: Math.max(0, Math.min(1_000_000, Math.round(row.score) || 0)),
    level: Math.max(1, Math.min(100, Math.round(row.level) || 1)),
    moves: Math.max(0, Math.min(100_000, Math.round(row.moves) || 0)),
    time_seconds: Math.max(0, Math.min(86_400, Math.round(row.time_seconds) || 0)),
    mode: row.mode,
    puzzle_id: row.puzzle_id?.slice(0, 80),
    ...(row.mode === 'daily' && row.daily_date && /^\d{4}-\d{2}-\d{2}$/.test(row.daily_date) ? { daily_date: row.daily_date } : {}),
    at: new Date().toISOString(),
  }
  writeQueue([...readQueue(), clean])
  set({})
  void flushScores()
}

let flushing = false
export async function flushScores(): Promise<void> {
  if (flushing || state.status !== 'signed-in' || !state.name) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const owner = queueOwner
  const q = readQueue(owner)
  if (!owner || !q.length) return
  flushing = true
  try {
    const sb = await client()
    if (!sb) return
    // the server only takes a daily_date from the last week; older queued rows still send their score
    const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
    const rows = q.map(({ at: _at, ...r }) => (r.daily_date && r.daily_date < weekAgo ? { ...r, daily_date: undefined } : r))
    const { data: sess } = await sb.auth.getSession()
    if (sess.session?.user.id !== owner) return // switched player mid-send: leave the queue alone
    const { error } = await sb.from('scores').insert(rows)
    if (!error) {
      const best = rows.reduce((top, row) => Math.max(top, row.score), 0)
      // Personal best stays on the player. Each game also adds its score to the group they are in now.
      await sb.rpc('save_my_board_score', { new_score: best })
      for (const row of rows) {
        await sb.rpc('record_my_group_points', { new_score: row.score })
      }
      // keep anything queued while we were sending
      writeQueue(readQueue(owner).slice(q.length), owner)
      set({ lastSync: new Date().toISOString() })
    }
    void syncCard()
  } catch {
    /* stays queued */
  } finally {
    flushing = false
  }
}

export interface BoardRow {
  name: string
  score: number
  place: number
}

/** Public board. Names and scores only. Guests can read it. */
export async function loadPlayerBoard(): Promise<{ ok: true; rows: BoardRow[] } | { ok: false; error: string }> {
  try {
    const sb = await client()
    if (!sb) return { ok: false, error: "You're offline." }
    const { data, error } = await sb.from('player_board').select('name, score, place').order('place', { ascending: true }).limit(100)
    if (error) return { ok: false, error: "The board isn't up yet." }
    const rows: BoardRow[] = []
    for (const row of data ?? []) {
      if (typeof row.name !== 'string' || !row.name.trim()) continue
      const score = Number(row.score)
      const place = Number(row.place)
      if (!Number.isFinite(score) || !Number.isFinite(place)) continue
      rows.push({ name: row.name, score, place })
    }
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "The board isn't up yet." }
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
  if (state.status !== 'signed-in' || !state.name) return
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
