import type { LimitRow } from './authLimits.ts'

export type SessionPair = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: 'bearer'
}

export type ProfileRecord = {
  playerId: string
  displayName: string
  normalized: string
  banned: boolean
}

export type RecoveryPurpose = 'verify' | 'reset'

export type RecoveryRecord = {
  playerId: string
  recoveryEmail: string | null
  emailVerifiedAt: string | null
  pendingEmail: string | null
  codeHash: string | null
  codePurpose: RecoveryPurpose | null
  codeExpiresAt: number | null
  codeAttempts: number
  codeBurned: boolean
}

export type AuditRow = {
  eventType: string
  actor: string | null
  subject: string | null
  ipHash: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type CreateAccountInput = {
  normalized: string
  displayName: string
  publicName: string
  password: string
  pendingEmail: string | null
  codeHash: string | null
  codePurpose: RecoveryPurpose | null
  codeExpiresAt: string | null
  /** Forwarded to Supabase as options.captchaToken. Supabase Attack Protection checks it. */
  captchaToken?: string
}

export type PasswordSignIn = { playerId: string; session: SessionPair } | 'captcha' | null

/** One row per Supabase session. createdAt starts at sign-in. lastSeenAt moves on refresh and /api/auth use. */
export type DeviceRecord = {
  playerId: string
  sessionId: string
  uaHash: string
  stay: boolean
  createdAt: number
  lastSeenAt: number
  absoluteUntil: number
}

export type DeviceWrite = {
  playerId: string
  sessionId: string
  uaHash: string
  stay: boolean
  absoluteUntil: string
  createdAt: string
  seenAt: string
}

export interface AuthBackend {
  lookupName(normalized: string): Promise<ProfileRecord | null>
  profileById(playerId: string): Promise<ProfileRecord | null>
  signIn(normalized: string, password: string, captchaToken?: string): Promise<PasswordSignIn>
  createAccount(input: CreateAccountInput): Promise<{ playerId: string; session: SessionPair } | 'taken' | 'failed' | 'captcha'>
  checkPassword(playerId: string, password: string, captchaToken?: string): Promise<boolean | 'captcha'>
  setPassword(playerId: string, password: string): Promise<boolean>
  revoke(playerId: string, scope: 'global' | 'others' | 'local', accessToken?: string): Promise<void>
  playerIdFromAccessToken(token: string): Promise<string | null>
  refresh(refreshToken: string): Promise<PasswordSignIn>
  saveDevice(input: DeviceWrite): Promise<void>
  getDevice(sessionId: string): Promise<DeviceRecord | null>
  touchDevice(sessionId: string, seenAt: string): Promise<void>
  getLimit(action: string, subject: string): Promise<LimitRow>
  putLimit(action: string, subject: string, row: LimitRow): Promise<void>
  getRecovery(playerId: string): Promise<RecoveryRecord | null>
  saveRecovery(row: RecoveryRecord): Promise<void>
  findCard(hash: string): Promise<string | null>
  consumeCard(hash: string, usedAt: string): Promise<string | null>
  replaceCard(playerId: string, hash: string, usedAt: string): Promise<void>
  activeParent(parentId: string, childId: string): Promise<boolean>
  consumeReauth(playerId: string, token: string, now: number): Promise<boolean>
  audit(row: AuditRow): Promise<void>
}

/** The players insert written at signup. Age and account type are not fields. */
export function playerInsert(id: string, publicName: string): { id: string; display_name: string } {
  return { id, display_name: publicName }
}

/** Full chosen name plus the unique login key. account_type is not stored here. */
export function profileInsert(
  id: string,
  displayName: string,
  normalized: string,
): { player_id: string; display_name: string; name_normalized: string } {
  return { player_id: id, display_name: displayName, name_normalized: normalized }
}
