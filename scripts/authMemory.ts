import { randomUUID } from 'node:crypto'
import { emptyLimit, type LimitRow } from '../netlify/lib/authLimits.ts'
import type {
  AuditRow,
  AuthBackend,
  CreateAccountInput,
  PasswordSignIn,
  ProfileRecord,
  RecoveryRecord,
  SessionPair,
} from '../netlify/lib/authTypes.ts'

type CardRow = { hash: string; playerId: string; usedAt: string | null }

/** In-memory AuthBackend for tests. Not shipped in a Netlify function. */
export class MemoryAuth implements AuthBackend {
  profiles = new Map<string, ProfileRecord>()
  byId = new Map<string, ProfileRecord>()
  passwords = new Map<string, string>()
  limits = new Map<string, LimitRow>()
  recovery = new Map<string, RecoveryRecord>()
  cards: CardRow[] = []
  parents = new Set<string>()
  reauths = new Set<string>()
  audits: AuditRow[] = []
  devices: { playerId: string; uaHash: string; stay: boolean; absoluteUntil: string }[] = []
  revokes: { playerId: string; scope: 'global' | 'others' | 'local'; accessToken?: string }[] = []
  tokens = new Map<string, string>()
  captchaUses: { where: string; token?: string }[] = []
  failCaptcha = false
  private seq = 0

  addCard(playerId: string, hash: string): void {
    this.cards.push({ hash, playerId, usedAt: null })
  }

  private session(playerId: string): SessionPair {
    this.seq += 1
    const access = `access-${playerId}-${this.seq}`
    this.tokens.set(access, playerId)
    return {
      access_token: access,
      refresh_token: `refresh-${playerId}-${this.seq}`,
      expires_in: 3600,
      token_type: 'bearer',
    }
  }

  async lookupName(normalized: string): Promise<ProfileRecord | null> {
    return this.profiles.get(normalized) ?? null
  }

  async profileById(playerId: string): Promise<ProfileRecord | null> {
    return this.byId.get(playerId) ?? null
  }

  async signIn(normalized: string, password: string, captchaToken?: string): Promise<PasswordSignIn> {
    this.captchaUses.push({ where: 'signIn', token: captchaToken })
    if (this.failCaptcha) return 'captcha'
    const profile = this.profiles.get(normalized)
    if (!profile || this.passwords.get(normalized) !== password) return null
    return { playerId: profile.playerId, session: this.session(profile.playerId) }
  }

  async createAccount(input: CreateAccountInput): Promise<{ playerId: string; session: SessionPair } | 'taken' | 'failed' | 'captcha'> {
    this.captchaUses.push({ where: 'create', token: input.captchaToken })
    if (this.profiles.has(input.normalized)) return 'taken'
    const playerId = randomUUID()
    const profile: ProfileRecord = {
      playerId,
      displayName: input.displayName,
      normalized: input.normalized,
      banned: false,
    }
    this.profiles.set(input.normalized, profile)
    this.byId.set(playerId, profile)
    this.passwords.set(input.normalized, input.password)
    if (input.pendingEmail || input.codeHash) {
      this.recovery.set(playerId, {
        playerId,
        recoveryEmail: null,
        emailVerifiedAt: null,
        pendingEmail: input.pendingEmail,
        codeHash: input.codeHash,
        codePurpose: input.codePurpose,
        codeExpiresAt: input.codeExpiresAt ? Date.parse(input.codeExpiresAt) : null,
        codeAttempts: 0,
        codeBurned: false,
      })
    }
    const signed = await this.signIn(input.normalized, input.password, input.captchaToken)
    if (signed === 'captcha' || !signed) {
      this.profiles.delete(input.normalized)
      this.byId.delete(playerId)
      this.passwords.delete(input.normalized)
      this.recovery.delete(playerId)
      return signed === 'captcha' ? 'captcha' : 'failed'
    }
    return signed
  }

  async checkPassword(playerId: string, password: string, captchaToken?: string): Promise<boolean | 'captcha'> {
    const profile = this.byId.get(playerId)
    if (!profile) return false
    const signed = await this.signIn(profile.normalized, password, captchaToken)
    if (signed === 'captcha') return 'captcha'
    if (!signed) return false
    await this.revoke(playerId, 'local', signed.session.access_token)
    return true
  }

  async setPassword(playerId: string, password: string): Promise<boolean> {
    const profile = this.byId.get(playerId)
    if (!profile) return false
    this.passwords.set(profile.normalized, password)
    return true
  }

  async revoke(playerId: string, scope: 'global' | 'others' | 'local', accessToken?: string): Promise<void> {
    this.revokes.push({ playerId, scope, accessToken })
    if (scope === 'local' && accessToken) this.tokens.delete(accessToken)
    if (scope === 'global') {
      for (const [token, id] of this.tokens) if (id === playerId) this.tokens.delete(token)
    }
  }

  async playerIdFromAccessToken(token: string): Promise<string | null> {
    return this.tokens.get(token) ?? null
  }

  async saveDevice(input: { playerId: string; uaHash: string; stay: boolean; absoluteUntil: string; seenAt: string }): Promise<void> {
    this.devices.push({
      playerId: input.playerId,
      uaHash: input.uaHash,
      stay: input.stay,
      absoluteUntil: input.absoluteUntil,
    })
  }

  async getLimit(action: string, subject: string): Promise<LimitRow> {
    const row = this.limits.get(`${action}:${subject}`)
    return row ? structuredClone(row) : emptyLimit()
  }

  async putLimit(action: string, subject: string, row: LimitRow): Promise<void> {
    this.limits.set(`${action}:${subject}`, structuredClone(row))
  }

  async getRecovery(playerId: string): Promise<RecoveryRecord | null> {
    const row = this.recovery.get(playerId)
    return row ? structuredClone(row) : null
  }

  async saveRecovery(row: RecoveryRecord): Promise<void> {
    this.recovery.set(row.playerId, structuredClone(row))
  }

  async findCard(hash: string): Promise<string | null> {
    const card = this.cards.find((row) => row.hash === hash && row.usedAt == null)
    return card?.playerId ?? null
  }

  async consumeCard(hash: string, usedAt: string): Promise<string | null> {
    const card = this.cards.find((row) => row.hash === hash && row.usedAt == null)
    if (!card) return null
    card.usedAt = usedAt
    return card.playerId
  }

  async replaceCard(playerId: string, hash: string, usedAt: string): Promise<void> {
    if (this.cards.some((row) => row.hash === hash)) throw new Error('card')
    for (const row of this.cards) {
      if (row.playerId === playerId && row.usedAt == null) row.usedAt = usedAt
    }
    this.cards.push({ hash, playerId, usedAt: null })
  }

  async activeParent(parentId: string, childId: string): Promise<boolean> {
    return this.parents.has(`${parentId}:${childId}`)
  }

  async consumeReauth(playerId: string, token: string, _now: number): Promise<boolean> {
    const key = `${playerId}:${token}`
    if (!this.reauths.has(key)) return false
    this.reauths.delete(key)
    return true
  }

  async audit(row: AuditRow): Promise<void> {
    this.audits.push(structuredClone(row))
  }
}
