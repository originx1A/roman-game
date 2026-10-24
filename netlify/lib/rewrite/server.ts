import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  APPROVAL_DAYS,
  BUILD_NUMBER,
  CASH_AGE,
  MAX_HEARTS,
  REMINDER_DAYS,
  RESET_MINUTES,
  SUPPORT_EMAIL,
  TERMS_VERSION,
  formatPrice,
  priceForCountry,
  type Sku,
} from '../../../src/game/catalog.ts'
import { MissingKey, SchemaError, Store, TakenError, openStore, type Env } from './db.ts'
import { formatTeamName, parseTeamName, type TeamNamePick } from '../../../src/game/teamNames.ts'
import { torontoDate } from '../../../src/game/generate.ts'
import type { Puzzle } from '../../../src/game/logic.ts'
import { boardFromPuzzleId, throneForBoards, winMap } from '../../../src/game/thrones.ts'
import { approvalMail, receiptMail, reminderMail, resetMail, sendMail, verificationMail, type Mail } from './mail.ts'

export type { Env }

export interface Account {
  id: string
  loginKey: string
  playerName: string
  email: string | null
  emailVerified: boolean
  pendingEmail: string | null
  authEmail: string
  passHash: string
  passSalt: string
  recoveryHash: string | null
  recoverySalt: string | null
  resetFresh?: boolean
  ageGate: 'over' | 'under' | null
  wins: number
  winsByBoard: Record<string, number>
  perfects: number
  coins: number
  starterOwned: boolean
  buyingStopped: boolean
  holder: boolean
  holderId: string | null
  memberIds: string[]
  pets: string[]
  clothes: string[]
  hostPet: string | null
  charges: Record<string, number>
  hearts: number
  bestRun: Record<string, number>
  streakDay: string | null
  streak: number
  dailyWin: string | null
  dailySeconds: number | null
  weekKey: string
  weekWins: number
  teamId: string | null
  sessions: string[]
  resetToken: string | null
  verifyToken: string | null
  termsVersion: string
  termsAt: string
  createdAt: string
  lastPlayed: string | null
  deleteAfter: string | null
  solved: string[]
  language: 'en' | 'fr' | null
  failedSignins: number
  lockedUntil: string | null
  purchaseAccepts: { sku: string; at: string; version: string }[]
}

export interface Team {
  id: string
  code: string
  name: string
  mascot: string
  openJoin: boolean
  members: { id: string; name: string; rank: 'leader' | 'captain' | 'member'; joinedAt: string }[]
  asks: { id: string; name: string; at: string }[]
  weekKey: string
  scores: Record<string, number>
  closed: boolean
}

export interface Challenge {
  code: string
  puzzle: Puzzle
  senderName: string
  senderSeconds: number
  senderId: string | null
  results: { name: string; seconds: number; won: boolean }[]
}

export interface Order {
  id: string
  accountId: string
  sku: Sku
  cents: number
  currency: 'cad' | 'usd'
  price: string
  status: 'review' | 'paid'
  acceptedAt: string
  paidAt: string | null
  sessionId: string | null
  wasntToken: string | null
  wasntUsed: boolean
}

export interface Approval {
  token: string
  playerId: string
  playerName: string
  email: string
  createdAt: string
  lastMailAt: string
  reminderSent: boolean
  status: 'pending' | 'approved' | 'declined' | 'expired'
}

const BANNED = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'slut', 'whore', 'fag', 'nigger', 'nigga', 'retard', 'rape', 'nazi', 'hitler', 'porn', 'sex']

function profane(name: string): boolean {
  const squash = name.toLowerCase().replace(/[^a-z]/g, '')
  return BANNED.some((word) => squash.includes(word))
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function passwordMatches(kv: Store, account: Account, password: string): Promise<boolean> {
  return kv.passwordOk(account.authEmail, password)
}

function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex')
}

function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const chunk = () => Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join('')
  return `ROMA-${chunk()}-${chunk()}`
}

function emailOf(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function weekKey(now = new Date()): string {
  const day = torontoDate(now)
  const date = new Date(`${day}T12:00:00Z`)
  const onejan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7)
  return `${date.getUTCFullYear()}-W${week}`
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers)
  h.set('content-type', 'application/json; charset=utf-8')
  h.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers: h })
}

function cookie(token: string | null, secure: boolean): string {
  if (!token) return `rg=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
  return `rg=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`
}

function readCookie(req: Request): string | null {
  const raw = req.headers.get('cookie') ?? ''
  const hit = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('rg='))
  return hit ? decodeURIComponent(hit.slice(3)) : null
}

function originOf(req: Request, env: Env): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const forwarded = req.headers.get('x-forwarded-proto')
  const proto = forwarded || new URL(req.url).protocol.replace(':', '') || 'https'
  if (host) return `${proto}://${host}`
  return (env.DEPLOY_PRIME_URL || env.URL || 'http://localhost:5173').replace(/\/$/, '')
}

function clientIp(req: Request): string {
  return req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
}

function publicMe(account: Account) {
  const boards = winMap(account)
  const throne = throneForBoards(boards)
  return {
    id: account.id,
    playerName: account.playerName,
    email: account.email,
    emailVerified: account.emailVerified,
    ageGate: account.ageGate,
    wins: account.wins,
    winsByBoard: boards,
    perfects: account.perfects,
    coins: account.coins,
    starterOwned: account.starterOwned,
    buyingStopped: account.buyingStopped,
    holder: account.holder,
    holderId: account.holderId,
    pets: account.pets,
    clothes: account.clothes,
    hostPet: account.hostPet,
    charges: account.charges,
    hearts: account.hearts,
    bestRun: account.bestRun,
    streak: account.streak,
    teamId: account.teamId,
    language: account.language,
    throne: throne ? { id: throne.id, name: throne.name, nameFr: throne.nameFr } : null,
    deleteAfter: account.deleteAfter,
    build: BUILD_NUMBER,
  }
}

async function rate(kv: Store, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const hit = (await kv.get<{ at: number[] }>(key)) ?? { at: [] }
  hit.at = hit.at.filter((t) => now - t < windowMs)
  if (hit.at.length >= limit) return false
  hit.at.push(now)
  await kv.set(key, hit)
  return true
}

async function saveAccount(kv: Store, account: Account): Promise<void> {
  await kv.set(`account:${account.id}`, account)
  await kv.set(`login:${account.loginKey}`, account.id)
  await kv.set(`login:${account.playerName.toLowerCase()}`, account.id)
  if (account.email) await kv.set(`email:${account.email.toLowerCase()}`, account.id)
}

async function byLogin(kv: Store, login: string): Promise<Account | null> {
  const id = await kv.get<string>(`login:${login.trim().toLowerCase()}`)
  if (!id) return null
  return kv.get<Account>(`account:${id}`)
}

async function byEmail(kv: Store, email: string): Promise<Account | null> {
  const id = await kv.get<string>(`email:${email.trim().toLowerCase()}`)
  if (!id) return null
  return kv.get<Account>(`account:${id}`)
}

async function bySession(kv: Store, req: Request): Promise<Account | null> {
  const token = readCookie(req)
  if (!token) return null
  const row = await kv.get<{ accountId: string }>(`session:${token}`)
  if (!row) return null
  const account = await kv.get<Account>(`account:${row.accountId}`)
  if (!account || !account.sessions.includes(token)) return null
  if (account.deleteAfter && Date.parse(account.deleteAfter) < Date.now()) return null
  return account
}

async function startSession(kv: Store, account: Account, secure: boolean): Promise<{ account: Account; cookie: string }> {
  const token = randomToken()
  account.sessions = [...account.sessions, token].slice(-12)
  account.failedSignins = 0
  account.lockedUntil = null
  if (account.deleteAfter) account.deleteAfter = null
  await saveAccount(kv, account)
  await kv.set(`session:${token}`, { accountId: account.id, at: new Date().toISOString() })
  return { account, cookie: cookie(token, secure) }
}

function blankAccount(input: { loginKey: string; playerName: string; email: string | null; authEmail: string }): Account {
  return {
    id: crypto.randomUUID(),
    loginKey: input.loginKey,
    playerName: input.playerName,
    email: input.email,
    emailVerified: false,
    pendingEmail: null,
    authEmail: input.authEmail,
    passHash: 'supabase',
    passSalt: 'supabase',
    recoveryHash: null,
    recoverySalt: null,
    ageGate: null,
    wins: 0,
    winsByBoard: {},
    perfects: 0,
    coins: 0,
    starterOwned: false,
    buyingStopped: false,
    holder: false,
    holderId: null,
    memberIds: [],
    pets: [],
    clothes: [],
    hostPet: null,
    charges: {},
    hearts: MAX_HEARTS,
    bestRun: {},
    streakDay: null,
    streak: 0,
    dailyWin: null,
    dailySeconds: null,
    weekKey: weekKey(),
    weekWins: 0,
    teamId: null,
    sessions: [],
    resetToken: null,
    verifyToken: null,
    termsVersion: TERMS_VERSION,
    termsAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    lastPlayed: null,
    deleteAfter: null,
    solved: [],
    language: null,
    failedSignins: 0,
    lockedUntil: null,
    purchaseAccepts: [],
  }
}

async function uniqueName(kv: Store, base: string): Promise<string> {
  let name = base.slice(0, 24)
  let n = 1
  while (await kv.get(`login:${name.toLowerCase()}`)) {
    n += 1
    name = `${base.slice(0, 20)}${String(n).padStart(2, '0')}`.slice(0, 24)
  }
  return name
}

async function devSave(kv: Store, mail: Mail): Promise<void> {
  const box = (await kv.get<Mail[]>('mailbox')) ?? []
  box.unshift({ ...mail })
  await kv.set('mailbox', box.slice(0, 40))
}

async function mail(env: Env, kv: Store, message: Mail): Promise<{ ok: boolean; dev?: boolean }> {
  if (!env.RESEND_API_KEY) {
    if (env.RG_DEV_MAILBOX === '1' && env.CONTEXT !== 'production') {
      await devSave(kv, message)
      return { ok: true, dev: true }
    }
    return { ok: false }
  }
  return sendMail(env.RESEND_API_KEY, message, (item) => devSave(kv, item))
}

function ageFrom(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > new Date().getFullYear()) return null
  const born = new Date(Date.UTC(year, month - 1, day))
  if (born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) return null
  const today = new Date()
  let age = today.getUTCFullYear() - year
  const m = today.getUTCMonth() + 1
  if (m < month || (m === month && today.getUTCDate() < day)) age -= 1
  return age
}

function stripeAllowed(key: string, context: string | undefined): boolean {
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return true
  return context === 'production' && (key.startsWith('sk_live_') || key.startsWith('rk_live_'))
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/$/, '') || '/'
  const secure = (req.headers.get('x-forwarded-proto') || url.protocol).includes('https')
  const kv = openStore(env)
  const origin = originOf(req, env)

  if (path === '/api/health') return json({ ok: true, build: BUILD_NUMBER, ...(await kv.status()) })

  if (path === '/api/dev/mailbox' && req.method === 'GET') {
    if (env.RG_DEV_MAILBOX !== '1' || env.CONTEXT === 'production') return json({ error: 'not-found' }, 404)
    return json({ mailbox: (await kv.get<Mail[]>('mailbox')) ?? [] })
  }

  if (path === '/api/stripe-webhook' && req.method === 'POST') {
    try {
      return await stripeWebhook(req, env, kv)
    } catch (err) {
      return failure(err)
    }
  }

  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    const text = await req.text()
    if (text.length > 100_000) return json({ error: 'too-large' }, 413)
    if (text) {
      try {
        body = JSON.parse(text) as Record<string, unknown>
      } catch {
        return json({ error: 'bad-json' }, 400)
      }
    }
  }

  try {
    const me = await bySession(kv, req)
    const ip = clientIp(req)
    if (path === '/api/join' && req.method === 'POST') return await join(kv, env, body, origin, secure, ip)
    if (path === '/api/signin' && req.method === 'POST') return await signin(kv, body, secure, ip)
    if (path === '/api/signout' && req.method === 'POST') return await signout(kv, req, secure)
    if (path === '/api/signout-all' && req.method === 'POST') return await signoutAll(kv, me, secure)
    if (path === '/api/me' && req.method === 'GET') return await meRoute(kv, env, me, origin)
    if (path === '/api/recover/email' && req.method === 'POST') return await recoverEmail(kv, env, body, origin, ip)
    if (path === '/api/recover/code' && req.method === 'POST') return await recoverCode(kv, body, ip)
    if (path === '/api/reset' && req.method === 'POST') return await resetPassword(kv, body, secure)
    if (path === '/api/email/add' && req.method === 'POST') return await addEmail(kv, env, me, body, origin)
    if (path === '/api/email/verify' && req.method === 'POST') return await verifyEmail(kv, body)
    if (path === '/api/password' && req.method === 'POST') return await changePassword(kv, me, body)
    if (path === '/api/language' && req.method === 'POST') return await setLanguage(kv, me, body)
    if (path === '/api/data/download' && req.method === 'POST') return await downloadData(kv, env, me, body, origin)
    if (path === '/api/data/delete' && req.method === 'POST') return await deleteData(kv, me, body, secure)
    if (path === '/api/family/ask' && req.method === 'POST') return await familyAsk(kv, env, me, body, origin)
    if (path === '/api/family' && req.method === 'GET') return await familyGet(kv, me, url)
    if (path === '/api/family/answer' && req.method === 'POST') return await familyAnswer(kv, body, secure)
    if (path === '/api/family/add' && req.method === 'POST') return await familyAdd(kv, me, body)
    if (path === '/api/family/member' && req.method === 'POST') return await familyMember(kv, me, body)
    if (path === '/api/shop/birthday' && req.method === 'POST') return await birthday(kv, me, body)
    if (path === '/api/shop/accept' && req.method === 'POST') return await acceptOrder(kv, me, body, env)
    if (path === '/api/shop/checkout' && req.method === 'POST') return await checkout(kv, env, me, body, origin)
    if (path === '/api/shop/confirm' && req.method === 'POST') return await confirmCheckout(kv, env, me, body, origin)
    if (path === '/api/wasnt-me' && req.method === 'POST') return await wasntMe(kv, body)
    if (path === '/api/win' && req.method === 'POST') return await recordWin(kv, me, body)
    if (path === '/api/charge' && req.method === 'POST') return await spendCharge(kv, me, body)
    if (path === '/api/leaderboard' && req.method === 'GET') return await leaderboard(kv, url, me)
    if (path === '/api/challenge' && req.method === 'POST') return await makeChallenge(kv, me, body)
    if (path.startsWith('/api/challenge/') && req.method === 'GET') return await getChallenge(kv, path.split('/').pop()!)
    if (path.startsWith('/api/challenge/') && req.method === 'POST') return await challengeResult(kv, path.split('/').pop()!, body)
    if (path === '/api/team' && req.method === 'POST') return await makeTeam(kv, me, body)
    if (path === '/api/team' && req.method === 'GET') return await getTeam(kv, me, url)
    if (path === '/api/team/join' && req.method === 'POST') return await joinTeam(kv, me, body)
    if (path === '/api/team/answer' && req.method === 'POST') return await answerAsk(kv, me, body)
    if (path === '/api/team/leave' && req.method === 'POST') return await leaveTeam(kv, me)
    if (path === '/api/team/rank' && req.method === 'POST') return await setRank(kv, me, body)
    if (path === '/api/team/rename' && req.method === 'POST') return await renameTeam(kv, me, body)
    if (path === '/api/team/ask' && req.method === 'POST') return await askTeam(kv, me, body)
    if (path === '/api/name' && req.method === 'POST') return await renameMe(kv, me, body)
    if (path === '/api/host' && req.method === 'POST') return await setHost(kv, me, body)
    if (path === '/api/friends' && req.method === 'GET') return await friends(kv, me)
    if (path === '/api/friends' && req.method === 'POST') return await friendAct(kv, me, body)
    if (path === '/api/inbox' && req.method === 'GET') return await inbox(kv, me)
    if (path === '/api/inbox/read' && req.method === 'POST') return await readInbox(kv, me, body)
    if (path === '/api/contact' && req.method === 'POST') return await contact(kv, env, body, origin, ip)
    if (path === '/api/prices' && req.method === 'GET') return json(priceForCountry(env.country))
    return json({ error: 'not-found' }, 404)
  } catch (err) {
    return failure(err)
  }
}

function failure(err: unknown): Response {
  const name = err instanceof Error ? err.name : ''
  if (err instanceof MissingKey || name === 'MissingKey') return json({ error: 'supabase-key' }, 503)
  if (err instanceof SchemaError || name === 'SchemaError') return json({ error: 'schema', detail: err instanceof Error ? err.message : '' }, 503)
  if (err instanceof TakenError || name === 'TakenError') return json({ error: 'taken' }, 409)
  console.error('rg', err instanceof Error ? err.message : 'error')
  return json({ error: 'server' }, 500)
}

async function join(kv: Store, env: Env, body: Record<string, unknown>, origin: string, secure: boolean, ip: string): Promise<Response> {
  if (!(await rate(kv, `rate:join:${ip}`, 8, 3600_000))) return json({ error: 'slow-down' }, 429)
  const login = String(body.login ?? '').trim()
  const password = String(body.password ?? '')
  if (body.agree !== true) return json({ error: 'terms' }, 400)
  if (password.length < 8 || password.length > 100) return json({ error: 'password' }, 400)
  if (!login || login.length > 80) return json({ error: 'name' }, 400)
  if (profane(login)) return json({ error: 'name' }, 400)
  const isEmail = emailOf(login)
  if (!isEmail && (login.length < 1 || login.length > 24)) return json({ error: 'name' }, 400)
  if (await byLogin(kv, login)) return json({ error: 'taken' }, 409)
  if (isEmail && (await byEmail(kv, login))) return json({ error: 'taken' }, 409)
  const playerName = isEmail ? await uniqueName(kv, 'Bright Owl') : await uniqueName(kv, login)
  const authEmail = isEmail ? login.toLowerCase() : `p.${randomToken(6)}@name.romansgame.invalid`
  let id: string
  try {
    id = await kv.provision(authEmail, password)
  } catch (err) {
    if (err instanceof TakenError) return json({ error: 'taken' }, 409)
    throw err
  }
  const publicName = await kv.insertPlayer(id, playerName)
  const account = blankAccount({
    loginKey: isEmail ? authEmail : publicName.toLowerCase(),
    playerName: publicName,
    email: isEmail ? authEmail : null,
    authEmail,
  })
  account.id = id
  let recovery: string | null = null
  if (!isEmail) {
    recovery = recoveryCode()
    account.recoveryHash = digest(recovery)
  } else {
    account.verifyToken = randomToken()
  }
  const session = await startSession(kv, account, secure)
  let mailSent = true
  if (isEmail && account.verifyToken) {
    const sent = await mail(env, kv, verificationMail(origin, account.email!, account.verifyToken))
    mailSent = sent.ok
  }
  return json({ me: publicMe(session.account), recoveryCode: recovery, mailSent }, 200, { 'set-cookie': session.cookie })
}

async function signin(kv: Store, body: Record<string, unknown>, secure: boolean, ip: string): Promise<Response> {
  if (!(await rate(kv, `rate:in:${ip}`, 20, 900_000))) return json({ error: 'slow-down' }, 429)
  const login = String(body.login ?? '').trim()
  const password = String(body.password ?? '')
  let account = (await byLogin(kv, login)) ?? (emailOf(login) ? await byEmail(kv, login) : null)
  if (!account && emailOf(login)) {
    const id = await kv.authId(login)
    if (id && (await kv.passwordOk(login, password))) account = await kv.ensurePlayer(id, login.toLowerCase())
  }
  if (!account) return json({ error: 'credentials' }, 401)
  if (account.lockedUntil && Date.parse(account.lockedUntil) > Date.now()) return json({ error: 'locked' }, 429)
  if (!(await passwordMatches(kv, account, password))) {
    account.failedSignins += 1
    if (account.failedSignins >= 8) account.lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString()
    await saveAccount(kv, account)
    return json({ error: 'credentials' }, 401)
  }
  if (account.deleteAfter && Date.parse(account.deleteAfter) < Date.now()) {
    await kv.deleteUser(account.id)
    return json({ error: 'deleted' }, 401)
  }
  const session = await startSession(kv, account, secure)
  return json({ me: publicMe(session.account) }, 200, { 'set-cookie': session.cookie })
}

async function signout(kv: Store, req: Request, secure: boolean): Promise<Response> {
  const token = readCookie(req)
  if (token) {
    const row = await kv.get<{ accountId: string }>(`session:${token}`)
    if (row) {
      const account = await kv.get<Account>(`account:${row.accountId}`)
      if (account) {
        account.sessions = account.sessions.filter((item) => item !== token)
        await saveAccount(kv, account)
      }
    }
    await kv.del(`session:${token}`)
  }
  return json({ ok: true }, 200, { 'set-cookie': cookie(null, secure) })
}

async function signoutAll(kv: Store, me: Account | null, secure: boolean): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  for (const token of me.sessions) await kv.del(`session:${token}`)
  me.sessions = []
  await saveAccount(kv, me)
  return json({ ok: true }, 200, { 'set-cookie': cookie(null, secure) })
}

async function meRoute(kv: Store, env: Env, me: Account | null, origin: string): Promise<Response> {
  if (!me) return json({ me: null })
  await maybeRemind(kv, env, me, origin)
  return json({ me: publicMe(me) })
}

async function maybeRemind(kv: Store, env: Env, me: Account, origin: string): Promise<void> {
  const pending = await kv.get<string>(`player-approval:${me.id}`)
  if (!pending) return
  const approval = await kv.get<Approval>(`approval:${pending}`)
  if (!approval || approval.status !== 'pending') return
  const age = Date.now() - Date.parse(approval.createdAt)
  if (age > APPROVAL_DAYS * 86400000) {
    approval.status = 'expired'
    await kv.set(`approval:${approval.token}`, approval)
    return
  }
  if (!approval.reminderSent && age > REMINDER_DAYS * 86400000 && Date.now() - Date.parse(approval.lastMailAt) > 86400000) {
    approval.reminderSent = true
    approval.lastMailAt = new Date().toISOString()
    await kv.set(`approval:${approval.token}`, approval)
    await mail(env, kv, reminderMail(origin, approval.email, approval.playerName, approval.token))
  }
}

async function recoverEmail(kv: Store, env: Env, body: Record<string, unknown>, origin: string, ip: string): Promise<Response> {
  if (!(await rate(kv, `rate:recover:${ip}`, 6, 3600_000))) return json({ error: 'slow-down' }, 429)
  const login = String(body.login ?? '').trim()
  let account = (emailOf(login) ? await byEmail(kv, login) : await byLogin(kv, login)) ?? null
  const same = { ok: true, sent: true }
  if (!account && emailOf(login)) {
    const id = await kv.authId(login)
    if (id) account = await kv.ensurePlayer(id, login.toLowerCase())
  }
  if (!account) return json(same)
  const target = account.email ?? (account.holderId ? (await kv.get<Account>(`account:${account.holderId}`))?.email : null)
  if (!target) return json({ ok: true, sent: false, reason: 'no-email' })
  if (account.resetToken) await kv.del(`reset:${account.resetToken}`)
  account.resetToken = randomToken()
  await saveAccount(kv, account)
  await kv.set(`reset:${account.resetToken}`, { accountId: account.id, exp: Date.now() + RESET_MINUTES * 60_000 })
  const sent = await mail(env, kv, resetMail(origin, target, account.playerName, account.resetToken))
  if (!sent.ok) console.error('reset mail was not sent')
  return json(same)
}

async function recoverCode(kv: Store, body: Record<string, unknown>, ip: string): Promise<Response> {
  if (!(await rate(kv, `rate:code:${ip}`, 8, 3600_000))) return json({ error: 'slow-down' }, 429)
  const login = String(body.login ?? '').trim()
  const code = String(body.code ?? '').trim().toUpperCase()
  const account = await byLogin(kv, login)
  if (!account || !account.recoveryHash) return json({ error: 'code-dead' }, 400)
  if (!sameHash(digest(code), account.recoveryHash)) {
    account.recoveryHash = null
    account.recoverySalt = null
    await saveAccount(kv, account)
    return json({ error: 'code-dead' }, 400)
  }
  const token = randomToken()
  account.resetToken = token
  account.resetFresh = true
  account.recoveryHash = null
  account.recoverySalt = null
  await saveAccount(kv, account)
  await kv.set(`reset:${token}`, { accountId: account.id, exp: Date.now() + RESET_MINUTES * 60_000, freshCode: true })
  return json({ token })
}

async function resetPassword(kv: Store, body: Record<string, unknown>, secure: boolean): Promise<Response> {
  const token = String(body.token ?? '')
  const password = String(body.password ?? '')
  if (password.length < 8) return json({ error: 'password' }, 400)
  const row = await kv.get<{ accountId: string; exp: number; freshCode?: boolean }>(`reset:${token}`)
  if (!row || row.exp < Date.now()) return json({ error: 'expired' }, 400)
  const account = await kv.get<Account>(`account:${row.accountId}`)
  if (!account || account.resetToken !== token) return json({ error: 'expired' }, 400)
  await kv.setPassword(account.id, password)
  account.resetToken = null
  account.resetFresh = false
  for (const old of account.sessions) await kv.del(`session:${old}`)
  account.sessions = []
  await kv.del(`reset:${token}`)
  let recoveryCodeShown: string | null = null
  if (row.freshCode || !account.email) {
    recoveryCodeShown = recoveryCode()
    account.recoveryHash = digest(recoveryCodeShown)
  }
  const session = await startSession(kv, account, secure)
  const names = [account.playerName]
  if (account.holder) {
    for (const id of account.memberIds) {
      const member = await kv.get<Account>(`account:${id}`)
      if (member) names.push(member.playerName)
    }
  }
  return json({ me: publicMe(session.account), names, recoveryCode: recoveryCodeShown }, 200, { 'set-cookie': session.cookie })
}

async function addEmail(kv: Store, env: Env, me: Account | null, body: Record<string, unknown>, origin: string): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!emailOf(email)) return json({ error: 'email' }, 400)
  if (password && !(await passwordMatches(kv, me, password))) return json({ error: 'password' }, 401)
  if (await byEmail(kv, email)) return json({ error: 'taken' }, 409)
  me.pendingEmail = email
  me.verifyToken = randomToken()
  await saveAccount(kv, me)
  await kv.set(`verify:${me.verifyToken}`, me.id)
  const sent = await mail(env, kv, verificationMail(origin, email, me.verifyToken))
  if (!sent.ok) return json({ error: 'mail' }, 502)
  return json({ ok: true })
}

async function verifyEmail(kv: Store, body: Record<string, unknown>): Promise<Response> {
  const token = String(body.token ?? '')
  const fresh = await kv.get<string>(`verify:${token}`)
  if (fresh) await kv.set(`verify-used:${token}`, fresh)
  const id = fresh ?? (await kv.get<string>(`verify-used:${token}`))
  if (!id) return json({ error: 'expired' }, 400)
  const account = await kv.get<Account>(`account:${id}`)
  if (!account) return json({ error: 'expired' }, 400)
  if (account.emailVerified && account.verifyToken !== token) return json({ ok: true, email: account.email })
  if (account.verifyToken !== token && !account.emailVerified) return json({ error: 'expired' }, 400)
  if (account.pendingEmail) {
    account.email = account.pendingEmail
    account.pendingEmail = null
    await kv.set(`email:${account.email}`, account.id)
  }
  account.emailVerified = true
  account.verifyToken = null
  if (account.email) {
    await kv.updateAuthEmail(account.id, account.email)
    account.authEmail = account.email
  }
  await kv.set(`verify-used:${token}`, account.id)
  await kv.del(`verify:${token}`)
  await saveAccount(kv, account)
  return json({ ok: true, email: account.email })
}

async function changePassword(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (!(await passwordMatches(kv, me, String(body.current ?? '')))) return json({ error: 'password' }, 401)
  const password = String(body.password ?? '')
  if (password.length < 8 || password !== String(body.again ?? '')) return json({ error: 'password' }, 400)
  await kv.setPassword(me.id, password)
  await saveAccount(kv, me)
  return json({ ok: true })
}

async function setLanguage(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const language = body.language === 'fr' ? 'fr' : 'en'
  me.language = language
  await saveAccount(kv, me)
  return json({ ok: true, language })
}

async function downloadData(kv: Store, env: Env, me: Account | null, body: Record<string, unknown>, origin: string): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (!(await passwordMatches(kv, me, String(body.password ?? '')))) return json({ error: 'password' }, 401)
  const file = publicMe(me)
  if (me.email) {
    await mail(env, kv, {
      to: me.email,
      subject: 'Your Roman\'s Game data',
      text: `Your data file is ready. Open the game and it will download. ${origin}/settings/data`,
      html: `<p>Your data file is ready in the game, on Your data.</p>`,
    })
  }
  return json({ file })
}

async function deleteData(kv: Store, me: Account | null, body: Record<string, unknown>, secure: boolean): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (!(await passwordMatches(kv, me, String(body.password ?? '')))) return json({ error: 'password' }, 401)
  me.deleteAfter = new Date(Date.now() + 7 * 86400000).toISOString()
  for (const token of me.sessions) await kv.del(`session:${token}`)
  me.sessions = []
  await saveAccount(kv, me)
  return json({ ok: true, until: me.deleteAfter }, 200, { 'set-cookie': cookie(null, secure) })
}

async function familyAsk(kv: Store, env: Env, me: Account | null, body: Record<string, unknown>, origin: string): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!emailOf(email)) return json({ error: 'email' }, 400)
  const last = await kv.get<number>(`mail-day:${email}`)
  if (last && Date.now() - last < 86400000) return json({ error: 'one-a-day' }, 429)
  const token = randomToken(16)
  const approval: Approval = {
    token,
    playerId: me.id,
    playerName: me.playerName,
    email,
    createdAt: new Date().toISOString(),
    lastMailAt: new Date().toISOString(),
    reminderSent: false,
    status: 'pending',
  }
  await kv.set(`approval:${token}`, approval)
  await kv.set(`player-approval:${me.id}`, token)
  await kv.set(`mail-day:${email}`, Date.now())
  const sent = await mail(env, kv, approvalMail(origin, email, me.playerName, token))
  if (!sent.ok) return json({ error: 'mail' }, 502)
  return json({ ok: true })
}

async function familyGet(kv: Store, me: Account | null, url: URL): Promise<Response> {
  const token = url.searchParams.get('token')
  if (token) {
    const approval = await kv.get<Approval>(`approval:${token}`)
    if (!approval) return json({ error: 'expired' }, 404)
    const age = Date.now() - Date.parse(approval.createdAt)
    if (approval.status === 'pending' && age > APPROVAL_DAYS * 86400000) approval.status = 'expired'
    return json({
      approval: {
        token: approval.token,
        playerName: approval.playerName,
        status: approval.status,
        email: approval.email.replace(/^(.).+(@.*)$/, '$1•••$2'),
      },
    })
  }
  if (!me) return json({ error: 'auth' }, 401)
  if (!me.holder && me.memberIds.length === 0) return json({ members: [], holder: false })
  const ids = me.holder ? me.memberIds : []
  const members = []
  for (const id of ids) {
    const member = await kv.get<Account>(`account:${id}`)
    if (!member) continue
    members.push({
      id: member.id,
      playerName: member.playerName,
      lastPlayed: member.lastPlayed,
      buyingStopped: member.buyingStopped,
      wins: member.wins,
    })
  }
  const pendingId = await kv.get<string>(`player-approval:${me.id}`)
  const pending = pendingId ? await kv.get<Approval>(`approval:${pendingId}`) : null
  return json({ holder: me.holder, members, pending: pending ? { status: pending.status, at: pending.createdAt } : null })
}

async function familyAnswer(kv: Store, body: Record<string, unknown>, secure: boolean): Promise<Response> {
  const token = String(body.token ?? '')
  const approval = await kv.get<Approval>(`approval:${token}`)
  if (!approval || approval.status === 'expired') return json({ error: 'expired' }, 400)
  if (body.answer === 'no') {
    approval.status = 'declined'
    await kv.set(`approval:${token}`, approval)
    return json({ ok: true, status: 'declined' })
  }
  if (approval.status === 'approved') return json({ ok: true, status: 'approved' })
  const password = String(body.password ?? '')
  const playerName = String(body.playerName ?? '').trim()
  let holder = await byEmail(kv, approval.email)
  if (!holder) {
    if (password.length < 8) return json({ error: 'password' }, 400)
    const name = playerName ? await uniqueName(kv, playerName) : await uniqueName(kv, 'Bright Owl')
    if (playerName && (profane(playerName) || playerName.length > 24)) return json({ error: 'name' }, 400)
    const authEmail = approval.email.toLowerCase()
    const id = await kv.provision(authEmail, password)
    const publicName = await kv.insertPlayer(id, name)
    holder = blankAccount({ loginKey: authEmail, playerName: publicName, email: authEmail, authEmail })
    holder.id = id
    holder.emailVerified = true
    holder.ageGate = 'over'
    holder.holder = true
  }
  holder.holder = true
  holder.emailVerified = true
  if (!holder.memberIds.includes(approval.playerId)) holder.memberIds.push(approval.playerId)
  const player = await kv.get<Account>(`account:${approval.playerId}`)
  if (!player) return json({ error: 'expired' }, 400)
  player.holderId = holder.id
  player.buyingStopped = false
  await saveAccount(kv, player)
  approval.status = 'approved'
  await kv.set(`approval:${token}`, approval)
  const session = await startSession(kv, holder, secure)
  return json({ ok: true, status: 'approved', me: publicMe(session.account) }, 200, { 'set-cookie': session.cookie })
}

async function familyAdd(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me?.holder) return json({ error: 'auth' }, 401)
  if (me.memberIds.length >= 10) return json({ error: 'full' }, 400)
  const playerName = String(body.playerName ?? '').trim()
  const password = String(body.password ?? '')
  if (!playerName || playerName.length > 24 || profane(playerName)) return json({ error: 'name' }, 400)
  if (password.length < 8) return json({ error: 'password' }, 400)
  if (await byLogin(kv, playerName)) return json({ error: 'taken' }, 409)
  const authEmail = `p.${randomToken(6)}@name.romansgame.invalid`
  const id = await kv.provision(authEmail, password)
  const publicName = await kv.insertPlayer(id, playerName)
  const member = blankAccount({ loginKey: publicName.toLowerCase(), playerName: publicName, email: null, authEmail })
  member.id = id
  member.holderId = me.id
  member.ageGate = 'under'
  const code = recoveryCode()
  member.recoveryHash = digest(code)
  await saveAccount(kv, member)
  me.memberIds.push(member.id)
  await saveAccount(kv, me)
  return json({ ok: true, playerName: member.playerName, recoveryCode: code })
}

async function familyMember(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me?.holder) return json({ error: 'auth' }, 401)
  const member = await kv.get<Account>(`account:${String(body.id ?? '')}`)
  if (!member || member.holderId !== me.id) return json({ error: 'auth' }, 404)
  const action = String(body.action ?? '')
  if (action === 'reset') {
    const password = String(body.password ?? '')
    if (password.length < 8) return json({ error: 'password' }, 400)
    await kv.setPassword(member.id, password)
    for (const token of member.sessions) await kv.del(`session:${token}`)
    member.sessions = []
  } else if (action === 'remove') {
    member.holderId = null
    me.memberIds = me.memberIds.filter((id) => id !== member.id)
  } else if (action === 'delete') {
    if (!(await passwordMatches(kv, me, String(body.password ?? '')))) return json({ error: 'password' }, 401)
    member.deleteAfter = new Date(Date.now() + 7 * 86400000).toISOString()
    me.memberIds = me.memberIds.filter((id) => id !== member.id)
  } else if (action === 'stop') {
    member.buyingStopped = true
  } else if (action === 'signout') {
    for (const token of member.sessions) await kv.del(`session:${token}`)
    member.sessions = []
  } else return json({ error: 'bad' }, 400)
  await saveAccount(kv, member)
  await saveAccount(kv, me)
  return json({ ok: true })
}

async function birthday(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (me.ageGate) return json({ ageGate: me.ageGate, saved: true })
  const age = ageFrom(Number(body.year), Number(body.month), Number(body.day))
  if (age == null || age < 0 || age > 120) return json({ error: 'date' }, 400)
  me.ageGate = age >= CASH_AGE ? 'over' : 'under'
  await saveAccount(kv, me)
  return json({ ageGate: me.ageGate })
}

async function acceptOrder(kv: Store, me: Account | null, body: Record<string, unknown>, env: Env): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (me.holderId && me.ageGate === 'under') return json({ error: 'holder-only' }, 403)
  if (me.ageGate === 'under') return json({ error: 'ask-holder' }, 403)
  if (me.ageGate !== 'over') return json({ error: 'birthday' }, 403)
  if (!me.emailVerified || !me.email) return json({ error: 'email' }, 403)
  if (me.buyingStopped) return json({ error: 'stopped' }, 403)
  const sku = body.sku === 'starter' || body.sku === 'pack-small' ? body.sku : null
  if (!sku) return json({ error: 'sku' }, 400)
  if (sku === 'starter' && me.starterOwned) return json({ error: 'owned' }, 400)
  const price = priceForCountry(env.country)
  const cents = sku === 'starter' ? price.starterCents : price.smallCents
  const order: Order = {
    id: crypto.randomUUID(),
    accountId: me.id,
    sku,
    cents,
    currency: price.currency,
    price: formatPrice(cents, price.symbol),
    status: 'review',
    acceptedAt: new Date().toISOString(),
    paidAt: null,
    sessionId: null,
    wasntToken: null,
    wasntUsed: false,
  }
  me.purchaseAccepts.push({ sku, at: order.acceptedAt, version: TERMS_VERSION })
  await saveAccount(kv, me)
  await kv.set(`order:${order.id}`, order)
  return json({ orderId: order.id, price: order.price, sku, seller: 'Funderwood', support: SUPPORT_EMAIL, version: TERMS_VERSION })
}

async function checkout(kv: Store, env: Env, me: Account | null, body: Record<string, unknown>, origin: string): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (!(await passwordMatches(kv, me, String(body.password ?? '')))) return json({ error: 'password' }, 401)
  const order = await kv.get<Order>(`order:${String(body.orderId ?? '')}`)
  if (!order || order.accountId !== me.id || order.status !== 'review') return json({ error: 'order' }, 400)
  const key = env.STRIPE_SECRET_KEY?.trim() ?? ''
  if (!key || !stripeAllowed(key, env.CONTEXT)) return json({ error: 'stripe-test-only' }, 503)
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(key)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: me.email ?? undefined,
    client_reference_id: order.id,
    metadata: { orderId: order.id, accountId: me.id, sku: order.sku },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: order.currency,
          unit_amount: order.cents,
          product_data: { name: order.sku === 'starter' ? 'Starter Pack' : 'Coin pack', description: "Coins for Roman's Game. No cash value." },
        },
      },
    ],
    success_url: `${origin}/shop/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/shop/review?failed=1&order=${order.id}`,
  })
  order.sessionId = session.id
  await kv.set(`order:${order.id}`, order)
  await kv.set(`stripe:${session.id}`, order.id)
  return json({ url: session.url })
}

async function grant(kv: Store, order: Order, origin: string, env: Env): Promise<void> {
  if (order.status === 'paid') return
  const account = await kv.get<Account>(`account:${order.accountId}`)
  if (!account) return
  order.status = 'paid'
  order.paidAt = new Date().toISOString()
  order.wasntToken = randomToken(12)
  if (order.sku === 'starter') account.starterOwned = true
  await saveAccount(kv, account)
  await kv.set(`order:${order.id}`, order)
  await kv.set(`wasnt:${order.wasntToken}`, order.id)
  if (account.email) {
    await mail(env, kv, receiptMail({
      origin,
      to: account.email,
      item: order.sku === 'starter' ? 'Starter Pack (one time). Coin amounts are not set yet.' : 'Coin pack (▢ coins)',
      price: order.price,
      when: order.paidAt,
      wasnt: order.wasntToken,
    }))
  }
}

async function confirmCheckout(kv: Store, env: Env, me: Account | null, body: Record<string, unknown>, origin: string): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const sessionId = String(body.sessionId ?? '')
  const orderId = await kv.get<string>(`stripe:${sessionId}`)
  const order = orderId ? await kv.get<Order>(`order:${orderId}`) : null
  if (!order || order.accountId !== me.id) return json({ error: 'order' }, 404)
  const key = env.STRIPE_SECRET_KEY?.trim() ?? ''
  if (!key || !stripeAllowed(key, env.CONTEXT)) return json({ error: 'stripe-test-only' }, 503)
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(key)
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid') return json({ error: 'unpaid', failed: true }, 402)
  await grant(kv, order, origin, env)
  const account = await kv.get<Account>(`account:${me.id}`)
  return json({ ok: true, me: account ? publicMe(account) : null, sku: order.sku })
}

async function stripeWebhook(req: Request, env: Env, kv: Store): Promise<Response> {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? ''
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? ''
  if (!key || !secret || !stripeAllowed(key, env.CONTEXT)) return json({ error: 'stripe-test-only' }, 503)
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(key)
  const raw = await req.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return json({ error: 'signature' }, 400)
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { id?: string; payment_status?: string }
    if (session.payment_status === 'paid' && session.id) {
      const orderId = await kv.get<string>(`stripe:${session.id}`)
      const order = orderId ? await kv.get<Order>(`order:${orderId}`) : null
      if (order) await grant(kv, order, env.DEPLOY_PRIME_URL || env.URL || '', env)
    }
  }
  return json({ received: true })
}

async function wasntMe(kv: Store, body: Record<string, unknown>): Promise<Response> {
  const token = String(body.token ?? '')
  const orderId = await kv.get<string>(`wasnt:${token}`)
  if (!orderId) return json({ error: 'used' }, 400)
  const order = await kv.get<Order>(`order:${orderId}`)
  if (!order || order.wasntUsed) return json({ error: 'used' }, 400)
  const account = await kv.get<Account>(`account:${order.accountId}`)
  if (!account) return json({ error: 'used' }, 400)
  account.buyingStopped = true
  order.wasntUsed = true
  await saveAccount(kv, account)
  await kv.set(`order:${order.id}`, order)
  await kv.del(`wasnt:${token}`)
  return json({ ok: true })
}

async function spendCharge(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const ability = String(body.ability ?? '')
  if (!['place', 'heart', 'rule', 'light', 'light6'].includes(ability)) return json({ error: 'ability' }, 400)
  const have = me.charges[ability] ?? 0
  if (have < 1) return json({ error: 'empty' }, 400)
  me.charges[ability] = have - 1
  await saveAccount(kv, me)
  return json({ me: publicMe(me) })
}

async function recordWin(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const size = Number(body.size)
  const seconds = Number(body.seconds)
  const moves = Number(body.moves)
  const puzzleId = String(body.puzzleId ?? '').slice(0, 80)
  const mode = String(body.mode ?? 'free')
  if (![5, 6, 7, 8].includes(size) || seconds < 1 || moves < size || !puzzleId) return json({ error: 'board' }, 400)
  const key = `${mode}:${puzzleId}`
  if (!me.solved.includes(key)) {
    me.solved = [...me.solved, key].slice(-400)
    const board = boardFromPuzzleId(puzzleId, size)
    const boards = winMap(me)
    boards[board.key] = (boards[board.key] ?? 0) + 1
    me.winsByBoard = boards
    me.wins += 1
    if (body.perfect === true) me.perfects += 1
    const today = torontoDate()
    if (me.streakDay !== today) {
      const yesterday = torontoDate(new Date(Date.now() - 86400000))
      me.streak = me.streakDay === yesterday ? me.streak + 1 : 1
      me.streakDay = today
      if (me.streak === 3 || me.streak === 5 || me.streak === 7) me.charges.place = (me.charges.place ?? 0) + 1
    }
    if (mode === 'daily' && me.dailyWin !== today) {
      me.dailyWin = today
      me.dailySeconds = seconds
    }
    const wk = weekKey()
    if (me.weekKey !== wk) {
      me.weekKey = wk
      me.weekWins = 0
    }
    me.weekWins += 1
    if (mode === 'survival') {
      const run = Number(body.run) || 0
      me.bestRun[String(size)] = Math.max(me.bestRun[String(size)] ?? 0, run)
      me.hearts = Math.max(0, Math.min(MAX_HEARTS, Number(body.hearts) || 0))
    }
    me.lastPlayed = new Date().toISOString()
    if (me.teamId) {
      const team = await kv.get<Team>(`team:${me.teamId}`)
      if (team && !team.closed) {
        if (team.weekKey !== wk) {
          team.weekKey = wk
          team.scores = {}
        }
        team.scores[me.id] = (team.scores[me.id] ?? 0) + 1
        await kv.set(`team:${team.id}`, team)
      }
    }
    await saveAccount(kv, me)
    await kv.addScore(me.id, { size, seconds, moves, mode, puzzleId, run: Number(body.run) || 0 }, me.teamId)
  }
  return json({ me: publicMe(me) })
}

async function leaderboard(kv: Store, url: URL, me: Account | null): Promise<Response> {
  const scope = url.searchParams.get('scope') ?? 'week'
  const size = Number(url.searchParams.get('size') ?? '6')
  const board = await kv.board(scope, size, me?.id ?? null)
  return json({ ...board, scope })
}

async function makeChallenge(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  const puzzle = body.puzzle as Puzzle
  if (!puzzle || !Array.isArray(puzzle.solution) || typeof puzzle.size !== 'number') return json({ error: 'board' }, 400)
  const code = randomToken(4).slice(0, 8)
  const challenge: Challenge = {
    code,
    puzzle,
    senderName: me?.playerName ?? 'A player',
    senderSeconds: Math.max(0, Number(body.seconds) || 0),
    senderId: me?.id ?? null,
    results: [],
  }
  await kv.set(`challenge:${code}`, challenge)
  return json({ code, path: `/c/${code}` })
}

async function getChallenge(kv: Store, code: string): Promise<Response> {
  const challenge = await kv.get<Challenge>(`challenge:${code}`)
  if (!challenge) return json({ error: 'missing' }, 404)
  return json({ challenge })
}

async function challengeResult(kv: Store, code: string, body: Record<string, unknown>): Promise<Response> {
  const challenge = await kv.get<Challenge>(`challenge:${code}`)
  if (!challenge) return json({ error: 'missing' }, 404)
  const seconds = Number(body.seconds)
  const won = body.won === true
  if (!Number.isFinite(seconds)) return json({ error: 'time' }, 400)
  challenge.results.push({ name: String(body.name ?? 'A player').slice(0, 24), seconds, won })
  await kv.set(`challenge:${code}`, challenge)
  return json({
    you: seconds,
    them: challenge.senderSeconds,
    won: won && (challenge.senderSeconds === 0 || seconds <= challenge.senderSeconds),
  })
}

async function makeTeam(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (me.teamId) return json({ error: 'already' }, 400)
  const pick = body.pick as TeamNamePick
  const parsed = pick ? parseTeamName(formatTeamName(pick)) : null
  if (!parsed) return json({ error: 'name' }, 400)
  let name = formatTeamName(parsed)
  let n = parsed.number
  while (await kv.get(`team-name:${name.toLowerCase()}`)) {
    n = n >= 999 ? 1 : n + 1
    name = formatTeamName({ ...parsed, number: n })
  }
  const mascots = ['Leo', 'Lupa', 'Aquila', 'Nox', 'Invictus']
  const mascot = mascots.includes(String(body.mascot)) ? String(body.mascot) : 'Leo'
  const code = randomToken(3).slice(0, 6)
  const team: Team = {
    id: crypto.randomUUID(),
    code,
    name,
    mascot,
    openJoin: body.openJoin === true,
    members: [{ id: me.id, name: me.playerName, rank: 'leader', joinedAt: new Date().toISOString() }],
    asks: [],
    weekKey: weekKey(),
    scores: {},
    closed: false,
  }
  me.teamId = team.id
  await saveAccount(kv, me)
  await kv.set(`team:${team.id}`, team)
  await kv.set(`team-code:${code}`, team.id)
  await kv.set(`team-name:${name.toLowerCase()}`, team.id)
  return json({ team: publicTeam(team, true) })
}

function publicTeam(team: Team, mine: boolean) {
  const score = Object.values(team.scores).reduce((sum, n) => sum + n, 0)
  return {
    id: team.id,
    code: mine ? team.code : undefined,
    name: team.name,
    mascot: team.mascot,
    openJoin: team.openJoin,
    members: mine ? team.members : undefined,
    memberCount: team.members.length,
    asks: mine ? team.asks : undefined,
    score,
    path: `/t/${team.code}`,
  }
}

async function getTeam(kv: Store, me: Account | null, url: URL): Promise<Response> {
  const code = url.searchParams.get('code')
  if (code) {
    const id = await kv.get<string>(`team-code:${code}`)
    const team = id ? await kv.get<Team>(`team:${id}`) : null
    if (!team || team.closed) return json({ error: 'missing' }, 404)
    const mine = !!me && team.members.some((member) => member.id === me.id)
    return json({ team: publicTeam(team, mine) })
  }
  if (me?.teamId) {
    const team = await kv.get<Team>(`team:${me.teamId}`)
    if (team && !team.closed) return json({ team: publicTeam(team, true) })
  }
  const rows = (await kv.get<{ name: string; score: number; mascot: string; members: number }[]>('team-board')) ?? []
  return json({ team: null, board: rows })
}

async function joinTeam(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (me.teamId) return json({ error: 'already' }, 400)
  const id = await kv.get<string>(`team-code:${String(body.code ?? '')}`)
  const team = id ? await kv.get<Team>(`team:${id}`) : null
  if (!team || team.closed) return json({ error: 'missing' }, 404)
  if (team.members.length >= 10) return json({ error: 'full' }, 400)
  if (!team.openJoin || body.ask === true) {
    if (!team.asks.some((ask) => ask.id === me.id)) team.asks.push({ id: me.id, name: me.playerName, at: new Date().toISOString() })
    await kv.set(`team:${team.id}`, team)
    const leader = team.members.find((member) => member.rank === 'leader')
    if (leader) await kv.notify(leader.id, me.id, me.playerName, 'Ask to join your group', { kind: 'team', teamId: team.id })
    return json({ pending: true, team: publicTeam(team, false) })
  }
  team.members.push({ id: me.id, name: me.playerName, rank: 'member', joinedAt: new Date().toISOString() })
  me.teamId = team.id
  await saveAccount(kv, me)
  await kv.set(`team:${team.id}`, team)
  await refreshTeamBoard(kv)
  return json({ team: publicTeam(team, true) })
}

async function answerAsk(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me?.teamId) return json({ error: 'auth' }, 401)
  const team = await kv.get<Team>(`team:${me.teamId}`)
  if (!team) return json({ error: 'missing' }, 404)
  const meRank = team.members.find((member) => member.id === me.id)
  if (!meRank || (meRank.rank !== 'leader' && meRank.rank !== 'captain')) return json({ error: 'auth' }, 403)
  const ask = team.asks.find((item) => item.id === String(body.id))
  team.asks = team.asks.filter((item) => item.id !== String(body.id))
  if (body.accept === true && ask && team.members.length < 10) {
    const player = await kv.get<Account>(`account:${ask.id}`)
    if (player && !player.teamId) {
      player.teamId = team.id
      await saveAccount(kv, player)
      team.members.push({ id: player.id, name: player.playerName, rank: 'member', joinedAt: new Date().toISOString() })
    }
  }
  await kv.set(`team:${team.id}`, team)
  return json({ team: publicTeam(team, true) })
}

function nextInLine(team: Team, leaderId: string) {
  const rest = team.members.filter((member) => member.id !== leaderId)
  const captains = rest.filter((member) => member.rank === 'captain').sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  if (captains[0]) return captains[0]
  return rest.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0] ?? null
}

async function leaveTeam(kv: Store, me: Account | null): Promise<Response> {
  if (!me?.teamId) return json({ error: 'auth' }, 401)
  const team = await kv.get<Team>(`team:${me.teamId}`)
  if (!team) return json({ error: 'missing' }, 404)
  const mine = team.members.find((member) => member.id === me.id)
  if (!mine) return json({ error: 'missing' }, 404)
  if (mine.rank === 'leader') {
    const heir = nextInLine(team, me.id)
    if (heir) heir.rank = 'leader'
  }
  team.members = team.members.filter((member) => member.id !== me.id)
  me.teamId = null
  await saveAccount(kv, me)
  if (team.members.length === 0) team.closed = true
  await kv.set(`team:${team.id}`, team)
  await refreshTeamBoard(kv)
  return json({ ok: true, passedTo: team.members.find((member) => member.rank === 'leader')?.name ?? null })
}

async function setRank(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me?.teamId) return json({ error: 'auth' }, 401)
  const team = await kv.get<Team>(`team:${me.teamId}`)
  if (!team) return json({ error: 'missing' }, 404)
  const leader = team.members.find((member) => member.id === me.id && member.rank === 'leader')
  if (!leader) return json({ error: 'auth' }, 403)
  const member = team.members.find((item) => item.id === String(body.id))
  if (!member || member.rank === 'leader') return json({ error: 'bad' }, 400)
  if (body.rank === 'captain') {
    if (team.members.filter((item) => item.rank === 'captain').length >= 2) return json({ error: 'captains' }, 400)
    member.rank = 'captain'
  } else if (body.rank === 'member') member.rank = 'member'
  else if (body.remove === true) {
    const player = await kv.get<Account>(`account:${member.id}`)
    const inactive = !player?.lastPlayed || Date.now() - Date.parse(player.lastPlayed) > 30 * 86400000
    if (!inactive) return json({ error: 'active' }, 400)
    team.members = team.members.filter((item) => item.id !== member.id)
    if (player) {
      player.teamId = null
      await saveAccount(kv, player)
    }
  }
  await kv.set(`team:${team.id}`, team)
  return json({ team: publicTeam(team, true) })
}

async function refreshTeamBoard(kv: Store): Promise<void> {
  const current = (await kv.get<{ id: string }[]>('team-ids')) ?? []
  void current
}

async function contact(kv: Store, env: Env, body: Record<string, unknown>, origin: string, ip: string): Promise<Response> {
  if (!(await rate(kv, `rate:contact:${ip}`, 5, 3600_000))) return json({ error: 'slow-down' }, 429)
  const email = String(body.email ?? '')
  const message = String(body.message ?? '').slice(0, 4000)
  const about = String(body.about ?? 'Game').slice(0, 80)
  if (!emailOf(email) || message.length < 2) return json({ error: 'message' }, 400)
  const sent = await mail(env, kv, {
    to: SUPPORT_EMAIL,
    subject: `Contact: ${about}`,
    text: `From ${email}\n\n${message}\n\n${origin}`,
    html: `<p>From ${email}</p><p>${message.replace(/</g, '')}</p>`,
  })
  if (!sent.ok) return json({ error: 'mail' }, 502)
  return json({ ok: true })
}

async function renameTeam(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me?.teamId) return json({ error: 'auth' }, 401)
  const team = await kv.get<Team>(`team:${me.teamId}`)
  if (!team) return json({ error: 'missing' }, 404)
  const leader = team.members.find((member) => member.id === me.id && member.rank === 'leader')
  if (!leader) return json({ error: 'auth' }, 403)
  const pick = body.pick as TeamNamePick
  const parsed = pick ? parseTeamName(formatTeamName(pick)) : null
  if (!parsed) return json({ error: 'name' }, 400)
  let name = formatTeamName(parsed)
  let n = parsed.number
  while (await kv.get(`team-name:${name.toLowerCase()}`)) {
    if (name.toLowerCase() === team.name.toLowerCase()) break
    n = n >= 999 ? 1 : n + 1
    name = formatTeamName({ ...parsed, number: n })
  }
  team.name = name
  await kv.set(`team:${team.id}`, team)
  return json({ team: publicTeam(team, true) })
}

async function askTeam(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (me.teamId) return json({ error: 'already' }, 400)
  const target = await kv.get<Account>(`account:${String(body.id ?? '')}`)
  if (!target?.teamId) return json({ error: 'missing' }, 404)
  const team = await kv.get<Team>(`team:${target.teamId}`)
  if (!team || team.closed) return json({ error: 'missing' }, 404)
  if (team.members.length >= 10) return json({ error: 'full' }, 400)
  if (!team.asks.some((ask) => ask.id === me.id)) team.asks.push({ id: me.id, name: me.playerName, at: new Date().toISOString() })
  await kv.set(`team:${team.id}`, team)
  const leader = team.members.find((member) => member.rank === 'leader')
  if (leader) await kv.notify(leader.id, me.id, me.playerName, 'Ask to join your group', { kind: 'team', teamId: team.id })
  return json({ pending: true, team: publicTeam(team, false) })
}

async function renameMe(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  if (!(await passwordMatches(kv, me, String(body.password ?? '')))) return json({ error: 'password' }, 401)
  const name = String(body.name ?? '').trim()
  if (!name || name.length > 24 || profane(name) || (await kv.profane(name))) return json({ error: 'name' }, 400)
  me.playerName = await kv.rename(me.id, name)
  await saveAccount(kv, me)
  return json({ me: publicMe(me) })
}

async function setHost(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const pet = String(body.pet ?? '')
  if (!me.pets.includes(pet)) return json({ error: 'pet' }, 400)
  me.hostPet = pet
  await saveAccount(kv, me)
  return json({ me: publicMe(me) })
}

async function friends(kv: Store, me: Account | null): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const social = await kv.social(me.id)
  const messages = await kv.inbox(me.id)
  return json({ ...social, inbox: messages })
}

async function friendAct(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  const other = String(body.id ?? '')
  const action = String(body.action ?? 'ask')
  if (action === 'ask') {
    const name = String(body.name ?? '')
    const id = other || (name ? await kv.idByPublicName(name) : null)
    if (!id) return json({ error: 'missing' }, 404)
    const result = await kv.friendAsk(me.id, me.playerName, id)
    if (result === 'bad') return json({ error: 'bad' }, 400)
    return json({ ok: true, status: result })
  }
  if (!other) return json({ error: 'missing' }, 404)
  if (action === 'accept' || action === 'decline') await kv.friendAnswer(me.id, other, action === 'accept')
  else if (action === 'cancel') await kv.friendCancel(me.id, other)
  else if (action === 'unfriend') await kv.friendRemove(me.id, other)
  else return json({ error: 'bad' }, 400)
  return json({ ok: true })
}

async function inbox(kv: Store, me: Account | null): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  return json({ inbox: await kv.inbox(me.id) })
}

async function readInbox(kv: Store, me: Account | null, body: Record<string, unknown>): Promise<Response> {
  if (!me) return json({ error: 'auth' }, 401)
  await kv.markRead(me.id, Number(body.id))
  return json({ ok: true })
}
