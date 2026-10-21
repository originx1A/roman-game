import type { SupabaseClient } from '@supabase/supabase-js'
import { consumeReauth } from './reauth.ts'
import { loginEmail } from './authCrypto.ts'
import { emptyLimit, type LimitRow } from './authLimits.ts'
import { SUPABASE_URL, supabaseAdmin } from './supabaseAdmin.ts'
import { playerInsert, profileInsert, type AuthBackend, type PasswordSignIn, type ProfileRecord, type RecoveryRecord, type SessionPair } from './authTypes.ts'
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

  async saveDevice(input: { playerId: string; uaHash: string; stay: boolean; absoluteUntil: string; seenAt: string }): Promise<void> {
    await this.admin.from('auth_devices').upsert(
      {
        player_id: input.playerId,
        ua_hash: input.uaHash,
        stay_signed_in: input.stay,
        absolute_until: input.absoluteUntil,
        last_seen: input.seenAt,
      },
      { onConflict: 'player_id,ua_hash' },
    )
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
