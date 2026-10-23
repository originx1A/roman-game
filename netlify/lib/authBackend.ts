import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { consumeReauth, hashSecret, newSecret } from './reauth.ts'
import { loginEmail } from './authCrypto.ts'
import { emptyLimit, type LimitRow } from './authLimits.ts'
import { SUPABASE_PUBLISHABLE, SUPABASE_URL, supabaseAdmin } from './supabaseAdmin.ts'
import { emptyAccountFlags, type AccountFlags } from './accountFlags.ts'
import type { AgeChoice } from './ageChoice.ts'
import { playerInsert, profileInsert, type AuthBackend, type DeviceRecord, type PasswordSignIn, type ProfileRecord, type RecoveryRecord, type SessionPair } from './authTypes.ts'
import { scrubMetadata } from './authCrypto.ts'

type Row = Record<string, unknown>

export function supabaseAuthBackend(): AuthBackend | null {
  const admin = supabaseAdmin()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!admin || !key) return null
  return new SupabaseAuthBackend(admin, key)
}

class SupabaseAuthBackend implements AuthBackend {
  private readonly admin: SupabaseClient
  private readonly serviceKey: string

  constructor(admin: SupabaseClient, serviceKey: string) {
    this.admin = admin
    this.serviceKey = serviceKey
  }

  async lookupName(normalized: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.admin
      .from('profiles')
      .select('player_id, display_name, name_normalized')
      .eq('name_normalized', normalized)
      .maybeSingle()
    if (error || !data) return null
    return this.withBan(data as Row)
  }

  async renameAccount(playerId: string, displayName: string, normalized: string, publicName: string): Promise<'ok' | 'taken' | 'failed'> {
    const existing = await this.lookupName(normalized)
    if (existing && existing.playerId !== playerId) return 'taken'
    const { error: profileError } = await this.admin
      .from('profiles')
      .update({ display_name: displayName, name_normalized: normalized })
      .eq('player_id', playerId)
    if (profileError) return duplicate(profileError) ? 'taken' : 'failed'
    const { error: playerError } = await this.admin.from('players').update({ display_name: publicName }).eq('id', playerId)
    if (playerError) return 'failed'
    const { error: userError } = await this.admin.auth.admin.updateUserById(playerId, { email: loginEmail(normalized) })
    if (userError) return 'failed'
    return 'ok'
  }

  async isLinkedChild(playerId: string): Promise<boolean> {
    const { data, error } = await this.admin
      .from('parent_links')
      .select('id')
      .eq('child_id', playerId)
      .eq('status', 'active')
      .limit(1)
    return !error && Array.isArray(data) && data.length > 0
  }

  async profileById(playerId: string): Promise<ProfileRecord | null> {
    const { data, error } = await this.admin
      .from('profiles')
      .select('player_id, display_name, name_normalized')
      .eq('player_id', playerId)
      .maybeSingle()
    if (error || !data) return null
    return this.withBan(data as Row)
  }

  async signIn(normalized: string, password: string, captchaToken?: string): Promise<PasswordSignIn> {
    const { data, error } = await this.admin.auth.signInWithPassword({
      email: loginEmail(normalized),
      password,
      options: { captchaToken },
    })
    if (isCaptchaError(error)) return 'captcha'
    if (error || !data.session || !data.user) return null
    return { playerId: data.user.id, session: toSession(data.session) }
  }

  async createAccount(input: Parameters<AuthBackend['createAccount']>[0]): Promise<{ playerId: string; session: SessionPair } | 'taken' | 'failed' | 'captcha'> {
    // Confirm email is ON for the project. The synthetic address is not a mailbox,
    // so the admin create marks it confirmed. auth.signUp would leave it unconfirmed.
    const { data, error } = await this.admin.auth.admin.createUser({
      email: loginEmail(input.normalized),
      password: input.password,
      email_confirm: true,
    })
    if (error || !data.user) return duplicate(error) ? 'taken' : 'failed'
    const id = data.user.id
    const { error: playerError } = await this.admin.from('players').insert(playerInsert(id, input.publicName))
    if (playerError) {
      await this.admin.auth.admin.deleteUser(id)
      return duplicate(playerError) ? 'taken' : 'failed'
    }
    const { error: profileError } = await this.admin.from('profiles').insert(profileInsert(id, input.displayName, input.normalized))
    if (profileError) {
      await this.admin.auth.admin.deleteUser(id)
      return duplicate(profileError) ? 'taken' : 'failed'
    }
    if (input.pendingEmail || input.codeHash) {
      const { error: recoveryError } = await this.admin.from('account_recovery').insert({
        player_id: id,
        pending_email: input.pendingEmail,
        code_hash: input.codeHash,
        code_purpose: input.codePurpose,
        code_expires_at: input.codeExpiresAt,
        code_attempts: 0,
      })
      if (recoveryError) {
        await this.admin.auth.admin.deleteUser(id)
        return 'failed'
      }
    }
    const signed = await this.signIn(input.normalized, input.password, input.captchaToken)
    if (signed === 'captcha') {
      await this.admin.auth.admin.deleteUser(id)
      return 'captcha'
    }
    if (!signed) {
      await this.admin.auth.admin.deleteUser(id)
      return 'failed'
    }
    return signed
  }

  async checkPassword(playerId: string, password: string, captchaToken?: string): Promise<boolean | 'captcha'> {
    const profile = await this.profileById(playerId)
    if (!profile) return false
    const signed = await this.signIn(profile.normalized, password, captchaToken)
    if (signed === 'captcha') return 'captcha'
    if (!signed) return false
    await this.revoke(playerId, 'local', signed.session.access_token)
    return true
  }

  async setPassword(playerId: string, password: string): Promise<boolean> {
    const { error } = await this.admin.auth.admin.updateUserById(playerId, { password })
    return !error
  }

  async revoke(playerId: string, scope: 'global' | 'others' | 'local', accessToken?: string): Promise<void> {
    if (accessToken) await this.admin.auth.admin.signOut(accessToken, scope)
    if (scope !== 'global') return
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${playerId}/sessions`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey },
    })
  }

  async playerIdFromAccessToken(token: string): Promise<string | null> {
    const { data, error } = await this.admin.auth.getUser(token)
    if (error || !data.user) return null
    return data.user.id
  }

  async refresh(refreshToken: string): Promise<PasswordSignIn> {
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
      if (error || !data.session || !data.user) return null
      return { playerId: data.user.id, session: toSession(data.session) }
    } catch {
      return null
    }
  }

  async saveDevice(input: Parameters<AuthBackend['saveDevice']>[0]): Promise<void> {
    await this.admin.from('auth_devices').upsert(
      {
        player_id: input.playerId,
        session_id: input.sessionId,
        ua_hash: input.uaHash,
        stay_signed_in: input.stay,
        absolute_until: input.absoluteUntil,
        created_at: input.createdAt,
        last_seen_at: input.seenAt,
      },
      { onConflict: 'session_id' },
    )
  }

  async getDevice(sessionId: string): Promise<DeviceRecord | null> {
    const { data, error } = await this.admin
      .from('auth_devices')
      .select('player_id, session_id, ua_hash, stay_signed_in, created_at, last_seen_at, absolute_until')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (error || !data) return null
    const row = data as Row
    return {
      playerId: String(row.player_id),
      sessionId: String(row.session_id),
      uaHash: String(row.ua_hash),
      stay: row.stay_signed_in !== false,
      createdAt: Date.parse(String(row.created_at)),
      lastSeenAt: Date.parse(String(row.last_seen_at)),
      absoluteUntil: Date.parse(String(row.absolute_until)),
    }
  }

  async touchDevice(sessionId: string, seenAt: string): Promise<void> {
    await this.admin.from('auth_devices').update({ last_seen_at: seenAt }).eq('session_id', sessionId)
  }

  async getLimit(action: string, subject: string): Promise<LimitRow> {
    const { data, error } = await this.admin
      .from('auth_rate_limits')
      .select('hits, failures, locked_until, lock_step')
      .eq('action', action)
      .eq('subject', subject)
      .maybeSingle()
    if (error || !data) return emptyLimit()
    const row = data as Row
    return {
      hits: times(row.hits),
      failures: times(row.failures),
      lockedUntil: row.locked_until ? Date.parse(String(row.locked_until)) : null,
      lockStep: Number(row.lock_step ?? 0),
    }
  }

  async putLimit(action: string, subject: string, row: LimitRow): Promise<void> {
    await this.admin.from('auth_rate_limits').upsert({
      action,
      subject,
      hits: row.hits.map((time) => new Date(time).toISOString()),
      failures: row.failures.map((time) => new Date(time).toISOString()),
      locked_until: row.lockedUntil ? new Date(row.lockedUntil).toISOString() : null,
      lock_step: row.lockStep,
    })
  }

  async getRecovery(playerId: string): Promise<RecoveryRecord | null> {
    const { data, error } = await this.admin.from('account_recovery').select('*').eq('player_id', playerId).maybeSingle()
    if (error || !data) return null
    return recoveryFrom(data as Row)
  }

  async saveRecovery(row: RecoveryRecord): Promise<void> {
    await this.admin.from('account_recovery').upsert({
      player_id: row.playerId,
      recovery_email: row.recoveryEmail,
      email_verified_at: row.emailVerifiedAt,
      pending_email: row.pendingEmail,
      code_hash: row.codeHash,
      code_purpose: row.codePurpose,
      code_expires_at: row.codeExpiresAt ? new Date(row.codeExpiresAt).toISOString() : null,
      code_attempts: row.codeAttempts,
      code_burned_at: row.codeBurned ? new Date().toISOString() : null,
    })
  }

  async findRecoveryByEmail(email: string): Promise<string[]> {
    const normalized = email.trim().toLowerCase()
    const ids = new Set<string>()
    const verified = await this.admin
      .from('account_recovery')
      .select('player_id, email_verified_at')
      .eq('recovery_email', normalized)
    if (!verified.error && Array.isArray(verified.data)) {
      for (const row of verified.data as Row[]) {
        if (row.email_verified_at) ids.add(String(row.player_id))
      }
    }
    const pending = await this.admin.from('account_recovery').select('player_id').eq('pending_email', normalized)
    if (!pending.error && Array.isArray(pending.data)) {
      for (const row of pending.data as Row[]) ids.add(String(row.player_id))
    }
    return [...ids]
  }

  async findPlayersByCodeHash(codeHash: string): Promise<string[]> {
    const { data, error } = await this.admin.from('account_recovery').select('player_id').eq('code_hash', codeHash)
    if (error || !Array.isArray(data)) return []
    return (data as Row[]).map((row) => String(row.player_id))
  }

  async findCard(hash: string): Promise<string | null> {
    const { data, error } = await this.admin
      .from('recovery_cards')
      .select('player_id')
      .eq('code_hash', hash)
      .is('used_at', null)
      .maybeSingle()
    if (error || !data) return null
    return String((data as Row).player_id)
  }

  async consumeCard(hash: string, usedAt: string): Promise<string | null> {
    const { data, error } = await this.admin
      .from('recovery_cards')
      .update({ used_at: usedAt })
      .eq('code_hash', hash)
      .is('used_at', null)
      .select('player_id')
    if (error || !Array.isArray(data) || data.length === 0) return null
    return String((data[0] as Row).player_id)
  }

  async replaceCard(playerId: string, hash: string, usedAt: string): Promise<void> {
    await this.admin.from('recovery_cards').update({ used_at: usedAt }).eq('player_id', playerId).is('used_at', null)
    const { error } = await this.admin.from('recovery_cards').insert({ player_id: playerId, code_hash: hash })
    if (error) throw new Error('card')
  }

  async activeParent(parentId: string, childId: string): Promise<boolean> {
    const { data, error } = await this.admin
      .from('parent_links')
      .select('id')
      .eq('parent_id', parentId)
      .eq('child_id', childId)
      .eq('status', 'active')
      .limit(1)
    return !error && Array.isArray(data) && data.length > 0
  }

  async consumeReauth(playerId: string, token: string, now: number): Promise<boolean> {
    return consumeReauth(this.admin, playerId, token, now)
  }

  async audit(row: Parameters<AuthBackend['audit']>[0]): Promise<void> {
    await this.admin.from('audit_events').insert({
      event_type: row.eventType,
      actor: row.actor,
      subject: row.subject,
      ip_hash: row.ipHash,
      metadata: scrubMetadata(row.metadata),
      created_at: row.createdAt,
    })
  }

  async getFlags(userId: string): Promise<AccountFlags> {
    const { data, error } = await this.admin.from('account_flags').select('*').eq('user_id', userId).maybeSingle()
    if (error || !data) return emptyAccountFlags()
    return flagsFrom(data as Row)
  }

  async saveFlags(userId: string, flags: AccountFlags, updatedAt: string): Promise<void> {
    await this.admin.from('account_flags').upsert({
      user_id: userId,
      age_confirmed_at: flags.ageConfirmedAt,
      terms_accepted_at: flags.termsAcceptedAt,
      terms_version: flags.termsVersion,
      marketing_opt_in: flags.marketingOptIn,
      marketing_answered_at: flags.marketingAnsweredAt,
      auto_named: flags.autoNamed,
      updated_at: updatedAt,
    })
  }

  async getAgeChoice(userId: string): Promise<AgeChoice | null> {
    const { data, error } = await this.admin.from('age_choices').select('choice').eq('user_id', userId).maybeSingle()
    if (error || !data) return null
    const choice = (data as Row).choice
    return choice === '13_plus' || choice === 'under_13' ? choice : null
  }

  async saveAgeChoice(userId: string, choice: AgeChoice, at: string): Promise<'ok' | 'locked'> {
    const current = await this.getAgeChoice(userId)
    if (current && current !== choice) return 'locked'
    if (current === choice) return 'ok'
    const { error } = await this.admin.from('age_choices').insert({ user_id: userId, choice, chosen_at: at })
    return error ? 'locked' : 'ok'
  }

  async holdParentEmail(input: { childId: string; email: string; tokenHash: string; expiresAt: string }): Promise<void> {
    await this.admin
      .from('parent_email_holds')
      .delete()
      .eq('child_id', input.childId)
      .is('approved_at', null)
    const { error } = await this.admin.from('parent_email_holds').insert({
      child_id: input.childId,
      parent_email: input.email,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
    })
    if (error) throw new Error('hold')
  }

  async approveParentEmail(tokenHash: string, at: string): Promise<{ childId: string; email: string } | null> {
    const { data, error } = await this.admin
      .from('parent_email_holds')
      .select('child_id, parent_email, expires_at, approved_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error || !data) return null
    const row = data as Row
    const childId = String(row.child_id)
    const email = String(row.parent_email)
    if (!row.approved_at && Date.parse(String(row.expires_at)) <= Date.parse(at)) return null
    if (!row.approved_at) {
      await this.admin.from('parent_email_holds').update({ approved_at: at }).eq('token_hash', tokenHash)
    }
    const existing = await this.getRecovery(childId)
    await this.saveRecovery({
      playerId: childId,
      recoveryEmail: email,
      emailVerifiedAt: row.approved_at ? String(row.approved_at) : at,
      pendingEmail: null,
      codeHash: null,
      codePurpose: null,
      codeExpiresAt: null,
      codeAttempts: existing?.codeAttempts ?? 0,
      codeBurned: false,
    })
    return { childId, email }
  }

  async listKids(parentId: string): Promise<{ userId: string; displayName: string }[]> {
    const { data, error } = await this.admin
      .from('parent_links')
      .select('child_id')
      .eq('parent_id', parentId)
      .eq('status', 'active')
    if (error || !Array.isArray(data)) return []
    const kids: { userId: string; displayName: string }[] = []
    for (const row of data as Row[]) {
      const userId = String(row.child_id)
      const profile = await this.profileById(userId)
      kids.push({ userId, displayName: profile?.displayName ?? '' })
    }
    return kids
  }

  async linkKidsByEmail(parentId: string, email: string): Promise<number> {
    const normalized = email.trim().toLowerCase()
    const { data, error } = await this.admin
      .from('account_recovery')
      .select('player_id, email_verified_at')
      .eq('recovery_email', normalized)
    if (error || !Array.isArray(data)) return 0
    let linked = 0
    const until = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    for (const row of data as Row[]) {
      const childId = String(row.player_id)
      if (childId === parentId || !row.email_verified_at) continue
      if (await this.activeParent(parentId, childId)) continue
      const { count } = await this.admin
        .from('parent_links')
        .select('id', { count: 'exact', head: true })
        .eq('child_id', childId)
        .in('status', ['pending', 'active'])
      if ((count ?? 0) >= 2) continue
      const { error: insertError } = await this.admin.from('parent_links').insert({
        child_id: childId,
        parent_id: parentId,
        token_hash: hashSecret(newSecret(16)),
        status: 'active',
        invite_until: until,
        accepted_at: new Date().toISOString(),
      })
      if (!insertError) linked += 1
    }
    return linked
  }

  async revokeKid(parentId: string, childId: string): Promise<boolean> {
    const { data, error } = await this.admin
      .from('parent_links')
      .update({ status: 'revoked' })
      .eq('parent_id', parentId)
      .eq('child_id', childId)
      .eq('status', 'active')
      .select('id')
    return !error && Array.isArray(data) && data.length > 0
  }

  async setOwner(
    userId: string,
    owner: { ownerRole: 'adult' | null; ownerAssumedAt: string | null; ownerEmail: string | null },
  ): Promise<void> {
    const fields = {
      owner_role: owner.ownerRole,
      owner_assumed_at: owner.ownerAssumedAt,
      owner_email: owner.ownerEmail,
      updated_at: new Date().toISOString(),
    }
    const { data } = await this.admin.from('account_flags').select('user_id').eq('user_id', userId).maybeSingle()
    if (data) {
      const { error } = await this.admin.from('account_flags').update(fields).eq('user_id', userId)
      if (error) throw new Error('owner')
      return
    }
    const { error } = await this.admin.from('account_flags').insert({ user_id: userId, ...fields })
    if (error) throw new Error('owner')
  }

  private async withBan(row: Row): Promise<ProfileRecord> {
    const playerId = String(row.player_id)
    const { data } = await this.admin.from('account_status').select('banned').eq('player_id', playerId).maybeSingle()
    return {
      playerId,
      displayName: String(row.display_name),
      normalized: String(row.name_normalized),
      banned: (data as Row | null)?.banned === true,
    }
  }
}

function toSession(session: { access_token: string; refresh_token: string; expires_in?: number }): SessionPair {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in ?? 3600,
    token_type: 'bearer',
  }
}

function times(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => Date.parse(String(item))).filter((time) => !Number.isNaN(time))
}

function flagsFrom(row: Row): AccountFlags {
  return {
    ageConfirmedAt: row.age_confirmed_at ? String(row.age_confirmed_at) : null,
    termsAcceptedAt: row.terms_accepted_at ? String(row.terms_accepted_at) : null,
    termsVersion: row.terms_version ? String(row.terms_version) : null,
    marketingOptIn: row.marketing_opt_in === true,
    marketingAnsweredAt: row.marketing_answered_at ? String(row.marketing_answered_at) : null,
    ownerRole: row.owner_role === 'adult' ? 'adult' : null,
    ownerAssumedAt: row.owner_assumed_at ? String(row.owner_assumed_at) : null,
    ownerEmail: row.owner_email ? String(row.owner_email) : null,
    autoNamed: row.auto_named === true,
  }
}

function recoveryFrom(row: Row): RecoveryRecord {
  const purpose = row.code_purpose === 'verify' || row.code_purpose === 'reset' ? row.code_purpose : null
  return {
    playerId: String(row.player_id),
    recoveryEmail: row.recovery_email ? String(row.recovery_email) : null,
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    pendingEmail: row.pending_email ? String(row.pending_email) : null,
    codeHash: row.code_hash ? String(row.code_hash) : null,
    codePurpose: purpose,
    codeExpiresAt: row.code_expires_at ? Date.parse(String(row.code_expires_at)) : null,
    codeAttempts: Number(row.code_attempts ?? 0),
    codeBurned: row.code_burned_at != null,
  }
}

function errorParts(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== 'object') return { code: '', message: '' }
  const row = error as { code?: unknown; message?: unknown }
  return {
    code: typeof row.code === 'string' ? row.code : '',
    message: typeof row.message === 'string' ? row.message : '',
  }
}

function isCaptchaError(error: unknown): boolean {
  const part = errorParts(error)
  return `${part.code} ${part.message}`.toLowerCase().includes('captcha')
}

function duplicate(error: unknown): boolean {
  const part = errorParts(error)
  if (part.code === '23505') return true
  const message = part.message.toLowerCase()
  return message.includes('already') || message.includes('duplicate') || message.includes('registered')
}
