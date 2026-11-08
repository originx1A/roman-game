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
 * via the shared door's session probe (it answers for profiles-row accounts);
 * no answer + a real-email auth address reads as a code account; no answer +
 * a synthetic address reads as a password account. Never blocks anything.
 */
let probedFor: string | null = null
async function probeAuthKind(session: Session): Promise<void> {
  const uid = session.user.id
  if (probedFor === uid) return
  probedFor = uid
  const synthetic = (session.user.email ?? '').endsWith('@players.romansgame.invalid')
  try {
    const { status } = await authPost('/api/auth/session', {}, session.access_token)
    if (status === 200) {
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

/* ------------------------------------------------------------------ */
/* The shared name+password door: romansgame.com /api/auth/*           */
/*                                                                     */
/* Absolute URLs on purpose: this site's own /api/* is the game's      */
/* checkout functions, never auth. Sessions arrive as a token pair     */
/* in the JSON body and land on the supabase-js client via setSession  */
/* — the website's own trick (applyNameSession in its accounts.js).    */
/* ------------------------------------------------------------------ */

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

/** Error copy mirrors the website's own wording (auth-client.js nameAuthError). */
export function authErrorMessage(status: number, data: AuthApiBody | null, isSignUp: boolean): string {
  if (!status) return "Couldn't reach the account service. Check your connection and try again. Your progress is still on this device."
  const code = data?.error ? String(data.error) : ''
  const hint = data?.hint ? String(data.hint) : ''
  const message = data?.message ? String(data.message) : ''
  if (status >= 500 || code === 'unavailable') return 'The account service is unavailable right now. Try again in a moment. Your progress is still on this device.'
  if (status === 429 || code === 'rate_limited') return message || 'Too many tries. Wait a minute and try again.'
  if (code === 'age_required') return "Choose who this account is for. If it is for you, tick I'm 13 or older. If it is for a child, leave it unticked and put a grown-up's email in."
  if (code === 'age_locked') return 'This account already has an age saved. Sign in instead of creating it again.'
  if (code === 'weak_password') return hint ? `Pick a stronger password. ${hint}` : "Pick a stronger password. Use 10 or more characters, and don't use your name or a very common password."
  if (code === 'bad_recovery_email') return "That recovery email doesn't look right. Check it, or leave it empty if this account is for you."
  if (code === 'name_rejected') return "That name can't be used. Pick another one."
  if (code === 'name_taken') return 'That player name is taken. Pick another one.'
  if (code === 'email_taken') return 'That email is already on an account. Sign in with it, or use a different email.'
  if (code === 'terms_required') return 'Please accept the Terms and Privacy Policy.'
  if (code === 'turnstile_required') return 'Finish the person check, then try again.'
  if (code === 'captcha_failed') return "The person check didn't go through. Wait for it to finish, then try again."
  if (code === 'invalid_credentials') return "That name and password didn't match. Try again, or reset your password."
  if (code === 'code_invalid') return message || "That code didn't work. You can try again, or use the button in the email."
  if (code === 'session_expired') return 'That sign-in expired. Sign in again.'
  if (status === 422) return 'Check the name, password, email, and age, then try again.'
  return isSignUp ? "Couldn't make the account just now. Try again in a moment." : "Couldn't sign you in just now. Try again in a moment."
}

function authFailure(status: number, data: AuthApiBody | null, isSignUp: boolean): AuthResult {
  const code = data?.error ? String(data.error) : ''
  return {
    ok: false,
    code,
    captchaNeeded: code === 'turnstile_required' || code === 'captcha_failed',
    error: authErrorMessage(status, data, isSignUp),
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

/** Sign in with player name + password (the shared door). stay_signed_in: true
 * matches the game's always-persistent sessions. captchaToken only on a retry
 * after the API asks for the person check (it never asks on a first try). */
export async function signInWithPassword(name: string, password: string, captchaToken?: string): Promise<AuthResult> {
  const payload: Record<string, unknown> = { name: name.trim(), password, stay_signed_in: true }
  if (captchaToken) payload.captchaToken = captchaToken
  const { status, data } = await authPost('/api/auth/signin', payload)
  if (status === 200 && data?.session) return adoptApiSession(data)
  return authFailure(status, data, false)
}

export interface CreateInput {
  name: string
  password: string
  age13: boolean
  terms: boolean
  /** 13+: optional recovery email. Under 13: the grown-up's email (required by the API). */
  email?: string
  optIn: boolean
  captchaToken?: string
}

/**
 * Create an account on the shared door. The age answer becomes the server's
 * locked record (age_choice), never just a device note: 13+ ticks map to
 * '13_plus'; unticked maps to 'under_13' and the API then requires the
 * grown-up email in `email`. The person check is mandatory for signup — with
 * no token the API refuses (turnstile_required) and nothing is created.
 */
export async function createAccount(input: CreateInput): Promise<AuthResult> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    password: input.password,
    age_choice: input.age13 ? '13_plus' : 'under_13',
    terms_accepted: input.terms,
    marketing_opt_in: input.optIn,
    stay_signed_in: true,
  }
  if (input.email?.trim()) payload.email = input.email.trim()
  if (input.captchaToken) payload.captchaToken = input.captchaToken
  const { status, data } = await authPost('/api/auth/signup', payload)
  if (status === 201 && data?.session) {
    const r = await adoptApiSession(data)
    if (r.ok) r.emailPending = !!(data.recovery_email_pending || data.parent_email_pending)
    return r
  }
  return authFailure(status, data, true)
}

/* ------------------------- Turnstile (person check) ------------------------- */

let turnstileApiP: Promise<any> | null = null
function loadTurnstileApi(): Promise<any> {
  if (!turnstileApiP) {
    turnstileApiP = new Promise((resolve, reject) => {
      const w = window as any
      if (w.turnstile) return resolve(w.turnstile)
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = () => resolve((window as any).turnstile)
      s.onerror = () => reject(new Error('turnstile load failed'))
      document.head.appendChild(s)
    }).catch((e) => {
      turnstileApiP = null
      throw e
    })
  }
  return turnstileApiP
}

/** The production site key, from the same public config the website reads. */
export async function authSiteKey(): Promise<string | null> {
  try {
    const r = await fetch(`${AUTH_BASE}/api/auth/config`, { headers: { accept: 'application/json' } })
    if (!r.ok) return null
    const data = (await r.json().catch(() => null)) as { turnstileSiteKey?: string } | null
    return data?.turnstileSiteKey ?? null
  } catch {
    return null
  }
}

/**
 * Render the person check into `container` and resolve with its token.
 * Resolves null when the widget cannot run here (script blocked, or this
 * origin is not on the site key's Cloudflare hostname list — the dashboard
 * item flagged in Phase 0). Callers must fail closed on null, exactly as
 * the website does: no token, no signup.
 */
export async function renderTurnstile(container: HTMLElement): Promise<string | null> {
  try {
    const key = await authSiteKey()
    if (!key) return null
    const ts = await loadTurnstileApi()
    if (!ts) return null
    return await new Promise<string | null>((resolve) => {
      let settled = false
      const done = (v: string | null) => {
        if (!settled) {
          settled = true
          resolve(v)
        }
      }
      const id = ts.render(container, {
        sitekey: key,
        callback: (token: string) => done(token),
        'error-callback': () => done(null),
        'expired-callback': () => done(null),
      })
      window.setTimeout(() => {
        if (!settled) {
          try {
            ts.remove(id)
          } catch {
            /* widget already gone */
          }
          done(null)
        }
      }, 30_000)
    })
  } catch {
    return null
  }
}

/* ------------------------- The claim (Phase 2) ------------------------- */

export interface ClaimInput {
  name: string
  password: string
  age13: boolean
  terms: boolean
  optIn: boolean
  captchaToken?: string
}

/**
 * Give an existing email-code account its name + password (POST /api/auth/claim,
 * bearer = the live code session). The server writes the name directory row,
 * sets the password, swaps the login email to the synthetic address, and files
 * the real email as the verified recovery address — same user ID throughout,
 * so scores, the card and the leaderboard name carry by construction.
 * 'dual_account' comes back as a code so the UI can show the support path.
 */
export async function claimAccount(input: ClaimInput): Promise<AuthResult> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: 'Please sign in first.' }
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    password: input.password,
    age_choice: input.age13 ? '13_plus' : 'under_13',
    terms_accepted: input.terms,
    marketing_opt_in: input.optIn,
    stay_signed_in: true,
  }
  if (input.captchaToken) payload.captchaToken = input.captchaToken
  const { status, data: res } = await authPost('/api/auth/claim', payload, token)
  if (status === 200 && res) {
    return {
      ok: true,
      account: { userId: String(res.user_id ?? data.session?.user.id ?? ''), displayName: String(res.display_name ?? ''), playerName: String(res.player_name ?? input.name.trim()) },
    }
  }
  const failure = authFailure(status, res, true)
  // The dual-account stop carries its own plain-words explanation from the server.
  if (failure.code === 'dual_account' && res?.message) failure.error = String(res.message)
  return failure
}

/* ------------------------- Recovery (Phase 3) ------------------------- */

/** Forgot step 1: email a reset code + link to the account's recovery address.
 * The API answers the same whether or not it sent (anti-enumeration). */
export async function recoverStart(email: string, captchaToken?: string): Promise<AuthResult> {
  const payload: Record<string, unknown> = { email: email.trim() }
  if (captchaToken) payload.captchaToken = captchaToken
  const { status, data } = await authPost('/api/auth/recover/lost/start', payload)
  if (status === 202) return { ok: true }
  return authFailure(status, data, false)
}

export interface ResetGrant {
  token: string
  accounts: { userId: string; playerName: string; role: string }[]
}

/** Forgot step 2: the code from the email becomes a one-time reset grant. */
export async function recoverCode(email: string, code: string, captchaToken?: string): Promise<{ ok: boolean; error?: string; captchaNeeded?: boolean; grant?: ResetGrant }> {
  const payload: Record<string, unknown> = { email: email.trim(), code: code.trim() }
  if (captchaToken) payload.captchaToken = captchaToken
  const { status, data } = await authPost('/api/auth/recover/lost/code', payload)
  if (status === 200 && data?.reset_token) {
    return {
      ok: true,
      grant: {
        token: String(data.reset_token),
        accounts: (data.accounts ?? []).map((a) => ({ userId: String(a.user_id), playerName: String(a.player_name ?? ''), role: String(a.role ?? 'account') })),
      },
    }
  }
  const f = authFailure(status, data, false)
  return { ok: false, error: f.error, captchaNeeded: f.captchaNeeded }
}

/** Forgot step 3: set the new password with the grant; the API signs the
 * player straight back in (its reply carries a fresh session pair). */
export async function recoverFinish(grant: ResetGrant, userId: string, newPassword: string, captchaToken?: string): Promise<AuthResult> {
  const payload: Record<string, unknown> = { reset_token: grant.token, user_id: userId, new_password: newPassword, stay_signed_in: true }
  if (captchaToken) payload.captchaToken = captchaToken
  const { status, data } = await authPost('/api/auth/recover/lost/finish', payload)
  if (status === 200 && data?.session) return adoptApiSession(data)
  return authFailure(status, data, false)
}

/** Add a recovery email to the signed-in account (the confirm code/link the
 * API mails completes it). Refused server-side when one is already verified. */
export async function addRecoveryEmail(email: string): Promise<AuthResult> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const { data: sess } = await sb.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return { ok: false, error: 'Please sign in first.' }
  const { status, data } = await authPost('/api/auth/email-add', { email: email.trim() }, token)
  if (status === 200 || status === 202) return { ok: true }
  return authFailure(status, data, false)
}

/** Sign out through the shared door too (best effort), then the local sign-out. */
export async function signOutEverywhere(): Promise<void> {
  try {
    const sb = await client()
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } }
    const token = data.session?.access_token
    if (token) await authPost('/api/auth/signout', {}, token)
  } catch {
    /* the local sign-out below is the one that matters on this device */
  }
  await signOut()
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const redirect = `${window.location.origin}${window.location.pathname}`
  const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect, shouldCreateUser: true } })
  if (error) return { ok: false, error: error.message.includes('rate') ? 'Too many tries. Wait a minute and try again.' : "Couldn't send the link. Check the email and try again." }
  return { ok: true }
}

/**
 * The code from the same email as the magic link. The project sends 6 to 8 digits.
 * verifyOtp signs the player in and fires SIGNED_IN. The listener in initCloud then runs
 * loadPlayer, which copies this device's queued scores onto the account and flushes them.
 * That is the same path as opening the link.
 */
export async function verifyEmailCode(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await client()
  if (!sb) return { ok: false, error: "You're offline. Try again when you're connected." }
  const code = token.replace(/\s/g, '')
  if (!/^\d{6,8}$/.test(code)) return { ok: false, error: 'Enter the code from your email.' }
  const { data, error } = await sb.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
  if (error || !data.session) {
    return { ok: false, error: error?.message?.includes('rate') ? 'Too many tries. Wait a minute and try again.' : "That code didn't work. Check it and try again." }
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
  probedFor = null
  set({ status: 'signed-out', email: undefined, name: undefined, publicName: undefined, authKind: undefined })
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
