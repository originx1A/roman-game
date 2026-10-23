import { accountFlagsBody, flagsChanged, mergeAccountFlags } from './accountFlags.ts'
import { PARENT_HOLD_MS, readAgeChoice } from './ageChoice.ts'
import { siteBase } from './http.ts'
import { hashCard, hashCode, hashIp, hashUa, hashesEqual, newCardToken, scrubMetadata, sixDigitCode } from './authCrypto.ts'
import { accountCheckIpBlocked, nameLocked, noteAccountCheck, notePasswordChange, noteRecoverAttempt, noteSigninAttempt, noteSigninFailure, noteSignupAttempt, passwordChangeBlocked, recoverIpBlocked, recoverNameBlocked, signinIpBlocked, signupIpBlocked, type LimitRow } from './authLimits.ts'
import { ABSOLUTE_SHORT_MS, ABSOLUTE_STAY_MS, sessionExpired, sessionIdFromAccessToken } from './sessionClock.ts'
import { allocateGroupName } from './groupNames.ts'
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
  | 'recover-lost-start'
  | 'recover-lost-code'
  | 'recover-lost-finish'
  | 'recover-card'
  | 'recover-parent'
  | 'recovery-card-issue'
  | 'refresh'
  | 'signout'
  | 'account'
  | 'name'
  | 'flags'
  | 'session'
  | 'family'
  | 'parent-email'

const INVALID = { error: 'invalid_credentials' }
const LIMITED = { error: 'rate_limited' }
const CODE_TTL_MS = 10 * 60_000
/**
 * A mailed code uses codeAttempts 0. After it is accepted, the same column holds
 * a reset grant at this mark so a second try of the 6-digit code cannot clear it.
 * account_recovery.code_attempts allows 0 through 20.
 */
const GRANT_MARK = 20
export const RECOVERY_SENT_MESSAGE = 'If that email is on an account, we sent a code'
export const RECOVERY_CODE_FAILED_MESSAGE = "That code didn't work. Enter your email to get a new one."
const CODE_FAILED = { error: 'code_invalid', message: RECOVERY_CODE_FAILED_MESSAGE, step: 'email' }
const SENT = { ok: true, message: RECOVERY_SENT_MESSAGE }
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
  sendParentLink: (email: string, url: string) => Promise<void>
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
    sendParentLink: sendParentApproval,
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
      case 'recover-lost-start':
        return await recoverLostStart(ctx)
      case 'recover-lost-code':
        return await recoverLostCode(ctx)
      case 'recover-lost-finish':
        return await recoverLostFinish(ctx)
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
      case 'account':
        return await accountCheck(ctx)
      case 'name':
        return await setPlayerName(ctx)
      case 'flags':
        return await saveFlags(ctx)
      case 'session':
        return await sessionCheck(ctx)
      case 'family':
        return await family(ctx)
      case 'parent-email':
        return await parentEmail(ctx)
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

  const age = readAgeChoice(body.age_choice)
  if (!age) return authResponse({ error: 'age_required' }, 422, origin)
  const named = await signupIdentity(ctx)
  if (named instanceof Response) return named
  const { name, shown, email, autoNamed } = named
  const saveEmail = age === '13_plus' ? email : null

  let codeHash: string | null = null
  let codeExpiresAt: string | null = null
  let plainCode: string | null = null
  if (saveEmail) {
    plainCode = deps.newCode()
    codeHash = deps.hashCode(plainCode)
    codeExpiresAt = new Date(now + CODE_TTL_MS).toISOString()
  }
  const created = await deps.backend.createAccount({
    normalized: name.normalized,
    displayName: name.displayName,
    publicName: shown,
    password: body.password as string,
    pendingEmail: saveEmail,
    codeHash,
    codePurpose: saveEmail ? 'verify' : null,
    codeExpiresAt,
    captchaToken,
  })
  if (created === 'taken') return authResponse({ error: 'name_taken' }, 409, origin)
  if (created === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (created === 'failed') return authResponse({ error: 'unavailable' }, 503, origin)
  const savedAge = await deps.backend.saveAgeChoice(created.playerId, age, new Date(now).toISOString())
  if (savedAge === 'locked') return authResponse({ error: 'age_locked' }, 409, origin)
  if (age === '13_plus') body.age_confirmed = true
  else delete body.age_confirmed
  if (age === 'under_13' && email) {
    const token = deps.newCard()
    await deps.backend.holdParentEmail({
      childId: created.playerId,
      email,
      tokenHash: deps.hashCard(token),
      expiresAt: new Date(now + PARENT_HOLD_MS).toISOString(),
    })
    const link = `${siteBase()}/api/auth/parent-approve?token=${encodeURIComponent(token)}`
    await deps.sendParentLink(email, link).catch(() => undefined)
  }
  if (saveEmail && plainCode) await deps.sendCode(saveEmail, plainCode, 'verify').catch(() => undefined)
  if (saveEmail) await deps.backend.linkKidsByEmail(created.playerId, saveEmail).catch(() => undefined)
  if (autoNamed) await markAutoNamed(ctx, created.playerId, true)
  await rememberDevice(ctx, created.playerId, created.session.access_token)
  await audit(ctx, 'signup', created.playerId, { name_normalized: name.normalized, age_choice: age, auto_named: autoNamed })
  return authResponse(
    await withFlags(ctx, created.playerId, {
      ...sessionBody(created.playerId, shown, created.session, { ...stayUntil(ctx), player_name: name.displayName, auto_named: autoNamed }),
      age_choice: age,
      parent_email_pending: age === 'under_13' && !!email,
    }),
    201,
    origin,
  )
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

  const rawName = typeof body.name === 'string' ? body.name.trim() : ''
  if (rawName.includes('@')) return signInWithEmail(ctx, rawName, ipKey, attempted)

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
  return authResponse(await withFlags(ctx, signed.playerId, namedSession(signed.playerId, profile.displayName, signed.session, stayUntil(ctx))), 200, origin)
}

type SignupIdentity = {
  name: { displayName: string; normalized: string }
  shown: string
  email: string | null
  autoNamed: boolean
}

/** A name field that is an email becomes recovery. The public name is generated. */
async function signupIdentity(ctx: Ctx): Promise<Response | SignupIdentity> {
  const { body, deps, origin } = ctx
  const raw = typeof body.name === 'string' ? body.name.trim() : ''
  const fromName = raw.includes('@') ? readRecoveryEmail({ email: raw }) : null
  if (fromName === 'bad') return authResponse({ error: 'bad_recovery_email' }, 422, origin)
  let email: string | null
  let autoNamed = false
  let displayName: string
  let normalized: string
  if (fromName) {
    email = fromName
    autoNamed = true
    if (await emailOwnedByAdult(ctx, fromName)) return authResponse({ error: 'email_taken' }, 409, origin)
    const generated = await allocateGroupName(async (candidate) => !!(await deps.backend.lookupName(candidate)))
    if (!generated) return authResponse({ error: 'unavailable' }, 503, origin)
    displayName = generated.displayName
    normalized = generated.normalized
  } else {
    const parsed = readRecoveryEmail(body)
    if (parsed === 'bad') return authResponse({ error: 'bad_recovery_email' }, 422, origin)
    email = parsed
    const decided = decideName(body.name)
    if (!decided.ok) {
      await audit(ctx, 'signup', null, { rejected: 'name' })
      return authResponse({ error: 'name_rejected' }, 422, origin)
    }
    displayName = decided.displayName
    normalized = decided.normalized
  }
  const shown = publicDisplayName(displayName)
  if (!shown || displayName.includes('@')) return authResponse({ error: 'name_rejected' }, 422, origin)
  const parts = nameParts(displayName, normalized)
  if (email) parts.push(email)
  const weak = passwordRejectReason(body.password, parts)
  if (weak || (await deps.hibp(body.password as string)) === 'pwned') {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  return { name: { displayName, normalized }, shown, email, autoNamed }
}

/** Another non-kid account already uses this address, so email sign-in would be ambiguous. */
async function emailOwnedByAdult(ctx: Ctx, email: string): Promise<boolean> {
  return (await adultEmailOwners(ctx, email)).length > 0
}

async function adultEmailOwners(ctx: Ctx, email: string): Promise<{ id: string; banned: boolean }[]> {
  const ids = await ctx.deps.backend.findRecoveryByEmail(email)
  const owners: { id: string; banned: boolean }[] = []
  for (const id of ids) {
    const profile = await ctx.deps.backend.profileById(id)
    if (!profile) continue
    const age = await ctx.deps.backend.getAgeChoice(id)
    if (age === 'under_13') continue
    if (await ctx.deps.backend.isLinkedChild(id)) continue
    const recovery = await ctx.deps.backend.getRecovery(id)
    if (!recovery) continue
    const pending = recovery.pendingEmail === email
    const verified = recovery.recoveryEmail === email && recovery.emailVerifiedAt != null
    if (!pending && !verified) continue
    owners.push({ id, banned: profile.banned })
  }
  return owners
}

/** Verified recovery, or this account's own pending address. Never a kid or a linked child. */
async function eligibleEmailAccount(ctx: Ctx, email: string): Promise<string | null> {
  const open = (await adultEmailOwners(ctx, email)).filter((owner) => !owner.banned)
  return open.length === 1 ? open[0].id : null
}

async function signInWithEmail(ctx: Ctx, raw: string, ipKey: string, attempted: LimitRow): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const parsed = readRecoveryEmail({ email: raw })
  const subject = 'e.' + deps.hashCode(parsed && parsed !== 'bad' ? parsed : raw.trim().toLowerCase())
  const nameRow = await deps.backend.getLimit('signin_name', subject)
  if (nameLocked(nameRow, now)) {
    await audit(ctx, 'lockout', null, { scope: 'email' })
    return authResponse(LIMITED, 429, origin)
  }
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const playerId = parsed && parsed !== 'bad' ? await eligibleEmailAccount(ctx, parsed) : null
  const profile = playerId ? await deps.backend.profileById(playerId) : null
  const password = typeof body.password === 'string' ? body.password : ''
  const signed = profile ? await deps.backend.signIn(profile.normalized, password, captchaToken) : null
  if (signed === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!signed || !profile || profile.banned || signed.playerId !== profile.playerId) {
    if (signed) await deps.backend.revoke(signed.playerId, 'global', signed.session.access_token).catch(() => undefined)
    const noted = noteSigninFailure(nameRow, attempted, now)
    await deps.backend.putLimit('signin_name', subject, noted.name)
    await deps.backend.putLimit('signin_ip', ipKey, noted.ip)
    await audit(ctx, noted.locked ? 'lockout' : 'signin_fail', null, { scope: 'email' })
    return authResponse(noted.locked ? LIMITED : INVALID, noted.locked ? 429 : 401, origin)
  }
  const cleared = { ...nameRow, failures: [], lockedUntil: null }
  await deps.backend.putLimit('signin_name', subject, cleared)
  await rememberDevice(ctx, signed.playerId, signed.session.access_token)
  await audit(ctx, 'signin_ok', signed.playerId, { scope: 'email' })
  return authResponse(await withFlags(ctx, signed.playerId, namedSession(signed.playerId, profile.displayName, signed.session, stayUntil(ctx))), 200, origin)
}

async function markAutoNamed(ctx: Ctx, playerId: string, on: boolean): Promise<void> {
  try {
    const flags = await ctx.deps.backend.getFlags(playerId)
    if (flags.autoNamed === on) return
    flags.autoNamed = on
    await ctx.deps.backend.saveFlags(playerId, flags, new Date(ctx.now).toISOString())
  } catch {
    /* Migration 015 may not be applied yet. The response still reports auto_named. */
  }
}

async function setPlayerName(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  if (!readCaptchaToken(body)) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const row = await deps.backend.getLimit('player_name', live.playerId)
  if (passwordChangeBlocked(row, now)) return authResponse(LIMITED, 429, origin)
  await deps.backend.putLimit('player_name', live.playerId, notePasswordChange(row, now))
  const decided = decideName(body.name)
  const shown = decided.ok ? publicDisplayName(decided.displayName) : ''
  if (!decided.ok || !shown || decided.displayName.includes('@')) return authResponse({ error: 'name_rejected' }, 422, origin)
  const renamed = await deps.backend.renameAccount(live.playerId, decided.displayName, decided.normalized, shown)
  if (renamed === 'taken') return authResponse({ error: 'name_taken' }, 409, origin)
  if (renamed !== 'ok') return authResponse({ error: 'unavailable' }, 503, origin)
  await markAutoNamed(ctx, live.playerId, false)
  const flags = await deps.backend.getFlags(live.playerId)
  return authResponse(
    { ok: true, player_name: decided.displayName, display_name: shown, auto_named: false, flags: accountFlagsBody(flags) },
    200,
    origin,
  )
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
      await clearResetGrants(ctx, target)
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
  if (!name.ok) return authResponse(CODE_FAILED, 401, origin)
  const profile = await deps.backend.lookupName(name.normalized)
  if (!profile || profile.banned) return authResponse(CODE_FAILED, 401, origin)
  const recovery = await deps.backend.getRecovery(profile.playerId)
  const digits = /^\d{6}$/.test(code)
  const matches = !!recovery?.codeHash && digits && hashesEqual(deps.hashCode(code), recovery.codeHash)
  if (!recovery || !mailedCodeActive(recovery, now) || !matches) {
    if (recovery && mailedCodeActive(recovery, now)) await burnMailedCode(ctx, recovery)
    await audit(ctx, 'recovery_email_finish', profile.playerId, { ok: false })
    return authResponse(CODE_FAILED, 401, origin)
  }
  const next = body.new_password
  if (passwordRejectReason(next, nameParts(profile.displayName, profile.normalized)) || (typeof next === 'string' && (await deps.hibp(next)) === 'pwned')) {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const saved = await deps.backend.setPassword(profile.playerId, next as string)
  if (!saved) return authResponse({ error: 'unavailable' }, 503, origin)
  const verified = verifyRecovery(recovery, now)
  await deps.backend.saveRecovery(verified)
  if (verified.recoveryEmail) await deps.backend.linkKidsByEmail(profile.playerId, verified.recoveryEmail).catch(() => undefined)
  await deps.backend.revoke(profile.playerId, 'global').catch(() => undefined)
  const signed = await deps.backend.signIn(profile.normalized, next as string, captchaToken)
  if (signed === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!signed) return authResponse({ error: 'unavailable' }, 503, origin)
  await rememberDevice(ctx, profile.playerId, signed.session.access_token)
  await audit(ctx, 'recovery_email_finish', profile.playerId, { ok: true })
  return authResponse(
    await withFlags(ctx, profile.playerId, sessionBody(profile.playerId, publicDisplayName(profile.displayName), signed.session, { player_name: profile.displayName })),
    200,
    origin,
  )
}

async function recoverLostStart(ctx: Ctx): Promise<Response> {
  const { body, deps, origin } = ctx
  if (!readCaptchaToken(body)) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const email = readRecoveryEmail(body)
  const limited = await noteLostAttempt(ctx, email && email !== 'bad' ? email : null)
  if (limited) return limited
  if (!email || email === 'bad') return authResponse(SENT, 202, origin)
  const { owners } = await accountsForEmail(ctx, email)
  if (owners.length === 0) {
    await audit(ctx, 'recovery_lost_start', null, { sent: false })
    return authResponse(SENT, 202, origin)
  }
  await clearResetGrants(ctx, email)
  const code = deps.newCode()
  const hash = deps.hashCode(code)
  const expires = ctx.now + CODE_TTL_MS
  for (const playerId of owners) {
    const row = await deps.backend.getRecovery(playerId)
    if (!row) continue
    await deps.backend.saveRecovery({
      ...row,
      codeHash: hash,
      codePurpose: 'reset',
      codeExpiresAt: expires,
      codeAttempts: 0,
      codeBurned: false,
    })
  }
  await deps.sendCode(email, code, 'reset').catch(() => undefined)
  await audit(ctx, 'recovery_lost_start', owners[0] ?? null, { sent: true })
  return authResponse(SENT, 202, origin)
}

async function recoverLostCode(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  if (!readCaptchaToken(body)) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const limited = await noteLostAttempt(ctx, null)
  if (limited) return limited
  const email = readRecoveryEmail(body)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!email || email === 'bad') return authResponse(CODE_FAILED, 401, origin)
  const found = await accountsForEmail(ctx, email)
  const presented = /^\d{6}$/.test(code) ? deps.hashCode(code) : ''
  let matched = false
  const live: RecoveryRecord[] = []
  for (const playerId of found.owners) {
    const row = await deps.backend.getRecovery(playerId)
    if (!row || !mailedCodeActive(row, now) || !row.codeHash) continue
    live.push(row)
    if (presented && hashesEqual(presented, row.codeHash)) matched = true
  }
  if (!matched || found.accounts.length === 0) {
    for (const row of live) await burnMailedCode(ctx, row)
    await audit(ctx, 'recovery_lost_code', null, { ok: false })
    return authResponse(CODE_FAILED, 401, origin)
  }
  const token = deps.newCard()
  const grantHash = deps.hashCode(token)
  const expires = now + CODE_TTL_MS
  for (const playerId of found.owners) {
    const row = await deps.backend.getRecovery(playerId)
    if (!row) continue
    const mailbox = row.recoveryEmail ?? row.pendingEmail
    await deps.backend.saveRecovery({
      ...row,
      recoveryEmail: mailbox,
      emailVerifiedAt: new Date(now).toISOString(),
      pendingEmail: null,
      codeHash: grantHash,
      codePurpose: 'reset',
      codeExpiresAt: expires,
      codeAttempts: GRANT_MARK,
      codeBurned: false,
    })
    if ((await deps.backend.getAgeChoice(playerId)) === '13_plus') {
      await deps.backend.linkKidsByEmail(playerId, email).catch(() => undefined)
    }
  }
  const { accounts } = await accountsForEmail(ctx, email)
  await audit(ctx, 'recovery_lost_code', found.owners[0] ?? null, { ok: true, accounts: accounts.length })
  return authResponse({
    reset_token: token,
    accounts: accounts.map((account) => ({
      user_id: account.userId,
      player_name: account.playerName,
      role: account.role,
    })),
  }, 200, origin)
}

async function recoverLostFinish(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin } = ctx
  const token = typeof body.reset_token === 'string' ? body.reset_token.trim() : ''
  const userId = typeof body.user_id === 'string' ? body.user_id : ''
  if (token.length < 12 || !UUID.test(userId)) return authResponse(CODE_FAILED, 401, origin)
  const limited = await noteLostAttempt(ctx, null)
  if (limited) return limited
  const grantHash = deps.hashCode(token)
  const holders = await deps.backend.findPlayersByCodeHash(grantHash)
  const owners: string[] = []
  let mailbox: string | null = null
  for (const playerId of holders) {
    const row = await deps.backend.getRecovery(playerId)
    if (!row || !grantActive(row, now) || !row.codeHash || !hashesEqual(row.codeHash, grantHash)) continue
    owners.push(playerId)
    mailbox = row.recoveryEmail ?? row.pendingEmail
  }
  if (owners.length === 0 || !mailbox) return authResponse(CODE_FAILED, 401, origin)
  const { accounts } = await accountsForEmail(ctx, mailbox)
  const chosen = accounts.find((account) => account.userId === userId)
  const profile = chosen ? await deps.backend.profileById(chosen.userId) : null
  if (!chosen || !profile || profile.banned) return authResponse(CODE_FAILED, 401, origin)
  const next = body.new_password
  const parts = nameParts(profile.displayName, profile.normalized)
  if (mailbox) parts.push(mailbox)
  if (passwordRejectReason(next, parts) || (typeof next === 'string' && (await deps.hibp(next)) === 'pwned')) {
    return authResponse({ error: 'weak_password', hint: PASSWORD_HINT }, 422, origin)
  }
  const captchaToken = readCaptchaToken(body)
  if (!captchaToken) return authResponse({ error: 'turnstile_required' }, 403, origin)
  const taken = await takeResetGrant(ctx, grantHash)
  if (!taken) return authResponse(CODE_FAILED, 401, origin)
  const saved = await deps.backend.setPassword(profile.playerId, next as string)
  if (!saved) return authResponse({ error: 'unavailable' }, 503, origin)
  await deps.backend.revoke(profile.playerId, 'global').catch(() => undefined)
  const signed = await deps.backend.signIn(profile.normalized, next as string, captchaToken)
  if (signed === 'captcha') return authResponse({ error: 'turnstile_required' }, 403, origin)
  if (!signed) return authResponse({ error: 'unavailable' }, 503, origin)
  await rememberDevice(ctx, profile.playerId, signed.session.access_token)
  await audit(ctx, 'recovery_lost_finish', profile.playerId, { ok: true })
  return authResponse(
    await withFlags(
      ctx,
      profile.playerId,
      sessionBody(profile.playerId, publicDisplayName(profile.displayName), signed.session, {
        ...stayUntil(ctx),
        player_name: profile.displayName,
      }),
    ),
    200,
    origin,
  )
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
  return authResponse(
    await withFlags(ctx, playerId, { ...sessionBody(playerId, publicDisplayName(profile.displayName), signed.session), qr_payload: qr }),
    200,
    origin,
  )
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
  return authResponse(await withFlags(ctx, signed.playerId, sessionBody(signed.playerId, shown, signed.session, stay)), 200, origin)
}

/**
 * New or existing by player name. An email in the body is ignored and never looked up,
 * so this cannot tell anyone whether an address is registered.
 */
async function accountCheck(ctx: Ctx): Promise<Response> {
  const { body, deps, now, origin, req } = ctx
  const ip = clientIp(req)
  const ipKey = deps.hashIp(ip) ?? 'missing'
  const ipRow = await deps.backend.getLimit('account_check_ip', ipKey)
  if (accountCheckIpBlocked(ipRow, now)) {
    await deps.backend.putLimit('account_check_ip', ipKey, noteAccountCheck(ipRow, now))
    return authResponse(LIMITED, 429, origin)
  }
  await deps.backend.putLimit('account_check_ip', ipKey, noteAccountCheck(ipRow, now))
  const name = decideName(body.name)
  if (!name.ok) {
    await audit(ctx, 'account_check', null, { rejected: name.reason })
    return authResponse({ error: 'name_rejected' }, 422, origin)
  }
  const profile = await deps.backend.lookupName(name.normalized)
  const account = profile ? 'existing' : 'new'
  await audit(ctx, 'account_check', profile?.playerId ?? null, { name_normalized: name.normalized, account })
  return authResponse({ account }, 200, origin)
}

async function saveFlags(ctx: Ctx): Promise<Response> {
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  const flags = await rememberFlags(ctx, live.playerId)
  await audit(ctx, 'account_flags', live.playerId, { age_confirmed: flags.ageConfirmedAt != null, terms_accepted: flags.termsAcceptedAt != null })
  return authResponse({ flags: accountFlagsBody(flags) }, 200, ctx.origin)
}

/** Load and focus check. A dead or idle session is 401. The saved login otherwise stays. */
async function sessionCheck(ctx: Ctx): Promise<Response> {
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  const profile = await ctx.deps.backend.profileById(live.playerId)
  if (profile?.banned) {
    const token = bearer(ctx.req)
    await ctx.deps.backend.revoke(live.playerId, 'local', token).catch(() => undefined)
    return authResponse(INVALID, 401, ctx.origin)
  }
  const flags = await rememberFlags(ctx, live.playerId)
  const ageChoice = await ctx.deps.backend.getAgeChoice(live.playerId)
  const sessionId = sessionIdFromAccessToken(bearer(ctx.req))
  const device = sessionId ? await ctx.deps.backend.getDevice(sessionId) : null
  const stay = device
    ? { stay_signed_in: device.stay, absolute_until: new Date(device.absoluteUntil).toISOString() }
    : { stay_signed_in: true, absolute_until: null }
  return authResponse(
    {
      user_id: live.playerId,
      display_name: profile ? publicDisplayName(profile.displayName) : '',
      player_name: profile && !profile.displayName.includes('@') ? profile.displayName : '',
      age_choice: ageChoice,
      flags: accountFlagsBody(flags),
      ...stay,
    },
    200,
    ctx.origin,
  )
}

async function rememberFlags(ctx: Ctx, playerId: string) {
  const current = await ctx.deps.backend.getFlags(playerId)
  const next = mergeAccountFlags(current, ctx.body, new Date(ctx.now).toISOString())
  if (!flagsChanged(current, next)) return current
  try {
    await ctx.deps.backend.saveFlags(playerId, next, new Date(ctx.now).toISOString())
  } catch {
    return current
  }
  return next
}

async function withFlags(ctx: Ctx, playerId: string, body: Record<string, unknown>) {
  const flags = await rememberFlags(ctx, playerId)
  return { ...body, flags: accountFlagsBody(flags) }
}

function sessionBody(userId: string, displayName: string, session: SessionPair, extra?: Record<string, unknown>) {
  return { user_id: userId, display_name: displayName, session, ...extra }
}

function namedSession(userId: string, displayName: string, session: SessionPair, extra?: Record<string, unknown>) {
  const playerName = displayName.includes('@') ? '' : displayName
  return sessionBody(userId, publicDisplayName(displayName), session, { ...extra, player_name: playerName })
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

type ListedAccount = { userId: string; playerName: string; role: 'account' | 'kid' }

function mailedCodeActive(row: RecoveryRecord, now: number): boolean {
  return row.codeAttempts !== GRANT_MARK && !!row.codeHash && !row.codeBurned && row.codeExpiresAt != null && row.codeExpiresAt > now
}

function grantActive(row: RecoveryRecord, now: number): boolean {
  return row.codeAttempts === GRANT_MARK && !!row.codeHash && !row.codeBurned && row.codeExpiresAt != null && row.codeExpiresAt > now
}

function shownPlayerName(displayName: string): string {
  if (displayName.includes('@')) return ''
  return displayName
}

/** Sending is limited per IP and per mailbox. Code and password steps only count the IP. */
async function noteLostAttempt(ctx: Ctx, email: string | null): Promise<Response | null> {
  const { deps, now, origin, req } = ctx
  const ipKey = deps.hashIp(clientIp(req)) ?? 'missing'
  const ipRow = await deps.backend.getLimit('recover_ip', ipKey)
  if (recoverIpBlocked(ipRow, now)) {
    await deps.backend.putLimit('recover_ip', ipKey, noteRecoverAttempt(ipRow, now))
    return authResponse(LIMITED, 429, origin)
  }
  await deps.backend.putLimit('recover_ip', ipKey, noteRecoverAttempt(ipRow, now))
  if (!email) return null
  const subject = deps.hashCode(email)
  const row = await deps.backend.getLimit('recover_email', subject)
  if (recoverNameBlocked(row, now)) {
    await deps.backend.putLimit('recover_email', subject, noteRecoverAttempt(row, now))
    return authResponse(LIMITED, 429, origin)
  }
  await deps.backend.putLimit('recover_email', subject, noteRecoverAttempt(row, now))
  return null
}

async function burnMailedCode(ctx: Ctx, row: RecoveryRecord): Promise<void> {
  await ctx.deps.backend.saveRecovery({
    ...row,
    codeHash: null,
    codePurpose: null,
    codeExpiresAt: null,
    codeAttempts: 1,
    codeBurned: true,
  })
}

async function clearResetGrants(ctx: Ctx, email: string): Promise<void> {
  const ids = await ctx.deps.backend.findRecoveryByEmail(email)
  for (const playerId of ids) {
    const row = await ctx.deps.backend.getRecovery(playerId)
    if (!row || !grantActive(row, ctx.now)) continue
    await ctx.deps.backend.saveRecovery({
      ...row,
      codeHash: null,
      codePurpose: null,
      codeExpiresAt: null,
      codeAttempts: 0,
      codeBurned: true,
    })
  }
}

async function takeResetGrant(ctx: Ctx, grantHash: string): Promise<boolean> {
  const ids = await ctx.deps.backend.findPlayersByCodeHash(grantHash)
  let taken = false
  for (const playerId of ids) {
    const row = await ctx.deps.backend.getRecovery(playerId)
    if (!row || !grantActive(row, ctx.now) || !row.codeHash || !hashesEqual(row.codeHash, grantHash)) continue
    await ctx.deps.backend.saveRecovery({
      ...row,
      codeHash: null,
      codePurpose: null,
      codeExpiresAt: null,
      codeAttempts: 0,
      codeBurned: true,
    })
    taken = true
  }
  return taken
}

async function accountsForEmail(ctx: Ctx, email: string): Promise<{ owners: string[]; accounts: ListedAccount[] }> {
  const ids = await ctx.deps.backend.findRecoveryByEmail(email)
  const seen = new Set<string>()
  const accounts: ListedAccount[] = []
  const owners: string[] = []
  for (const id of ids) {
    const profile = await ctx.deps.backend.profileById(id)
    if (!profile || profile.banned) continue
    const recovery = await ctx.deps.backend.getRecovery(id)
    if (!recovery) continue
    const owns = (recovery.recoveryEmail === email && recovery.emailVerifiedAt != null) || recovery.pendingEmail === email
    if (!owns) continue
    owners.push(id)
    const age = await ctx.deps.backend.getAgeChoice(id)
    if (!seen.has(id)) {
      seen.add(id)
      accounts.push({
        userId: id,
        playerName: shownPlayerName(profile.displayName),
        role: age === 'under_13' ? 'kid' : 'account',
      })
    }
    if (age !== '13_plus') continue
    const kids = await ctx.deps.backend.listKids(id)
    for (const kid of kids) {
      if (seen.has(kid.userId)) continue
      const child = await ctx.deps.backend.profileById(kid.userId)
      if (!child || child.banned) continue
      seen.add(kid.userId)
      accounts.push({
        userId: kid.userId,
        playerName: shownPlayerName(child.displayName || kid.displayName),
        role: 'kid',
      })
    }
  }
  accounts.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'account' ? -1 : 1
    return a.playerName.localeCompare(b.playerName)
  })
  return { owners, accounts }
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

async function family(ctx: Ctx): Promise<Response> {
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  const allowed = await parentAccount(ctx, live.playerId)
  if (allowed) return allowed
  const action = typeof ctx.body.action === 'string' ? ctx.body.action : 'list'
  if (action === 'list') {
    const kids = await ctx.deps.backend.listKids(live.playerId)
    return authResponse({
      kids: kids.map((kid) => ({
        user_id: kid.userId,
        display_name: publicDisplayName(kid.displayName) || kid.displayName,
      })),
    }, 200, ctx.origin)
  }
  const childId = typeof ctx.body.child_user_id === 'string' ? ctx.body.child_user_id : ''
  if (!UUID.test(childId)) return authResponse({ error: 'not_parent' }, 403, ctx.origin)
  if (action === 'remove') {
    const removed = await ctx.deps.backend.revokeKid(live.playerId, childId)
    if (!removed) return authResponse({ error: 'not_parent' }, 403, ctx.origin)
    await audit(ctx, 'family_remove', childId, { parent: true })
    return authResponse({ ok: true }, 200, ctx.origin)
  }
  if (action === 'reset') return recoverParent(ctx)
  return authResponse({ error: 'bad_request' }, 400, ctx.origin)
}

async function parentEmail(ctx: Ctx): Promise<Response> {
  const live = await livePlayer(ctx)
  if (live instanceof Response) return live
  if (!readCaptchaToken(ctx.body)) return authResponse({ error: 'turnstile_required' }, 403, ctx.origin)
  const age = await ctx.deps.backend.getAgeChoice(live.playerId)
  if (!age) return authResponse({ error: 'age_required' }, 422, ctx.origin)
  if (age !== 'under_13') return authResponse({ error: 'recovery_email_only' }, 403, ctx.origin)
  const email = readRecoveryEmail(ctx.body)
  if (!email || email === 'bad') return authResponse({ error: 'bad_recovery_email' }, 422, ctx.origin)
  const token = ctx.deps.newCard()
  await ctx.deps.backend.holdParentEmail({
    childId: live.playerId,
    email,
    tokenHash: ctx.deps.hashCard(token),
    expiresAt: new Date(ctx.now + PARENT_HOLD_MS).toISOString(),
  })
  const link = `${siteBase()}/api/auth/parent-approve?token=${encodeURIComponent(token)}`
  await ctx.deps.sendParentLink(email, link).catch(() => undefined)
  await audit(ctx, 'parent_email_hold', live.playerId, { held: true })
  const recovery = await ctx.deps.backend.getRecovery(live.playerId)
  return authResponse({ ok: true, parent_email_pending: true, recovery_saved: !!recovery?.recoveryEmail }, 202, ctx.origin)
}

/** A family page needs a 13+ account with its own email. A kid account cannot open it. */
async function parentAccount(ctx: Ctx, playerId: string): Promise<Response | null> {
  const age = await ctx.deps.backend.getAgeChoice(playerId)
  if (age !== '13_plus') return authResponse({ error: 'not_parent' }, 403, ctx.origin)
  const recovery = await ctx.deps.backend.getRecovery(playerId)
  const email = recovery?.recoveryEmail || recovery?.pendingEmail
  if (!email) return authResponse({ error: 'not_parent' }, 403, ctx.origin)
  return null
}

async function sendParentApproval(email: string, url: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return
  const text = `Open this link to approve the recovery email for a Roman's Game account: ${url} The link works for 7 days. It does not create an account, and it does not allow purchases. If you did not expect it, you can ignore this email.`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: "Roman's Game <support@romansgame.com>",
      to: [email],
      subject: "Approve a Roman's Game recovery email",
      text,
    }),
  })
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
