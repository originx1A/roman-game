import { gaEvent } from '../game/analytics'
/**
 * Player accounts + score saving (Supabase, project romans-game).
 *
 * - Sign-in: player name + password, through the same /api/auth/* service the
 *   romansgame.com website uses (Tony 2026-11-07: one model everywhere — name +
 *   password is the key, email is for recovery only). The API hands back a real
 *   Supabase session pair, which lands on the lazy client with setSession, so
 *   everything downstream (player row, scores, the Unseen card) is unchanged.
 * - The old email-code door (magic link / code) stays alive ONLY as the claim
 *   bootstrap: an existing game player signs in by code once, then gives the
 *   account a name + password (POST /api/auth/claim) and uses that from then on.
 * - Scores: queued locally first, then sent. Offline / Supabase down / not signed in = they wait
 *   in the queue (max 200) and flush on sign-in, on `online`, and after each new game.
 * - supabase-js is loaded lazily, so the game never waits on it and works fully without it.
 */
import type { SupabaseClient, Session } from '@supabase/supabase-js'

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
  pending: number
  lastSync?: string
  /**
   * Account shape, from the shared door (session probe): 'password' = the account
   * has its name+password door (it has a profiles row, or it was born on the new
   * door); 'code' = a game-born email-code account that has not claimed yet;
   * undefined = unknown (probe failed / signed out) — the UI then offers the
   * claim as an option rather than asserting it is needed.
   */
  authKind?: 'password' | 'code'
}

const QUEUE_KEY = 'rg.cloud.queue.v1'

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
  if (data) void flushScores().then(() => syncCard())
  void probeAuthKind(session)
}

/**
 * Which door does this account have? A website-born (or claimed) account signs
 * in with name + password; its login address is synthetic. A game-born account
 * still carries its real email and no password. Asked once per session change
 * via the shared door's session probe: it answers 200 for ANY live session,
 * but only an account WITH a profile on the shared door (claimed or
 * website-born) gets its player name back in the answer — that name is the
 * password tell. No name in the answer + a real-email auth address reads as a
 * code account; a synthetic address reads as a password account. Never blocks
 * anything.
 */
let probedFor: string | null = null
async function probeAuthKind(session: Session): Promise<void> {
  const uid = session.user.id
  if (probedFor === uid) return
  probedFor = uid
  const synthetic = (session.user.email ?? '').endsWith('@players.romansgame.invalid')
  try {
    const { status, data } = await authPost('/api/auth/session', {}, session.access_token)
    // A bare 200 proves only that the session is live — the probe answers for
    // game-born code accounts too. Without a profile name in the answer there
    // is no name + password login yet, whatever the status says; fall through
    // to the address shape instead of misreading the account as claimed.
    if (status === 200 && (data?.player_name || data?.display_name)) {
      if (state.authKind !== 'password') set({ authKind: 'password' })
      return
    }
  } catch {
    /* fall through to the address shape */
  }
  set({ authKind: synthetic ? 'password' : 'code' })
}

/** Call once at startup. Never throws, never blocks. */
export async function initCloud(): Promise<void> {
  try {
    const sb = await client()
    if (!sb) return set({ status: 'off' })
    // Handoff from the other origin: redeem the one-time code first, so
    // the session it lands wins over any stale local one. Best effort —
    // a bad code just means sign in normally.
    try {
      const code = new URLSearchParams(window.location.search).get('sso')
      if (code) {
        stripSsoParam()
        await redeemHandoffCode(code)
      }
    } catch {
      /* ignore */
    }
    const { data } = await sb.auth.getSession()
    await loadPlayer(sb, data.session)
    sb.auth.onAuthStateChange((_e, session) => {
      if (_e === 'SIGNED_IN' && state.status !== 'signed-in') gaEvent('sign_in')
      void loadPlayer(sb, session)
    })
    window.addEventListener('online', () => void flushScores())
  } catch {
    set({ status: 'off' })
  }
}

/* The auth API lives on romansgame.com (this site's own /api/* is the
 * game's checkout functions, never auth). It is used for exactly two
 * things now: the /api/auth/session probe in loadPlayer, and the
 * cross-origin handoff (mint/redeem) below. Sign-in itself lives on the
 * hub and the website — never in the game (Tony Nov 12, 2026). */

export const AUTH_BASE = 'https://romansgame.com'

export interface AuthAccount {
  userId: string
  /** The public display name (group-name safe), as the API returns it. */
  displayName: string
  /** The full chosen name the player signs in with. '' when server-generated. */
  playerName: string
}

export interface AuthResult {
  ok: boolean
  error?: string
  account?: AuthAccount
  /** The API demands the person check (Turnstile) before it will proceed. */
  captchaNeeded?: boolean
  /** Another account-scope fact the UI must phrase itself (e.g. dual account). */
  code?: string
  /** Signup only: a recovery/parent email is waiting for its confirm tap. */
  emailPending?: boolean
}

interface AuthApiBody {
  user_id?: string
  display_name?: string
  player_name?: string
  error?: string
  message?: string
  hint?: string
  session?: { access_token: string; refresh_token: string }
  recovery_email_pending?: boolean
  parent_email_pending?: boolean
  reset_token?: string
  /** One-time cross-origin handoff code (mint response). */
  code?: string
  accounts?: { user_id: string; player_name: string; role: string }[]
}

async function authPost(path: string, payload: Record<string, unknown>, bearer?: string): Promise<{ status: number; data: AuthApiBody | null }> {
  try {
    const r = await fetch(`${AUTH_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(payload),
    })
    return { status: r.status, data: (await r.json().catch(() => null)) as AuthApiBody | null }
  } catch {
    return { status: 0, data: null }
  }
}

/** Land an API session pair on the game client; loadPlayer then runs off the session. */
async function adoptApiSession(data: AuthApiBody): Promise<AuthResult> {
  const sb = await client()
  if (!sb || !data.session) return { ok: false, error: "You're offline. Try again when you're connected." }
  const { error } = await sb.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
  if (error) return { ok: false, error: "Couldn't finish signing in. Try again." }
  return {
    ok: true,
    account: { userId: String(data.user_id ?? ''), displayName: String(data.display_name ?? ''), playerName: String(data.player_name ?? '') },
  }
}

/* ------------- Cross-origin sign-in handoff (Tony, Nov 12, 2026) -------------
 * One sign-in, one account, shown wherever the player is. The origin where
 * the player signed in mints a 5-minute single-use code; this origin trades
 * it for the session pair server-side. NO token ever goes in a URL — the
 * code travels in the URL, the tokens travel server-side. */

/** Mint a handoff code for the current session, or null when signed out / offline. */
export async function mintHandoffCode(): Promise<string | null> {
  const sb = await client()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  const s = data.session
  if (!s?.access_token || !s.refresh_token) return null
  const { status, data: out } = await authPost('/api/auth/handoff/mint', { refresh_token: s.refresh_token }, s.access_token)
  return status === 200 && out && typeof out.code === 'string' ? out.code : null
}

/** Trade a handoff code for the session pair. False when the code is bad, used, or expired. */
export async function redeemHandoffCode(code: string): Promise<boolean> {
  const { status, data } = await authPost('/api/auth/handoff/redeem', { code })
  if (status !== 200 || !data?.session) return false
  return adoptApiSession(data).then((r) => r.ok)
}

/** Strip ?sso= from the URL the moment it is read, so the one-time code never lingers in history. */
export function stripSsoParam(): void {
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('sso')) return
    u.searchParams.delete('sso')
    window.history.replaceState(null, '', u.pathname + u.search + u.hash)
  } catch {
    /* non-URL environments: ignore */
  }
}

/**
 * Open the website in a new tab, carrying the sign-in over when the
 * player has one. The tab opens synchronously in the click (a popup
 * blocker would eat an async open), then minting upgrades it to the
 * ?sso= URL; when minting fails the tab simply stays on the plain URL.
 */
export function openWebsite(href: string): void {
  const win = window.open(href, '_blank')
  if (!win) {
    window.location.href = href
    return
  }
  void mintHandoffCode().then((code) => {
    if (!code) return
    try {
      const base = href.split('?')[0].split('#')[0]
      win.location.href = `${base}?sso=${encodeURIComponent(code)}`
    } catch {
      /* the tab is already on its way: leave it */
    }
  })
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
