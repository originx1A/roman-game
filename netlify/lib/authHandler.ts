import { hashCard, hashCode, hashIp, hashUa, hashesEqual, newCardToken, scrubMetadata, sixDigitCode } from './authCrypto.ts'
import { nameLocked, notePasswordChange, noteRecoverAttempt, noteSigninAttempt, noteSigninFailure, noteSignupAttempt, passwordChangeBlocked, recoverIpBlocked, recoverNameBlocked, signinIpBlocked, signupIpBlocked } from './authLimits.ts'
import { ABSOLUTE_SHORT_MS, ABSOLUTE_STAY_MS, sessionExpired, sessionIdFromAccessToken } from './sessionClock.ts'
import { decideName, publicDisplayName } from './namePolicy.ts'
import { PASSWORD_HINT, passwordRejectReason } from './passwordPolicy.ts'
import { hibpRange } from './hibp.ts'
import type { AuthBackend, RecoveryPurpose, RecoveryRecord, SessionPair } from './authTypes.ts'
import { supabaseAuthBackend } from './authBackend.ts'

export type AuthRoute =
  | 'signup'
  | 'signin'
  | 'password-change'
  | 'recover-email-start'
  | 'recover-email-finish'
  | 'recover-card'
  | 'recover-parent'
  | 'recovery-card-issue'
  | 'refresh'
  | 'signout'

const INVALID = { error: 'invalid_credentials' }
const LIMITED = { error: 'rate_limited' }
const CODE_TTL_MS = 10 * 60_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AuthDeps = {
  now: () => number
  backend: AuthBackend
  hibp: (password: string) => Promise<'pwned' | 'clear' | 'unknown'>
  hashIp: (ip: string) => string | null
  hashUa: (ua: string) => string
  hashCode: (code: string) => string
  hashCard: (token: string) => string
  newCode: () => string
  newCard: () => string
  sendCode: (email: string, code: string, purpose: RecoveryPurpose) => Promise<void>
}

export function productionDeps(): AuthDeps | null {
  const backend = supabaseAuthBackend()
  if (!backend) return null
  return {
    now: () => Date.now(),
    backend,
    hibp: (password) => hibpRange(password),
    hashIp,
    hashUa,
    hashCode,
    hashCard,
    newCode: sixDigitCode,
    newCard: newCardToken,
    sendCode: sendRecoveryCode,
  }
}

export async function handleAuthRequest(req: Request, route: AuthRoute): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return authResponse(null, 204, origin)
  const deps = productionDeps()
  if (!deps) return authResponse({ error: 'unavailable' }, 503, origin)
  return handleAuth(req, route, deps)
}

export async function handleAuth(req: Request, route: AuthRoute, deps: AuthDeps): Promise<Response> {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return authResponse(null, 204, origin)
  if (req.method !== 'POST') return authResponse({ error: 'method_not_allowed' }, 405, origin)
  try {
    const body = await readBody(req)
    if (!body) return authResponse({ error: 'bad_request' }, 400, origin)
    const ctx = { req, body, origin, deps, now: deps.now() }
    switch (route) {
      case 'signup':
        return await signup(ctx)
      case 'signin':
        return await signin(ctx)
      case 'password-change':
        return await changePassword(ctx)
      case 'recover-email-start':
        return await recoverEmailStart(ctx)
      case 'recover-email-finish':
        return await recoverEmailFinish(ctx)
      case 'recover-card':
        return await recoverCard(ctx)
      case 'recover-parent':
        return await recoverParent(ctx)
      case 'recovery-card-issue':
        return await issueCard(ctx)
      case 'refresh':
        return await refreshSession(ctx)
      case 'signout':
        return await signout(ctx)
      default:
        return authResponse({ error: 'bad_request' }, 400, origin)
    }
  } catch {
    return authResponse({ error: 'unavailable' }, 503, origin)
  }
}

type Ctx = {
  req: Request
  body: Record<string, unknown>
  origin: string | null
  deps: AuthDeps
  now: number
}

async function signup(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin, req } = ctx
  const ip = clientIp(req)
  const ipKey = deps.hashIp(ip) ?? 'missing'
  const ipRow = await deps.backend.getLimit('signup_ip', ipKey)
  if (signupIpBlocked(ipRow, now)) {
    await deps.backend.putLimit('signup_ip', ipKey, noteSignupAttempt(ipRow, now))
    return authResponse(LIMITED, 429, origin)
  }
  await deps.backend.putLimit('signup_ip', ipKey, noteSignupAttempt(ipRow, now))
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)

  const name = decideName(body.name)
  if (!name.ok) {
    await audit(ctx, 'signup', null, { rejected: name.reason, name_normalized: name.normalized })
    return authResponse({ error: 'name_rejected' }, 422, origin)
  }
  const shown = publicDisplayName(name.displayName)
  if (!shown) {
    await audit(ctx, 'signup', null, { rejected: 'profanity', name_normalized: name.normalized })
    return authResponse({ error: 'name_rejected' }, 422, origin)
  }
  const weak = passwordRejectReason(body.password, nameParts(name.displayName, name.normalized))
  if (weak || (await deps.hibp(body.password as string)) === 'pwned') {
    await audit(ctx, 'signup', null, { rejected: 'weak_password', name_normalized: name.normalized })
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const email = readRecoveryEmail(body)
  if (email === 'bad') return authResponse({ error: 'bad_recovery_email' }, 422, origin)

  let codeHash: string | null = null
  let codeExpiresAt: string | null = null
  let plainCode: string | null = null
  if (email) {
    plainCode = deps.newCode()
    codeHash = deps.hashCode(plainCode)
    codeExpiresAt = new Date(now + CODE_TTL_MS).toISOString()
  }
  const created = await deps.backend.createAccount({
    normalized: name.normalized,
    displayName: name.displayName,
    publicName: shown,
    password: body.password as string,
    pendingEmail: email,
    codeHash,
    codePurpose: email ? 'verify' : null,
    codeExpiresAt,
    captchaToken,
  })
  if (created === 'taken') return authResponse({ error: 'name_taken' }, 409, origin)
  if (created === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (created === 'failed') return authResponse({ error: 'unavailable' }, 503, origin)
  if (email && plainCode) await deps.sendCode(email, plainCode, 'verify').catch(() => undefined)
  await rememberDevice(ctx, created.playerId, created.session.access_token)
  await audit(ctx, 'signup', created.playerId, { name_normalized: name.normalized })
  return authResponse(sessionBody(created.playerId, shown, created.session, stayUntil(ctx)), 201, origin)
}

async function signin(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin, req } = ctx
  const ip = clientIp(req)
  const ipKey = deps.hashIp(ip) ?? 'missing'
  const ipRow = await deps.backend.getLimit('signin_ip', ipKey)
  const attempted = noteSigninAttempt(ipRow, now)
  await deps.backend.putLimit('signin_ip', ipKey, attempted)
  if (signinIpBlocked(ipRow, now)) {
    await audit(ctx, 'lockout', null, { scope: 'ip' })
    return authResponse(LIMITED, 429, origin)
  }

  const name = decideName(body.name)
  if (!name.ok) {
    await audit(ctx, 'signin_fail', null, { rejected: 'format' })
    return authResponse(INVALID, 401, origin)
  }
  const nameRow = await deps.backend.getLimit('signin_name', name.normalized)
  if (nameLocked(nameRow, now)) {
    await audit(ctx, 'lockout', null, { name_normalized: name.normalized })
    return authResponse(LIMITED, 429, origin)
  }
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)

  const signed = await deps.backend.signIn(name.normalized, typeof body.password === 'string' ? body.password : '', captchaToken)
  if (signed === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  const profile = signed ? await deps.backend.profileById(signed.playerId) : null
  if (!signed || !profile || profile.banned) {
    if (signed) await deps.backend.revoke(signed.playerId, 'global', signed.session.access_token).catch(() => undefined)
    const noted = noteSigninFailure(nameRow, attempted, now)
    await deps.backend.putLimit('signin_name', name.normalized, noted.name)
    await deps.backend.putLimit('signin_ip', ipKey, noted.ip)
    await audit(ctx, noted.locked ? 'lockout' : 'signin_fail', profile?.playerId ?? null, {
      name_normalized: name.normalized,
    })
    return authResponse(noted.locked ? LIMITED : INVALID, noted.locked ? 429 : 401, origin)
  }

  const cleared = { ...nameRow, failures: [], lockedUntil: null }
  await deps.backend.putLimit('signin_name', name.normalized, cleared)
  await rememberDevice(ctx, signed.playerId, signed.session.access_token)
  await audit(ctx, 'signin_ok', signed.playerId, { name_normalized: name.normalized })
  const shown = publicDisplayName(profile.displayName)
  return authResponse(sessionBody(signed.playerId, shown, signed.session, stayUntil(ctx)), 200, origin)
}

async function changePassword(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  const playerId = live.playerId
  const row = await deps.backend.getLimit('password_user', playerId)
  if (passwordChangeBlocked(row, now)) return authResponse(LIMITED, 429, origin)
  await deps.backend.putLimit('password_user', playerId, notePasswordChange(row, now))
  const profile = await deps.backend.profileById(playerId)
  if (!profile) return authResponse(INVALID, 401, origin)
  const current = body.current_password
  const next = body.new_password
  const captchaToken = readCaptchaToken(body)
  if (typeof current !== 'string') {
    await audit(ctx, 'password_change', playerId, { ok: false })
    return authResponse(INVALID, 401, origin)
  }
  const checked = await deps.backend.checkPassword(playerId, current, captchaToken)
  if (checked === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!checked) {
    await audit(ctx, 'password_change', playerId, { ok: false })
    return authResponse(INVALID, 401, origin)
  }
  if (passwordRejectReason(next, nameParts(profile.displayName, profile.normalized)) || (typeof next === 'string' && (await deps.hibp(next)) === 'pwned')) {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const saved = await deps.backend.setPassword(playerId, next as string)
  if (!saved) return authResponse({ error: 'unavailable' }, 503, origin)
  const token = bearer(ctx.req)
  await deps.backend.revoke(playerId, 'others', token).catch(() => undefined)
  await audit(ctx, 'password_change', playerId, { ok: true })
  return authResponse({ ok: true }, 200, origin)
}

async function recoverEmailStart(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin, req } = ctx
  // The token is single-use. Start only checks that one is present.
  // Finish forwards a fresh token to Supabase, which verifies it.
  if (!readCaptchaToken(body)) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const ip = clientIp(req)
  const ipKey = deps.hashIp(ip) ?? 'missing'
  const ipRow = await deps.backend.getLimit('recover_ip', ipKey)
  if (recoverIpBlocked(ipRow, now)) {
    await deps.backend.putLimit('recover_ip', ipKey, noteRecoverAttempt(ipRow, now))
    return authResponse(LIMITED, 429, origin)
  }
  await deps.backend.putLimit('recover_ip', ipKey, noteRecoverAttempt(ipRow, now))
  const name = decideName(body.name)
  if (!name.ok) return authResponse({ ok: true }, 202, origin)
  const nameRow = await deps.backend.getLimit('recover_name', name.normalized)
  if (recoverNameBlocked(nameRow, now)) {
    await deps.backend.putLimit('recover_name', name.normalized, noteRecoverAttempt(nameRow, now))
    return authResponse(LIMITED, 429, origin)
  }
  await deps.backend.putLimit('recover_name', name.normalized, noteRecoverAttempt(nameRow, now))
  const profile = await deps.backend.lookupName(name.normalized)
  if (profile && !profile.banned) {
    const recovery = await deps.backend.getRecovery(profile.playerId)
    const target = recovery?.recoveryEmail && recovery.emailVerifiedAt ? recovery.recoveryEmail : recovery?.pendingEmail
    const purpose: RecoveryPurpose = recovery?.emailVerifiedAt && recovery.recoveryEmail ? 'reset' : 'verify'
    if (recovery && target) {
      const code = deps.newCode()
      await deps.backend.saveRecovery({
        ...recovery,
        codeHash: deps.hashCode(code),
        codePurpose: purpose,
        codeExpiresAt: now + CODE_TTL_MS,
        codeAttempts: 0,
        codeBurned: false,
      })
      await deps.sendCode(target, code, purpose).catch(() => undefined)
      await audit(ctx, 'recovery_email_start', profile.playerId, { sent: true, purpose })
    }
  }
  return authResponse({ ok: true }, 202, origin)
}

async function recoverEmailFinish(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const name = decideName(body.name)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!name.ok || !/^\d{6}$/.test(code)) return authResponse(INVALID, 401, origin)
  const profile = await deps.backend.lookupName(name.normalized)
  if (!profile || profile.banned) return authResponse(INVALID, 401, origin)
  const recovery = await deps.backend.getRecovery(profile.playerId)
  if (!recovery || !recovery.codeHash || recovery.codeBurned || recovery.codeExpiresAt == null || recovery.codeExpiresAt <= now) {
    return authResponse(INVALID, 401, origin)
  }
  if (recovery.codeAttempts >= 5) {
    await deps.backend.saveRecovery({ ...recovery, codeBurned: true, codeHash: null })
    return authResponse(INVALID, 401, origin)
  }
  if (!hashesEqual(deps.hashCode(code), recovery.codeHash)) {
    const attempts = recovery.codeAttempts + 1
    await deps.backend.saveRecovery({
      ...recovery,
      codeAttempts: attempts,
      codeBurned: attempts >= 5,
      codeHash: attempts >= 5 ? null : recovery.codeHash,
    })
    await audit(ctx, 'recovery_email_finish', profile.playerId, { ok: false })
    return authResponse(INVALID, 401, origin)
  }
  const next = body.new_password
  if (passwordRejectReason(next, nameParts(profile.displayName, profile.normalized)) || (typeof next === 'string' && (await deps.hibp(next)) === 'pwned')) {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const saved = await deps.backend.setPassword(profile.playerId, next as string)
  if (!saved) return authResponse({ error: 'unavailable' }, 503, origin)
  const signed = await deps.backend.signIn(profile.normalized, next as string, captchaToken)
  if (signed === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!signed) return authResponse({ error: 'unavailable' }, 503, origin)
  await deps.backend.saveRecovery(verifyRecovery(recovery, now))
  await deps.backend.revoke(profile.playerId, 'global').catch(() => undefined)
  await rememberDevice(ctx, profile.playerId, signed.session.access_token)
  await audit(ctx, 'recovery_email_finish', profile.playerId, { ok: true })
  return authResponse(sessionBody(profile.playerId, publicDisplayName(profile.displayName), signed.session), 200, origin)
}

async function recoverCard(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const token = typeof body.card_token === 'string' ? body.card_token.trim() : ''
  if (token.length < 12) return authResponse(INVALID, 401, origin)
  const cardHash = deps.hashCard(token)
  const playerId = await deps.backend.findCard(cardHash)
  if (!playerId) return authResponse(INVALID, 401, origin)
  const profile = await deps.backend.profileById(playerId)
  if (!profile || profile.banned) return authResponse(INVALID, 401, origin)
  const next = body.new_password
  if (passwordRejectReason(next, nameParts(profile.displayName, profile.normalized)) || (typeof next === 'string' && (await deps.hibp(next)) === 'pwned')) {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const saved = await deps.backend.setPassword(playerId, next as string)
  if (!saved) return authResponse({ error: 'unavailable' }, 503, origin)
  const signed = await deps.backend.signIn(profile.normalized, next as string, captchaToken)
  if (signed === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!signed) return authResponse({ error: 'unavailable' }, 503, origin)
  const consumed = await deps.backend.consumeCard(cardHash, new Date(now).toISOString())
  if (!consumed) return authResponse(INVALID, 401, origin)
  await deps.backend.revoke(playerId, 'global').catch(() => undefined)
  const qr = deps.newCard()
  await deps.backend.replaceCard(playerId, deps.hashCard(qr), new Date(now).toISOString())
  await rememberDevice(ctx, playerId, signed.session.access_token)
  await audit(ctx, 'recovery_card', playerId, { ok: true })
  return authResponse({ ...sessionBody(playerId, publicDisplayName(profile.displayName), signed.session), qr_payload: qr }, 200, origin)
}

async function recoverParent(ctx: Ctx): Promise<Response> {
  const { body, deps, origin } = ctx
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  const parentId = live.playerId
  const proof = await reauthOk(ctx, parentId)
  if (proof === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!proof) return authResponse({ error: 'reauth_required' }, 401, origin)
  const childId = typeof body.child_user_id === 'string' ? body.child_user_id : ''
  if (!UUID.test(childId) || !(await deps.backend.activeParent(parentId, childId))) {
    return authResponse({ error: 'not_parent' }, 403, origin)
  }
  const child = await deps.backend.profileById(childId)
  if (!child) return authResponse({ error: 'not_parent' }, 403, origin)
  const next = body.new_password
  if (passwordRejectReason(next, nameParts(child.displayName, child.normalized)) || (typeof next === 'string' && (await deps.hibp(next)) === 'pwned')) {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const saved = await deps.backend.setPassword(childId, next as string)
  if (!saved) return authResponse({ error: 'unavailable' }, 503, origin)
  await deps.backend.revoke(childId, 'global').catch(() => undefined)
  await audit(ctx, 'recovery_parent', childId, { parent: true })
  return authResponse({ ok: true }, 200, origin)
}

async function issueCard(ctx: Ctx): Promise<Response> {
  const { deps, now, origin } = ctx
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  const playerId = live.playerId
  const proof = await reauthOk(ctx, playerId)
  if (proof === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!proof) return authResponse({ error: 'reauth_required' }, 401, origin)
  const qr = deps.newCard()
  await deps.backend.replaceCard(playerId, deps.hashCard(qr), new Date(now).toISOString())
  await audit(ctx, 'recovery_card_issue', playerId, { ok: true })
  return authResponse({ qr_payload: qr }, 200, origin)
}

async function signout(ctx: Ctx): Promise<Response> {
  const { body, deps, origin } = ctx
  const token = bearer(ctx.req)
  if (!token) return authResponse(INVALID, 401, origin)
  const playerId = await deps.backend.playerIdFromAccessToken(token)
  if (!playerId) return authResponse(INVALID, 401, origin)
  await rejectExpiredSession(ctx, playerId, token, false)
  const scope = body.all_devices === true ? 'global' : 'local'
  await deps.backend.revoke(playerId, scope, token)
  return authResponse(null, 204, origin)
}

async function refreshSession(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : ''
  if (refreshToken.length < 10) return authResponse(INVALID, 401, origin)
  const signed = await deps.backend.refresh(refreshToken)
  if (!signed || signed === 'captcha') return authResponse(INVALID, 401, origin)
  const profile = await deps.backend.profileById(signed.playerId)
  if (profile?.banned) {
    await deps.backend.revoke(signed.playerId, 'local', signed.session.access_token).catch(() => undefined)
    return authResponse(INVALID, 401, origin)
  }
  const sessionId = sessionIdFromAccessToken(signed.session.access_token)
  if (!sessionId) {
    await deps.backend.revoke(signed.playerId, 'local', signed.session.access_token).catch(() => undefined)
    return authResponse({ error: 'session_expired' }, 401, origin)
  }
  let device = await deps.backend.getDevice(sessionId)
  if (!device && profile) {
    await rememberDevice(ctx, signed.playerId, signed.session.access_token)
    device = await deps.backend.getDevice(sessionId)
  }
  if (device && device.playerId === signed.playerId && sessionExpired(device, now)) {
    await deps.backend.revoke(signed.playerId, 'local', signed.session.access_token).catch(() => undefined)
    await audit(ctx, 'signin_fail', signed.playerId, { rejected: 'session_expired' })
    return authResponse({ error: 'session_expired' }, 401, origin)
  }
  if (device) await deps.backend.touchDevice(sessionId, new Date(now).toISOString()).catch(() => undefined)
  const shown = profile ? publicDisplayName(profile.displayName) : ''
  const stay = device ? { stay_signed_in: device.stay, absolute_until: new Date(device.absoluteUntil).toISOString() } : stayUntil(ctx)
  return authResponse(sessionBody(signed.playerId, shown, signed.session, stay), 200, origin)
}

function sessionBody(userId: string, displayName: string, session: SessionPair, extra?: Record<string, unknown>) {
  return { user_id: userId, display_name: displayName, session, ...extra }
}

function stayUntil(ctx: Ctx): { absolute_until: string; stay_signed_in: boolean } {
  const stay = staySignedIn(ctx.body.stay_signed_in)
  const ms = stay ? ABSOLUTE_STAY_MS : ABSOLUTE_SHORT_MS
  return { stay_signed_in: stay, absolute_until: new Date(ctx.now + ms).toISOString() }
}

function staySignedIn(value: unknown): boolean {
  return !(value === false || value === 'false' || value === 0)
}

function nameParts(displayName: string, normalized: string): string[] {
  return [displayName, normalized, publicDisplayName(displayName)]
}

function readRecoveryEmail(body: Record<string, unknown>): string | null | 'bad' {
  const raw = body.recovery_email ?? body.email
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string') return 'bad'
  const email = raw.trim().toLowerCase()
  if (email.length < 6 || email.length > 120) return 'bad'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'bad'
  if (email.endsWith(`@${'players.romansgame.invalid'}`) || email.endsWith('@link.romansgame.invalid')) return 'bad'
  return email
}

/** Accept either field. Supabase Attack Protection verifies the value. */
export function readCaptchaToken(body: Record<string, unknown>): string | undefined {
  const raw = body.captchaToken ?? body.turnstile_token
  if (typeof raw !== 'string') return undefined
  const token = raw.trim()
  if (token.length < 10 || token.length > 2048) return undefined
  return token
}

async function rememberDevice(ctx: Ctx, playerId: string, accessToken: string): Promise<void> {
  const sessionId = sessionIdFromAccessToken(accessToken)
  if (!sessionId) return
  const stay = staySignedIn(ctx.body.stay_signed_in)
  const ms = stay ? ABSOLUTE_STAY_MS : ABSOLUTE_SHORT_MS
  const seenAt = new Date(ctx.now).toISOString()
  await ctx.deps.backend.saveDevice({
    playerId,
    sessionId,
    uaHash: ctx.deps.hashUa(ctx.req.headers.get('user-agent') ?? ''),
    stay,
    absoluteUntil: new Date(ctx.now + ms).toISOString(),
    createdAt: seenAt,
    seenAt,
  }).catch(() => undefined)
}

async function livePlayer(ctx: Ctx): Promise<{ playerId: string } | Response> {
  const token = bearer(ctx.req)
  if (!token) return authResponse(INVALID, 401, ctx.origin)
  const playerId = await ctx.deps.backend.playerIdFromAccessToken(token)
  if (!playerId) return authResponse(INVALID, 401, ctx.origin)
  if (await rejectExpiredSession(ctx, playerId, token, true)) {
    return authResponse({ error: 'session_expired' }, 401, ctx.origin)
  }
  return { playerId }
}

/** Revokes a session whose own row is past the idle or absolute cap. A missing row is not expired. */
async function rejectExpiredSession(ctx: Ctx, playerId: string, accessToken: string, touch: boolean): Promise<boolean> {
  const sessionId = sessionIdFromAccessToken(accessToken)
  if (!sessionId) return false
  const device = await ctx.deps.backend.getDevice(sessionId)
  if (!device || device.playerId !== playerId) return false
  if (sessionExpired(device, ctx.now)) {
    await ctx.deps.backend.revoke(playerId, 'local', accessToken).catch(() => undefined)
    await audit(ctx, 'signin_fail', playerId, { rejected: 'session_expired' })
    return true
  }
  if (touch) await ctx.deps.backend.touchDevice(sessionId, new Date(ctx.now).toISOString()).catch(() => undefined)
  return false
}

async function reauthOk(ctx: Ctx, playerId: string): Promise<true | 'captcha' | false> {
  const token = typeof ctx.body.reauth_token === 'string' ? ctx.body.reauth_token : ''
  if (token && (await ctx.deps.backend.consumeReauth(playerId, token, ctx.now))) return true
  if (typeof ctx.body.current_password === 'string' && ctx.body.current_password.length > 0) {
    const checked = await ctx.deps.backend.checkPassword(playerId, ctx.body.current_password, readCaptchaToken(ctx.body))
    if (checked === 'captcha') return 'captcha'
    return checked
  }
  return false
}

function verifyRecovery(row: RecoveryRecord, now: number): RecoveryRecord {
  const email = row.recoveryEmail ?? row.pendingEmail
  return {
    ...row,
    recoveryEmail: email,
    emailVerifiedAt: new Date(now).toISOString(),
    pendingEmail: null,
    codeHash: null,
    codePurpose: null,
    codeExpiresAt: null,
    codeAttempts: 0,
    codeBurned: false,
  }
}

async function audit(ctx: Ctx, eventType: string, subject: string | null, metadata: Record<string, unknown>): Promise<void> {
  await ctx.deps.backend.audit({
    eventType,
    actor: subject,
    subject,
    ipHash: ctx.deps.hashIp(clientIp(ctx.req)),
    metadata: scrubMetadata(metadata),
    createdAt: new Date(ctx.now).toISOString(),
  }).catch(() => undefined)
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const data = (await req.json()) as unknown
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    return data as Record<string, unknown>
  } catch {
    return null
  }
}

export function clientIp(req: Request): string {
  const direct = req.headers.get('x-nf-client-connection-ip')?.trim()
  if (direct) return direct
  const forwarded = req.headers.get('x-forwarded-for')
  if (!forwarded) return ''
  return forwarded.split(',')[0]?.trim() ?? ''
}

function bearer(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  try {
    const url = new URL(origin)
    const host = url.hostname
    if (host === 'romansgame.com' || host.endsWith('.romansgame.com')) return origin
    if (host === 'localhost' || host === '127.0.0.1') return origin
    if (host.endsWith('.netlify.app')) return origin
  } catch {
    return null
  }
  return null
}

function authResponse(body: unknown | null, status: number, origin: string | null): Response {
  const headers = new Headers({ 'cache-control': 'no-store' })
  const allow = allowedOrigin(origin)
  if (allow) {
    headers.set('access-control-allow-origin', allow)
    headers.set('vary', 'origin')
    headers.set('access-control-allow-headers', 'authorization, content-type')
    headers.set('access-control-allow-methods', 'POST, OPTIONS')
  }
  if (body == null || status === 204) return new Response(null, { status, headers })
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

async function sendRecoveryCode(email: string, code: string, purpose: RecoveryPurpose): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return
  const subject = purpose === 'verify' ? "Confirm your Roman's Game recovery email" : "Your Roman's Game code"
  const text = `Your code is ${code}. It works for 10 minutes. If you did not ask for it, you can ignore this email.`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: "Roman's Game <support@romansgame.com>",
      to: [email],
      subject,
      text,
    }),
  })
}
