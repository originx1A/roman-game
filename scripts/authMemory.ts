import { randomUUID } from 'node:crypto'
import { emptyAccountFlags, type AccountFlags } from '../netlify/lib/accountFlags.ts'
import type { AgeChoice } from '../netlify/lib/ageChoice.ts'
import { emptyLimit, type LimitRow } from '../netlify/lib/authLimits.ts'
import { accessTokenForSession } from '../netlify/lib/sessionClock.ts'
import type {
  AuditRow,
  AuthBackend,
  CreateAccountInput,
  DeviceRecord,
  DeviceWrite,
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
  devices = new Map<string, DeviceRecord>()
  flags = new Map<string, AccountFlags>()
  ages = new Map<string, AgeChoice>()
  holds: { childId: string; email: string; tokenHash: string; expiresAt: string; approvedAt: string | null }[] = []
  links: { parentId: string; childId: string; status: 'active' | 'revoked' }[] = []
  revokes: { playerId: string; scope: 'global' | 'others' | 'local'; accessToken?: string }[] = []
  tokens = new Map<string, string>()
  refreshIndex = new Map<string, { playerId: string; sessionId: string }>()
  captchaUses: { where: string; token?: string }[] = []
  failCaptcha = false
  private seq = 0

  addCard(playerId: string, hash: string): void {
    this.cards.push({ hash, playerId, usedAt: null })
  }

  private session(playerId: string, sessionId = randomUUID()): SessionPair {
    this.seq += 1
    const access = accessTokenForSession(sessionId, playerId)
    const refresh = `refresh.${sessionId}.${this.seq}`
    this.tokens.set(access, playerId)
    this.refreshIndex.set(refresh, { playerId, sessionId })
    return {
      access_token: access,
      refresh_token: refresh,
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

  async renameAccount(playerId: string, displayName: string, normalized: string, publicName: string): Promise<'ok' | 'taken' | 'failed'> {
    const existing = this.profiles.get(normalized)
    if (existing && existing.playerId !== playerId) return 'taken'
    const profile = this.byId.get(playerId)
    if (!profile) return 'failed'
    if (publicName.includes('@') || displayName.includes('@')) return 'failed'
    const password = this.passwords.get(profile.normalized)
    this.profiles.delete(profile.normalized)
    this.passwords.delete(profile.normalized)
    profile.displayName = displayName
    profile.normalized = normalized
    this.profiles.set(normalized, profile)
    if (password != null) this.passwords.set(normalized, password)
    return 'ok'
  }

  async isLinkedChild(playerId: string): Promise<boolean> {
    for (const key of this.parents) {
      const child = key.split(':')[1]
      if (child === playerId) return true
    }
    return this.links.some((link) => link.childId === playerId && link.status === 'active')
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

  async refresh(refreshToken: string): Promise<PasswordSignIn> {
    const found = this.refreshIndex.get(refreshToken)
    if (!found) return null
    this.refreshIndex.delete(refreshToken)
    return { playerId: found.playerId, session: this.session(found.playerId, found.sessionId) }
  }

  async saveDevice(input: DeviceWrite): Promise<void> {
    this.devices.set(input.sessionId, {
      playerId: input.playerId,
      sessionId: input.sessionId,
      uaHash: input.uaHash,
      stay: input.stay,
      createdAt: Date.parse(input.createdAt),
      lastSeenAt: Date.parse(input.seenAt),
      absoluteUntil: Date.parse(input.absoluteUntil),
    })
  }

  async getDevice(sessionId: string): Promise<DeviceRecord | null> {
    const row = this.devices.get(sessionId)
    return row ? structuredClone(row) : null
  }

  async touchDevice(sessionId: string, seenAt: string): Promise<void> {
    const row = this.devices.get(sessionId)
    if (!row) return
    row.lastSeenAt = Date.parse(seenAt)
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

  async findRecoveryByEmail(email: string): Promise<string[]> {
    const normalized = email.trim().toLowerCase()
    const ids: string[] = []
    for (const row of this.recovery.values()) {
      const verified = row.recoveryEmail === normalized && row.emailVerifiedAt != null
      const pending = row.pendingEmail === normalized
      if (verified || pending) ids.push(row.playerId)
    }
    return ids
  }

  async findPlayersByCodeHash(codeHash: string): Promise<string[]> {
    const ids: string[] = []
    for (const row of this.recovery.values()) {
      if (row.codeHash === codeHash) ids.push(row.playerId)
    }
    return ids
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
    if (this.parents.has(`${parentId}:${childId}`)) return true
    return this.links.some((link) => link.parentId === parentId && link.childId === childId && link.status === 'active')
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

  async getFlags(userId: string): Promise<AccountFlags> {
    return structuredClone(this.flags.get(userId) ?? emptyAccountFlags())
  }

  async saveFlags(userId: string, flags: AccountFlags, _updatedAt: string): Promise<void> {
    this.flags.set(userId, structuredClone(flags))
  }

  async getAgeChoice(userId: string): Promise<AgeChoice | null> {
    return this.ages.get(userId) ?? null
  }

  async saveAgeChoice(userId: string, choice: AgeChoice, _at: string): Promise<'ok' | 'locked'> {
    const current = this.ages.get(userId)
    if (current && current !== choice) return 'locked'
    this.ages.set(userId, choice)
    return 'ok'
  }

  async holdParentEmail(input: { childId: string; email: string; tokenHash: string; expiresAt: string }): Promise<void> {
    this.holds = this.holds.filter((hold) => hold.childId !== input.childId || hold.approvedAt)
    this.holds.push({ ...input, approvedAt: null })
  }

  async approveParentEmail(tokenHash: string, at: string): Promise<{ childId: string; email: string } | null> {
    const hold = this.holds.find((row) => row.tokenHash === tokenHash)
    if (!hold) return null
    if (!hold.approvedAt && Date.parse(hold.expiresAt) <= Date.parse(at)) return null
    if (!hold.approvedAt) hold.approvedAt = at
    const current = this.recovery.get(hold.childId)
    this.recovery.set(hold.childId, {
      playerId: hold.childId,
      recoveryEmail: hold.email,
      emailVerifiedAt: hold.approvedAt,
      pendingEmail: null,
      codeHash: null,
      codePurpose: null,
      codeExpiresAt: null,
      codeAttempts: current?.codeAttempts ?? 0,
      codeBurned: false,
    })
    return { childId: hold.childId, email: hold.email }
  }

  async listKids(parentId: string): Promise<{ userId: string; displayName: string }[]> {
    const ids = new Set<string>()
    for (const key of this.parents) {
      const [parent, child] = key.split(':')
      if (parent === parentId && child) ids.add(child)
    }
    for (const link of this.links) {
      if (link.parentId === parentId && link.status === 'active') ids.add(link.childId)
    }
    return [...ids].map((userId) => ({ userId, displayName: this.byId.get(userId)?.displayName ?? '' }))
  }

  async linkKidsByEmail(parentId: string, email: string): Promise<number> {
    const normalized = email.trim().toLowerCase()
    let linked = 0
    for (const row of this.recovery.values()) {
      if (row.playerId === parentId) continue
      if (row.recoveryEmail !== normalized || !row.emailVerifiedAt) continue
      if (await this.activeParent(parentId, row.playerId)) continue
      if (this.parentSlots(row.playerId) >= 2) continue
      this.parents.add(`${parentId}:${row.playerId}`)
      this.links.push({ parentId, childId: row.playerId, status: 'active' })
      linked += 1
    }
    return linked
  }

  async revokeKid(parentId: string, childId: string): Promise<boolean> {
    const key = `${parentId}:${childId}`
    const had = this.parents.has(key) || this.links.some((link) => link.parentId === parentId && link.childId === childId && link.status === 'active')
    this.parents.delete(key)
    for (const link of this.links) {
      if (link.parentId === parentId && link.childId === childId && link.status === 'active') link.status = 'revoked'
    }
    return had
  }

  async setOwner(
    userId: string,
    owner: { ownerRole: 'adult' | null; ownerAssumedAt: string | null; ownerEmail: string | null },
  ): Promise<void> {
    const current = await this.getFlags(userId)
    current.ownerRole = owner.ownerRole
    current.ownerAssumedAt = owner.ownerAssumedAt
    current.ownerEmail = owner.ownerEmail
    this.flags.set(userId, current)
  }

  private parentSlots(childId: string): number {
    const ids = new Set<string>()
    for (const key of this.parents) {
      const [parent, child] = key.split(':')
      if (child === childId && parent) ids.add(parent)
    }
    for (const link of this.links) {
      if (link.childId === childId && link.status === 'active') ids.add(link.parentId)
    }
    return ids.size
  }
}
