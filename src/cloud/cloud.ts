/**
 * Player accounts + score saving (Supabase, project romans-game).
 *
 * - Sign-in: email magic link only (no passwords). The session lives in localStorage, but the
 *   player row and every score live on the server, so a cache clear only means "sign in again".
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

/** Add the email to the Roman's World News list (Kit). Never throws; Kit sends its own confirm email. */
export async function subscribeNews(email: string): Promise<boolean> {
  try {
    const body = new FormData()
    body.append('email_address', email)
    const r = await fetch(KIT_FORM_URL, { method: 'POST', body, headers: { Accept: 'application/json' } })
    return r.ok
  } catch {
    return false
  }
}
const MAX_QUEUE = 200
let clientP: Promise<SupabaseClient | null> | null = null
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
let queueOwner: string | null = null
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

async function loadPlayer(sb: SupabaseClient, session: Session | null) {
  if (!session) {
    queueOwner = null
    return set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined })
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
  const { data, error } = await sb.from('players').select('display_name, public_name').eq('id', session.user.id).maybeSingle()
  if (error) return set({ status: 'signed-in', email: session.user.email, name: state.name ?? null })
  set({ status: 'signed-in', email: session.user.email, name: data?.display_name ?? null, publicName: data?.public_name })
  if (data) void flushScores()
}

/** Call once at startup. Never throws, never blocks. */
export async function initCloud(): Promise<void> {
  try {
    const sb = await client()
    if (!sb) return set({ status: 'off' })
    const { data } = await sb.auth.getSession()
    await loadPlayer(sb, data.session)
    sb.auth.onAuthStateChange((_e, session) => {
      void loadPlayer(sb, session)
    })
    window.addEventListener('online', () => void flushScores())
  } catch {
    set({ status: 'off' })
  }
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const redirect = `${window.location.origin}${window.location.pathname}`
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect, shouldCreateUser: true } })
  if (error) return { ok: false, error: error.message.includes('rate') ? 'Too many tries. Wait a minute and try again.' : "Couldn't send the link. Check the email and try again." }
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
  set({ name: row.display_name, publicName: row.public_name })
  saveConsent(consent)
  if (consent.optIn && data.session?.user.email) void subscribeNews(data.session.user.email)
  void flushScores()
  return { ok: true, publicName: row.public_name }
}

export async function signOut(): Promise<void> {
  const sb = await client()
  // local scope: only this device; this player's unsent scores stay queued under their id
  await sb?.auth.signOut({ scope: 'local' }).catch(() => undefined)
  queueOwner = null
  set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined })
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
    const rows = q.map(({ at: _at, ...r }) => r)
    const { data: sess } = await sb.auth.getSession()
    if (sess.session?.user.id !== owner) return // switched player mid-send: leave the queue alone
    const { error } = await sb.from('scores').insert(rows)
    if (!error) {
      // keep anything queued while we were sending
      writeQueue(readQueue(owner).slice(q.length), owner)
      set({ lastSync: new Date().toISOString() })
    }
  } catch {
    /* stays queued */
  } finally {
    flushing = false
  }
}
