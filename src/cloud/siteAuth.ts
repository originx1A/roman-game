/**
 * Name-and-password accounts on romansgame.com (same Supabase project as the game).
 * The game calls https://romansgame.com/api/auth/* and then stores the returned
 * Supabase session the way the website does (setSession, localStorage, auto-refresh).
 * Preview deploys can point elsewhere with VITE_AUTH_BASE. No secret lives here.
 */

export const DEFAULT_AUTH_BASE = 'https://romansgame.com'
/** Public Turnstile site key (same widget as romansgame.com). The secret stays on the server. */
export const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAAFfTs2hm1baT01HK'
export const TERMS_VERSION = '2026-10-20'
export const PASSWORD_HINT = "Use 10 or more characters. Don't use your name or a password lots of people use."

export type AgeChoice = '13_plus' | 'under_13'
export type SignupPath = 'me' | 'child' | 'kid'

const PATH_GUIDES: Record<SignupPath, string> = {
  me: "Your player name and a password — that's all you need to play. The email below is optional: it's only there to get your account back if you forget your password.",
  child:
    "You're making this account for your child. Pick their player name and a password together if you can. Put YOUR email in the recovery box below — it becomes their safety net. Afterwards, make your own account too and link the two: a linked grown-up's account (their host account) can send them gifts and help when a password is forgotten.",
  kid: "This account is yours. Pick your player name and a password you can remember. You can skip the email — or, if a parent, grandparent or guardian says it's okay, put their email in: it only helps you get back in if you forget your password. HOW A GROWN-UP CAN HELP YOU: if they make their own account and link it to yours, they can send you gifts in the game and help you if you're ever locked out. Show them the 'For grown-ups' page — it explains it to them.",
}

export function signupGuide(path: SignupPath): string {
  return PATH_GUIDES[path] ?? PATH_GUIDES.me
}

/** For me is a 13+ account. For my child and I'm a kid are under-13 accounts. */
export function ageChoiceForPath(path: SignupPath): AgeChoice {
  return path === 'me' ? '13_plus' : 'under_13'
}

function envValue(name: string): string {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env
    return env?.[name]?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Origin of the website auth API, no trailing slash. */
export function authBase(): string {
  const fromEnv = envValue('VITE_AUTH_BASE')
  const raw = fromEnv || DEFAULT_AUTH_BASE
  return raw.replace(/\/+$/, '')
}

export function turnstileSiteKey(): string {
  return envValue('VITE_TURNSTILE_SITE_KEY') || DEFAULT_TURNSTILE_SITE_KEY
}

export function authUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${authBase()}${suffix}`
}

/** Login addresses the server invents. Never show these as the player's email or name. */
export function isSyntheticEmail(email?: string | null): boolean {
  if (!email || !email.includes('@')) return !email
  const host = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  return host === 'players.romansgame.invalid' || host === 'link.romansgame.invalid' || host.endsWith('.romansgame.invalid')
}

export function visibleEmail(email?: string | null): string {
  const trimmed = email?.trim() ?? ''
  return trimmed && !isSyntheticEmail(trimmed) ? trimmed : ''
}

/**
 * The account's player name, never an email and never only the first word
 * when the full player name is known.
 */
export function accountPlayerName(input: { player_name?: string | null; display_name?: string | null; name?: string | null }): string {
  for (const raw of [input.player_name, input.name, input.display_name]) {
    const value = (raw ?? '').trim().replace(/\s+/g, ' ')
    if (value && !value.includes('@')) return value
  }
  return ''
}

/**
 * In-game and leaderboard label. The account player name wins.
 * A public label that is only the first word of that name is the short name the game used to show by mistake.
 */
export function leaderboardName(playerName: string, publicName?: string | null): string {
  const player = playerName.trim().replace(/\s+/g, ' ')
  const pub = (publicName ?? '').trim().replace(/\s+/g, ' ')
  if (!player) return pub.includes('@') ? '' : pub
  if (!pub || pub === player || pub.includes('@')) return player
  const first = player.split(' ')[0]
  if (pub === first) return player
  return player
}

export function guestSaveLabel(pending: number): string {
  return pending > 0 ? `Create an account to save your scores (${pending} waiting)` : 'Create an account to save your scores'
}

export interface AuthPayload {
  error?: string
  message?: string
  hint?: string
  player_name?: string
  display_name?: string
  auto_named?: boolean
  parent_email_pending?: boolean
  session?: { access_token?: string; refresh_token?: string }
  access_token?: string
  refresh_token?: string
}

export interface AuthCall {
  ok: boolean
  status: number
  data: AuthPayload | null
  error?: string
  playerName: string
  accessToken: string
  refreshToken: string
  autoNamed: boolean
  parentEmailPending: boolean
}

/** Same sentences as the website's name-and-password sheet. */
export function nameAuthError(status: number, data: AuthPayload | null, isSignUp: boolean): string {
  const code = String(data?.error || '')
  const m = String(data?.message || data?.error || '')
  if (status === 429 || code === 'rate_limited' || /rate/i.test(m)) return 'Too many tries. Wait a minute and try again.'
  if (status === 503 || code === 'unavailable' || /unavailable/i.test(m)) {
    return 'The name-and-password service is still being switched on. Use the sign-in code option for now — it works today.'
  }
  if (status === 403 || code === 'turnstile_required' || /turnstile/i.test(m)) {
    return 'The service wants the person-check finished. Tick the box, then try again.'
  }
  if (code === 'weak_password') return data?.hint?.trim() || PASSWORD_HINT
  if (code === 'bad_recovery_email') return 'Check the recovery email, or leave it empty.'
  if (code === 'age_required') return 'Please confirm you are 13 or older.'
  if (status === 422 || code === 'name_rejected' || /name_rejected/i.test(m)) return "That name can't be used. Pick another one."
  if (code === 'email_taken') return 'That recovery email is already on an account. Sign in with it, or use another email.'
  if (status === 401 || code === 'invalid_credentials' || /password|credential/i.test(m)) {
    return "That player name and password didn't match. Try again."
  }
  if (status === 409 || code === 'name_taken' || /taken|exists/i.test(m)) return 'That player name is taken. Pick another one.'
  return isSignUp ? "Couldn't make the account just now. Try again in a moment." : "Couldn't sign you in just now. Try again in a moment."
}

function readTokens(data: AuthPayload | null): { access: string; refresh: string } {
  const pair = data?.session ?? data
  return {
    access: typeof pair?.access_token === 'string' ? pair.access_token : '',
    refresh: typeof pair?.refresh_token === 'string' ? pair.refresh_token : '',
  }
}

export async function postAuth(path: string, body: Record<string, unknown>, accessToken?: string): Promise<AuthCall> {
  let status = 0
  let data: AuthPayload | null = null
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
    if (accessToken) headers.authorization = `Bearer ${accessToken}`
    const res = await fetch(authUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    status = res.status
    data = (await res.json().catch(() => null)) as AuthPayload | null
    const tokens = readTokens(data)
    const playerName = accountPlayerName({ player_name: data?.player_name, display_name: data?.display_name })
    return {
      ok: res.ok,
      status,
      data,
      playerName,
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      autoNamed: data?.auto_named === true,
      parentEmailPending: data?.parent_email_pending === true,
      error: res.ok ? undefined : nameAuthError(status, data, path.endsWith('signup')),
    }
  } catch {
    return {
      ok: false,
      status,
      data,
      playerName: '',
      accessToken: '',
      refreshToken: '',
      autoNamed: false,
      parentEmailPending: false,
      error: path.endsWith('signup')
        ? "Couldn't reach the sign-up service. Your progress is still on this device."
        : "Couldn't reach the sign-in service. Your progress is still on this device.",
    }
  }
}

export function signInBody(name: string, password: string, stay: boolean, captchaToken?: string): Record<string, unknown> {
  const body: Record<string, unknown> = { name: name.trim(), password, stay_signed_in: stay }
  if (captchaToken) body.captchaToken = captchaToken
  return body
}

export function signUpBody(input: {
  name: string
  password: string
  path: SignupPath
  email: string
  news: boolean
  stay: boolean
  captchaToken: string
}): Record<string, unknown> {
  const age = ageChoiceForPath(input.path)
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    password: input.password,
    age_choice: age,
    captchaToken: input.captchaToken,
    stay_signed_in: input.stay,
    terms_accepted: true,
    terms_version: TERMS_VERSION,
    marketing_opt_in: input.news,
  }
  if (age === '13_plus') body.age_confirmed = true
  const email = input.email.trim()
  if (email) body.email = email
  return body
}

let turnstileLoading: Promise<boolean> | null = null

export function loadTurnstile(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const w = window as Window & { turnstile?: unknown }
  if (w.turnstile) return Promise.resolve(true)
  if (turnstileLoading) return turnstileLoading
  turnstileLoading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return turnstileLoading
}

export function validEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim())
}

/** Player name from POST /api/auth/session. Empty when the site API is down or the session is a magic link it does not know. */
export async function fetchAccountName(accessToken: string): Promise<string> {
  if (!accessToken) return ''
  const call = await postAuth('/api/auth/session', {}, accessToken)
  return call.ok ? call.playerName : ''
}
