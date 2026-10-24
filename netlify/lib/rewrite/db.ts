import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { RESET_MINUTES, TERMS_VERSION } from '../../../src/game/catalog.ts'
import { throneForBoards, winMap } from '../../../src/game/thrones.ts'
import { torontoDate } from '../../../src/game/generate.ts'
import type { Mail } from './mail.ts'
import type { Account, Approval, Challenge, Order, Team } from './server.ts'

export class MissingKey extends Error {
  constructor() {
    super('supabase-key')
    this.name = 'MissingKey'
  }
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaError'
  }
}

export class TakenError extends Error {
  constructor() {
    super('taken')
    this.name = 'TakenError'
  }
}

export interface Env {
  RESEND_API_KEY?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  RG_DEV_MAILBOX?: string
  RG_STORE_FILE?: string
  CONTEXT?: string
  URL?: string
  DEPLOY_PRIME_URL?: string
  NETLIFY?: string
  country?: string | null
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

const PROJECT = 'oelsglmfkpzbueqysvdm'
const DEFAULT_URL = `https://${PROJECT}.supabase.co`
const MAILBOX = '/tmp/rg-mailbox.json'
/** Rate and mail-day counters when the service role key is not set yet. */
const memoryPayload = new Map<string, unknown>()

interface State {
  authEmail?: string
  wins?: number
  winsByBoard?: Record<string, number>
  perfects?: number
  starterOwned?: boolean
  pets?: string[]
  clothes?: string[]
  hostPet?: string | null
  charges?: Record<string, number>
  hearts?: number
  bestRun?: Record<string, number>
  streakDay?: string | null
  streak?: number
  dailyWin?: string | null
  dailySeconds?: number | null
  weekKey?: string
  weekWins?: number
  teamId?: string | null
  language?: 'en' | 'fr' | null
  lastPlayed?: string | null
  deleteAfter?: string | null
  solved?: string[]
  failedSignins?: number
  lockedUntil?: string | null
  purchaseAccepts?: { sku: string; at: string; version: string }[]
  sessions?: string[]
  resetToken?: string | null
  verifyToken?: string | null
  resetFresh?: boolean
  termsVersion?: string
  termsAt?: string
  createdAt?: string
}

export interface BoardResult {
  rows: { id: string; name: string; score: number; throne: number }[]
  friends?: { id: string; name: string }[]
  incoming?: { id: string; name: string }[]
  outgoing?: { id: string; name: string }[]
  inbox?: InboxRow[]
}

export interface InboxRow {
  id: number
  kind: string
  from_id: string | null
  from_name: string
  body: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface Social {
  friends: { id: string; name: string }[]
  incoming: { id: string; name: string }[]
  outgoing: { id: string; name: string }[]
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function weekStart(now = new Date()): number {
  const day = torontoDate(now)
  const date = new Date(`${day}T12:00:00Z`)
  const utc = date.getUTCDay()
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - ((utc + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)
  return monday.getTime()
}

export class Store {
  private url: string
  private key: string

  constructor(env: Env) {
    this.url = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '')
    this.key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  }

  async status(): Promise<{ key: boolean; schema: boolean; project: string; accounts: 'supabase' }> {
    if (!this.key) return { key: false, schema: false, project: PROJECT, accounts: 'supabase' }
    try {
      await this.rest('rg_orders?select=id&limit=1')
      await this.rest('game_groups?select=invite_code&limit=1')
      await this.rest('account_flags?select=buying_stopped&limit=1')
      await this.rpc('rg_auth_id_by_email', { target: '' })
      return { key: true, schema: true, project: PROJECT, accounts: 'supabase' }
    } catch {
      return { key: true, schema: false, project: PROJECT, accounts: 'supabase' }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (key === 'mailbox') return (this.readMail() as T) ?? null
    if (key === 'leaderboard' || key === 'team-board' || key === 'team-ids') return ([] as T)
    if (key.startsWith('rate:') || key.startsWith('mail-day:')) {
      if (!this.key) return (memoryPayload.get(key) as T) ?? null
      return (await this.readPayload(key)) as T | null
    }
    if (!this.key) return null
    if (key.startsWith('account:')) return (await this.load(key.slice(8))) as T | null
    if (key.startsWith('login:') || key.startsWith('email:')) return (await this.idForLogin(key.split(':').slice(1).join(':'))) as T | null
    if (key.startsWith('session:')) return (await this.readSession(key.slice(8))) as T | null
    if (key.startsWith('verify:') || key.startsWith('verify-used:')) return (await this.playerForCode(key.slice(key.indexOf(':') + 1), 'verify')) as T | null
    if (key.startsWith('reset:')) return (await this.readReset(key.slice(6))) as T | null
    if (key.startsWith('approval:')) return (await this.readApproval(key.slice(9))) as T | null
    if (key.startsWith('player-approval:')) return (await this.approvalTokenFor(key.slice(16))) as T | null
    if (key.startsWith('order:')) return (await this.readOrder(key.slice(6))) as T | null
    if (key.startsWith('stripe:')) return (await this.orderIdByStripe(key.slice(7))) as T | null
    if (key.startsWith('wasnt:')) return (await this.orderIdByWasnt(key.slice(6))) as T | null
    if (key.startsWith('challenge:')) return (await this.readChallenge(key.slice(10))) as T | null
    if (key.startsWith('team-code:')) return (await this.teamIdByCode(key.slice(10))) as T | null
    if (key.startsWith('team-name:')) return (await this.teamIdByName(key.slice(10))) as T | null
    if (key.startsWith('team:')) return (await this.readTeam(key.slice(5))) as T | null
    return null
  }

  async set(key: string, value: unknown): Promise<void> {
    if (key === 'mailbox') {
      this.writeMail(value as Mail[])
      return
    }
    if (key === 'leaderboard' || key === 'team-board' || key === 'team-ids') return
    if (key.startsWith('rate:') || key.startsWith('mail-day:')) {
      if (!this.key) {
        memoryPayload.set(key, value)
        return
      }
      return this.writePayload(key, value)
    }
    if (!this.key) throw new MissingKey()
    if (key.startsWith('account:')) return this.save(value as Account)
    if (key.startsWith('login:') || key.startsWith('email:') || key.startsWith('player-approval:')) return
    if (key.startsWith('session:')) return this.writeSession(key.slice(8), value as { accountId: string })
    if (key.startsWith('verify:') || key.startsWith('verify-used:')) return
    if (key.startsWith('reset:')) return this.writeReset(key.slice(6), value as { accountId: string; exp: number; freshCode?: boolean })
    if (key.startsWith('approval:')) return this.writeApproval(value as Approval)
    if (key.startsWith('order:')) return this.writeOrder(value as Order)
    if (key.startsWith('stripe:')) return this.bindStripe(key.slice(7), String(value))
    if (key.startsWith('wasnt:')) return this.bindWasnt(key.slice(6), String(value))
    if (key.startsWith('challenge:')) return this.writeChallenge(value as Challenge)
    if (key.startsWith('team-code:') || key.startsWith('team-name:')) return
    if (key.startsWith('team:')) return this.writeTeam(value as Team)
  }

  async del(key: string): Promise<void> {
    if (!this.key) return
    if (key.startsWith('session:')) {
      await this.rest(`auth_devices?session_id=eq.${encodeURIComponent(key.slice(8))}`, { method: 'DELETE' })
      return
    }
    if (key.startsWith('wasnt:')) {
      await this.rest(`rg_orders?wasnt_token=eq.${encodeURIComponent(key.slice(6))}`, { method: 'PATCH', body: { wasnt_token: null } })
      return
    }
    if (key.startsWith('verify:') || key.startsWith('reset:')) return
  }

  async provision(email: string, password: string): Promise<string> {
    const res = await this.auth('/admin/users', {
      method: 'POST',
      body: { email, password, email_confirm: true },
    })
    const data = (await res.json().catch(() => ({}))) as { id?: string; error_code?: string; msg?: string }
    if (res.status === 422 || data.error_code === 'email_exists') throw new TakenError()
    if (!res.ok || !data.id) throw new SchemaError(data.msg || 'auth-create')
    return data.id
  }

  async passwordOk(email: string, password: string): Promise<boolean> {
    if (!this.key || !email || !password) return false
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: this.key, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return res.ok
  }

  async setPassword(id: string, password: string): Promise<void> {
    const res = await this.auth(`/admin/users/${id}`, { method: 'PUT', body: { password } })
    if (!res.ok) throw new SchemaError('auth-password')
  }

  async updateAuthEmail(id: string, email: string): Promise<void> {
    const res = await this.auth(`/admin/users/${id}`, { method: 'PUT', body: { email, email_confirm: true } })
    if (!res.ok) throw new SchemaError('auth-email')
  }

  async deleteUser(id: string): Promise<void> {
    await this.auth(`/admin/users/${id}`, { method: 'DELETE' })
  }

  async authId(email: string): Promise<string | null> {
    const id = await this.rpc('rg_auth_id_by_email', { target: email.trim().toLowerCase() })
    return typeof id === 'string' ? id : null
  }

  async ensurePlayer(id: string, email: string): Promise<Account> {
    const existing = await this.load(id)
    if (existing) return existing
    const user = await this.authUser(id)
    const display = String(user?.user_metadata?.player_name || user?.user_metadata?.display_name || 'Bright Owl').slice(0, 24)
    await this.rest('players', {
      method: 'POST',
      body: { id, display_name: display, age_13_plus: false, marketing_opt_in: false },
    })
    await this.rest('game_saves', {
      method: 'POST',
      body: { player_id: id, slot: 'rewrite', version: 2, state: { authEmail: email } },
    })
    await this.rest('player_balances', { method: 'POST', body: { player_id: id, balance: 0 } })
    const loaded = await this.load(id)
    if (!loaded) throw new SchemaError('player')
    loaded.authEmail = email
    return loaded
  }

  async insertPlayer(id: string, displayName: string): Promise<string> {
    await this.rest('players', {
      method: 'POST',
      body: { id, display_name: displayName.slice(0, 24), age_13_plus: false, marketing_opt_in: false },
    })
    const row = await this.one<{ public_name: string }>(`players?id=eq.${id}&select=public_name`)
    return row?.public_name ?? displayName
  }

  async rename(id: string, displayName: string): Promise<string> {
    const rows = await this.rest(`players?id=eq.${id}&select=public_name`, {
      method: 'PATCH',
      body: { display_name: displayName },
    })
    const row = rows[0] as { public_name?: string } | undefined
    return row?.public_name || displayName
  }

  async profane(name: string): Promise<boolean> {
    try {
      const hit = await this.rpc('is_profane', { name })
      return hit === true
    } catch {
      return false
    }
  }

  async addScore(playerId: string, input: { size: number; seconds: number; moves: number; mode: string; puzzleId: string; run: number }, teamId: string | null): Promise<void> {
    const mode = input.mode === 'daily' ? 'daily' : input.mode === 'survival' ? 'endless' : 'normal'
    await this.rest('scores', {
      method: 'POST',
      body: {
        player_id: playerId,
        score: input.mode === 'survival' ? input.run : input.seconds,
        level: input.size,
        moves: input.moves,
        time_seconds: input.seconds,
        mode,
        puzzle_id: input.puzzleId,
        daily_date: mode === 'daily' ? torontoDate() : null,
      },
    })
    if (teamId) {
      await this.rest('group_points', {
        method: 'POST',
        body: { group_id: teamId, player_id: playerId, points: 1 },
      })
    }
  }

  async board(scope: string, size: number, viewer: string | null): Promise<BoardResult> {
    if (scope === 'friends') {
      if (!viewer) return { rows: [], friends: [], incoming: [], outgoing: [], inbox: [] }
      const social = await this.social(viewer)
      const inbox = await this.inbox(viewer)
      const ids = social.friends.map((friend) => friend.id)
      const ranked = await this.rank(ids, 'week', size)
      return { rows: ranked, ...social, inbox }
    }
    const scores = await this.many<{ player_id: string; time_seconds: number; mode: string; level: number; score: number; daily_date: string | null; created_at: string }>(
      'scores?select=player_id,time_seconds,mode,level,score,daily_date,created_at&order=created_at.desc&limit=800',
    )
    const ids = [...new Set(scores.map((row) => row.player_id))]
    return { rows: await this.decorate(ids, scores, scope, size) }
  }

  async social(meId: string): Promise<Social> {
    const ships = await this.many<{ player_a: string; player_b: string }>(`friendships?or=(player_a.eq.${meId},player_b.eq.${meId})&select=player_a,player_b`)
    const links = await this.many<{ from_player: string; to_player: string; status: string }>(
      `friend_links?or=(from_player.eq.${meId},to_player.eq.${meId})&status=eq.pending&select=from_player,to_player,status`,
    )
    const friendIds = ships.map((row) => (row.player_a === meId ? row.player_b : row.player_a))
    const incomingIds = links.filter((row) => row.to_player === meId).map((row) => row.from_player)
    const outgoingIds = links.filter((row) => row.from_player === meId).map((row) => row.to_player)
    const names = await this.names([...friendIds, ...incomingIds, ...outgoingIds])
    const as = (id: string) => ({ id, name: names.get(id) ?? 'Player' })
    return { friends: friendIds.map(as), incoming: incomingIds.map(as), outgoing: outgoingIds.map(as) }
  }

  async friendAsk(fromId: string, fromName: string, toId: string): Promise<'ok' | 'already' | 'bad'> {
    if (fromId === toId) return 'bad'
    const ship = await this.one(`friendships?or=(and(player_a.eq.${fromId},player_b.eq.${toId}),and(player_a.eq.${toId},player_b.eq.${fromId}))&select=player_a`)
    if (ship) return 'already'
    const pending = await this.one(`friend_links?from_player=eq.${fromId}&to_player=eq.${toId}&status=eq.pending&select=id`)
    if (pending) return 'ok'
    await this.rest('friend_links', { method: 'POST', body: { from_player: fromId, to_player: toId, status: 'pending' } })
    await this.rest('friend_requests?on_conflict=from_id,to_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: { from_id: fromId, to_id: toId, status: 'pending', op_id: crypto.randomUUID() },
    })
    await this.notify(toId, fromId, fromName, 'Friend request', { kind: 'friend' })
    return 'ok'
  }

  async friendAnswer(meId: string, otherId: string, accept: boolean): Promise<void> {
    const status = accept ? 'accepted' : 'declined'
    await this.rest(`friend_links?from_player=eq.${otherId}&to_player=eq.${meId}&status=eq.pending`, { method: 'PATCH', body: { status } })
    await this.rest(`friend_requests?from_id=eq.${otherId}&to_id=eq.${meId}&status=eq.pending`, {
      method: 'PATCH',
      body: { status: accept ? 'accepted' : 'ignored' },
    })
    if (accept) {
      const [a, b] = meId < otherId ? [meId, otherId] : [otherId, meId]
      await this.rest('friendships?on_conflict=player_a,player_b', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: { player_a: a, player_b: b },
      })
    }
  }

  async friendCancel(meId: string, otherId: string): Promise<void> {
    await this.rest(`friend_links?from_player=eq.${meId}&to_player=eq.${otherId}&status=eq.pending`, { method: 'PATCH', body: { status: 'cancelled' } })
    await this.rest(`friend_requests?from_id=eq.${meId}&to_id=eq.${otherId}&status=eq.pending`, { method: 'PATCH', body: { status: 'ignored' } })
  }

  async friendRemove(meId: string, otherId: string): Promise<void> {
    const [a, b] = meId < otherId ? [meId, otherId] : [otherId, meId]
    await this.rest(`friendships?player_a=eq.${a}&player_b=eq.${b}`, { method: 'DELETE' })
    await this.rest(`friend_links?or=(and(from_player.eq.${meId},to_player.eq.${otherId}),and(from_player.eq.${otherId},to_player.eq.${meId}))&status=eq.accepted`, {
      method: 'PATCH',
      body: { status: 'removed' },
    })
  }

  async notify(recipientId: string, fromId: string | null, fromName: string, body: string, payload: Record<string, unknown>): Promise<void> {
    await this.rest('inbox', {
      method: 'POST',
      body: {
        recipient_id: recipientId,
        kind: 'request',
        from_id: fromId,
        from_name: fromName.slice(0, 24) || 'Player',
        body: body.slice(0, 240),
        payload,
      },
    })
  }

  async inbox(id: string): Promise<InboxRow[]> {
    return this.many<InboxRow>(`inbox?recipient_id=eq.${id}&order=created_at.desc&limit=40&select=id,kind,from_id,from_name,body,payload,read_at,created_at`)
  }

  async markRead(id: string, messageId: number): Promise<void> {
    await this.rest(`inbox?id=eq.${messageId}&recipient_id=eq.${id}`, { method: 'PATCH', body: { read_at: new Date().toISOString() } })
  }

  async idByPublicName(name: string): Promise<string | null> {
    const row = await this.one<{ id: string }>(`players?public_name=ilike.${encodeURIComponent(name)}&select=id&limit=1`)
    return row?.id ?? null
  }

  private async load(id: string): Promise<Account | null> {
    const player = await this.one<{ id: string; public_name: string; created_at: string }>(`players?id=eq.${id}&select=id,public_name,created_at`)
    if (!player) return null
    const [save, balance, flags, recovery, age, code, links, devices, user] = await Promise.all([
      this.one<{ state: State }>(`game_saves?player_id=eq.${id}&slot=eq.rewrite&select=state`),
      this.one<{ balance: number }>(`player_balances?player_id=eq.${id}&select=balance`),
      this.one<{ buying_stopped: boolean; owner_role: string | null; terms_version: string | null; terms_accepted_at: string | null }>(
        `account_flags?user_id=eq.${id}&select=buying_stopped,owner_role,terms_version,terms_accepted_at`,
      ),
      this.one<{ recovery_email: string | null; email_verified_at: string | null; pending_email: string | null; code_hash: string | null; code_purpose: string | null }>(
        `account_recovery?player_id=eq.${id}&select=recovery_email,email_verified_at,pending_email,code_hash,code_purpose`,
      ),
      this.one<{ choice: string }>(`age_choices?user_id=eq.${id}&select=choice`),
      this.one<{ code_hash: string }>(`recovery_codes?player_id=eq.${id}&used_at=is.null&select=code_hash&order=created_at.desc&limit=1`),
      this.many<{ child_id: string; parent_id: string | null; status: string }>(
        `parent_links?or=(child_id.eq.${id},parent_id.eq.${id})&status=eq.active&select=child_id,parent_id,status`,
      ),
      this.many<{ session_id: string }>(`auth_devices?player_id=eq.${id}&select=session_id`),
      this.authUser(id),
    ])
    const state = save?.state ?? {}
    const holderId = links.find((link) => link.child_id === id && link.parent_id)?.parent_id ?? null
    const memberIds = links.filter((link) => link.parent_id === id).map((link) => link.child_id)
    const email = recovery?.recovery_email ?? (user?.email?.endsWith('@name.romansgame.invalid') ? null : user?.email ?? null)
    return {
      id,
      loginKey: (email ?? player.public_name).toLowerCase(),
      playerName: player.public_name,
      email,
      emailVerified: !!recovery?.email_verified_at,
      pendingEmail: recovery?.pending_email ?? null,
      passHash: 'supabase',
      passSalt: 'supabase',
      recoveryHash: code?.code_hash ?? null,
      recoverySalt: null,
      ageGate: age?.choice === '13_plus' ? 'over' : age?.choice === 'under_13' ? 'under' : null,
      wins: state.wins ?? 0,
      winsByBoard: winMap(state),
      perfects: state.perfects ?? 0,
      coins: balance?.balance ?? 0,
      starterOwned: state.starterOwned ?? false,
      buyingStopped: flags?.buying_stopped ?? false,
      holder: flags?.owner_role === 'adult',
      holderId,
      memberIds,
      pets: state.pets ?? [],
      clothes: state.clothes ?? [],
      hostPet: state.hostPet ?? null,
      charges: state.charges ?? {},
      hearts: state.hearts ?? 3,
      bestRun: state.bestRun ?? {},
      streakDay: state.streakDay ?? null,
      streak: state.streak ?? 0,
      dailyWin: state.dailyWin ?? null,
      dailySeconds: state.dailySeconds ?? null,
      weekKey: state.weekKey ?? '',
      weekWins: state.weekWins ?? 0,
      teamId: state.teamId ?? null,
      sessions: devices.map((device) => device.session_id),
      resetToken: state.resetToken ?? null,
      verifyToken: state.verifyToken ?? null,
      termsVersion: flags?.terms_version ?? state.termsVersion ?? '',
      termsAt: flags?.terms_accepted_at ?? state.termsAt ?? player.created_at,
      createdAt: state.createdAt ?? player.created_at,
      lastPlayed: state.lastPlayed ?? null,
      deleteAfter: state.deleteAfter ?? null,
      solved: state.solved ?? [],
      language: state.language ?? null,
      failedSignins: state.failedSignins ?? 0,
      lockedUntil: state.lockedUntil ?? null,
      purchaseAccepts: state.purchaseAccepts ?? [],
      authEmail: user?.email ?? state.authEmail ?? '',
      resetFresh: state.resetFresh ?? false,
    }
  }

  private async save(account: Account & { resetFresh?: boolean }): Promise<void> {
    const state: State = {
      authEmail: account.authEmail,
      wins: account.wins,
      winsByBoard: account.winsByBoard,
      perfects: account.perfects,
      starterOwned: account.starterOwned,
      pets: account.pets,
      clothes: account.clothes,
      hostPet: account.hostPet,
      charges: account.charges,
      hearts: account.hearts,
      bestRun: account.bestRun,
      streakDay: account.streakDay,
      streak: account.streak,
      dailyWin: account.dailyWin,
      dailySeconds: account.dailySeconds,
      weekKey: account.weekKey,
      weekWins: account.weekWins,
      teamId: account.teamId,
      language: account.language,
      lastPlayed: account.lastPlayed,
      deleteAfter: account.deleteAfter,
      solved: account.solved,
      failedSignins: account.failedSignins,
      lockedUntil: account.lockedUntil,
      purchaseAccepts: account.purchaseAccepts,
      sessions: account.sessions,
      resetToken: account.resetToken,
      verifyToken: account.verifyToken,
      resetFresh: account.resetFresh ?? false,
      termsVersion: account.termsVersion,
      termsAt: account.termsAt,
      createdAt: account.createdAt,
    }
    await this.rest('game_saves?on_conflict=player_id,slot', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: { player_id: account.id, slot: 'rewrite', version: 2, state },
    })
    await this.rest('player_balances?on_conflict=player_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: { player_id: account.id, balance: account.coins },
    })
    await this.rest('account_flags?on_conflict=user_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: {
        user_id: account.id,
        buying_stopped: account.buyingStopped,
        owner_role: account.holder ? 'adult' : null,
        terms_version: account.termsVersion || null,
        terms_accepted_at: account.termsAt || null,
      },
    })
    const purpose = account.resetToken ? 'reset' : account.verifyToken ? 'verify' : null
    const token = account.resetToken || account.verifyToken
    await this.rest('account_recovery?on_conflict=player_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: {
        player_id: account.id,
        recovery_email: account.email,
        email_verified_at: account.emailVerified ? new Date().toISOString() : null,
        pending_email: account.pendingEmail,
        code_hash: token ? sha256(token) : null,
        code_purpose: purpose,
        code_expires_at: token ? new Date(Date.now() + (account.resetToken ? RESET_MINUTES : 24 * 60) * 60_000).toISOString() : null,
        code_attempts: 0,
      },
    })
    if (account.ageGate) {
      await this.rest('age_choices?on_conflict=user_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: { user_id: account.id, choice: account.ageGate === 'over' ? '13_plus' : 'under_13' },
      })
      if (account.ageGate === 'over') await this.rest(`players?id=eq.${account.id}`, { method: 'PATCH', body: { age_13_plus: true } })
    }
    if (account.recoveryHash) {
      const current = await this.one<{ code_hash: string }>(`recovery_codes?player_id=eq.${account.id}&used_at=is.null&select=code_hash&limit=1`)
      if (current?.code_hash !== account.recoveryHash) {
        await this.rest(`recovery_codes?player_id=eq.${account.id}&used_at=is.null`, { method: 'PATCH', body: { used_at: new Date().toISOString() } })
        await this.rest('recovery_codes', { method: 'POST', body: { player_id: account.id, code_hash: account.recoveryHash } })
      }
    } else {
      await this.rest(`recovery_codes?player_id=eq.${account.id}&used_at=is.null`, { method: 'PATCH', body: { used_at: new Date().toISOString() } })
    }
    if (account.holderId) {
      const link = await this.one<{ id: string }>(`parent_links?child_id=eq.${account.id}&status=in.(pending,active)&select=id&limit=1`)
      if (link) {
        await this.rest(`parent_links?id=eq.${link.id}`, { method: 'PATCH', body: { parent_id: account.holderId, status: 'active', accepted_at: new Date().toISOString() } })
      } else {
        await this.rest('parent_links', {
          method: 'POST',
          body: {
            child_id: account.id,
            parent_id: account.holderId,
            token_hash: sha256(randomBytes(16).toString('hex')),
            status: 'active',
            invite_until: new Date(Date.now() + 7 * 86400000).toISOString(),
            accepted_at: new Date().toISOString(),
          },
        })
      }
    } else {
      await this.rest(`parent_links?child_id=eq.${account.id}&status=eq.active`, { method: 'PATCH', body: { status: 'revoked' } })
    }
    const devices = await this.many<{ session_id: string }>(`auth_devices?player_id=eq.${account.id}&select=session_id`)
    const have = new Set(devices.map((device) => device.session_id))
    const want = new Set(account.sessions)
    for (const token of want) if (!have.has(token)) await this.insertDevice(account.id, token)
    for (const token of have) if (!want.has(token)) await this.rest(`auth_devices?session_id=eq.${encodeURIComponent(token)}`, { method: 'DELETE' })
  }

  private async idForLogin(login: string): Promise<string | null> {
    const name = login.trim().toLowerCase()
    if (name.includes('@')) return this.authId(name)
    return this.idByPublicName(name)
  }

  private async readSession(token: string): Promise<{ accountId: string } | null> {
    const row = await this.one<{ player_id: string }>(`auth_devices?session_id=eq.${encodeURIComponent(token)}&select=player_id`)
    return row ? { accountId: row.player_id } : null
  }

  private async writeSession(token: string, value: { accountId: string }): Promise<void> {
    await this.insertDevice(value.accountId, token)
  }

  private async insertDevice(playerId: string, token: string): Promise<void> {
    await this.rest('auth_devices?on_conflict=session_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: {
        player_id: playerId,
        session_id: token,
        ua_hash: sha256(token).slice(0, 32),
        stay_signed_in: true,
        absolute_until: new Date(Date.now() + 400 * 86400000).toISOString(),
        last_seen_at: new Date().toISOString(),
      },
    })
  }

  private async readPayload(key: string): Promise<unknown | null> {
    const row = await this.one<{ payload: unknown }>(`rg_rate?key=eq.${encodeURIComponent(key)}&select=payload`)
    return row ? row.payload : null
  }

  private async writePayload(key: string, value: unknown): Promise<void> {
    await this.rest('rg_rate?on_conflict=key', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: { key, payload: value ?? {}, updated_at: new Date().toISOString() },
    })
  }

  private async playerForCode(token: string, purpose: string): Promise<string | null> {
    const row = await this.one<{ player_id: string; code_expires_at: string | null }>(
      `account_recovery?code_hash=eq.${sha256(token)}&code_purpose=eq.${purpose}&select=player_id,code_expires_at`,
    )
    if (!row) return null
    if (row.code_expires_at && Date.parse(row.code_expires_at) < Date.now() && purpose === 'reset') return null
    return row.player_id
  }

  private async readReset(token: string): Promise<{ accountId: string; exp: number; freshCode?: boolean } | null> {
    const row = await this.one<{ player_id: string; code_expires_at: string | null }>(
      `account_recovery?code_hash=eq.${sha256(token)}&code_purpose=eq.reset&select=player_id,code_expires_at`,
    )
    if (!row?.code_expires_at) return null
    const exp = Date.parse(row.code_expires_at)
    if (exp < Date.now()) return null
    const save = await this.one<{ state: State }>(`game_saves?player_id=eq.${row.player_id}&slot=eq.rewrite&select=state`)
    return { accountId: row.player_id, exp, freshCode: save?.state?.resetFresh === true }
  }

  private async writeReset(token: string, value: { accountId: string; exp: number; freshCode?: boolean }): Promise<void> {
    await this.rest(`account_recovery?player_id=eq.${value.accountId}`, {
      method: 'PATCH',
      body: {
        code_hash: sha256(token),
        code_purpose: 'reset',
        code_expires_at: new Date(value.exp).toISOString(),
        code_attempts: 0,
      },
    })
    const save = await this.one<{ state: State }>(`game_saves?player_id=eq.${value.accountId}&slot=eq.rewrite&select=state`)
    const state = { ...(save?.state ?? {}), resetToken: token, resetFresh: value.freshCode === true }
    await this.rest('game_saves?on_conflict=player_id,slot', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: { player_id: value.accountId, slot: 'rewrite', version: 2, state },
    })
  }

  private async readApproval(token: string): Promise<Approval | null> {
    const row = await this.one<{
      invite_token: string
      child_id: string
      invite_email: string | null
      status: string
      created_at: string
      last_mail_at: string | null
      reminder_sent: boolean
      invite_until: string
    }>(`parent_links?invite_token=eq.${encodeURIComponent(token)}&select=invite_token,child_id,invite_email,status,created_at,last_mail_at,reminder_sent,invite_until`)
    if (!row) return null
    const player = await this.one<{ public_name: string }>(`players?id=eq.${row.child_id}&select=public_name`)
    let status: Approval['status'] = row.status === 'active' ? 'approved' : row.status === 'revoked' ? 'declined' : 'pending'
    if (status === 'pending' && Date.parse(row.invite_until) < Date.now()) status = 'expired'
    return {
      token: row.invite_token,
      playerId: row.child_id,
      playerName: player?.public_name ?? 'Player',
      email: row.invite_email ?? '',
      createdAt: row.created_at,
      lastMailAt: row.last_mail_at ?? row.created_at,
      reminderSent: row.reminder_sent,
      status,
    }
  }

  private async writeApproval(approval: Approval): Promise<void> {
    const existing = await this.one<{ id: string }>(`parent_links?invite_token=eq.${encodeURIComponent(approval.token)}&select=id`)
    const status = approval.status === 'approved' ? 'active' : approval.status === 'declined' || approval.status === 'expired' ? 'revoked' : 'pending'
    const body = {
      child_id: approval.playerId,
      invite_email: approval.email,
      invite_token: approval.token,
      token_hash: sha256(approval.token),
      status,
      reminder_sent: approval.reminderSent,
      last_mail_at: approval.lastMailAt,
      invite_until: new Date(Date.parse(approval.createdAt) + 7 * 86400000).toISOString(),
    }
    if (existing) await this.rest(`parent_links?id=eq.${existing.id}`, { method: 'PATCH', body })
    else await this.rest('parent_links', { method: 'POST', body })
  }

  private async approvalTokenFor(playerId: string): Promise<string | null> {
    const row = await this.one<{ invite_token: string | null }>(`parent_links?child_id=eq.${playerId}&status=eq.pending&select=invite_token&order=created_at.desc&limit=1`)
    return row?.invite_token ?? null
  }

  private async readOrder(id: string): Promise<Order | null> {
    const row = await this.one<Record<string, unknown>>(`rg_orders?id=eq.${id}&select=*`)
    return row ? this.orderFrom(row) : null
  }

  private async writeOrder(order: Order): Promise<void> {
    await this.rest('rg_orders?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: {
        id: order.id,
        player_id: order.accountId,
        sku: order.sku,
        cents: order.cents,
        currency: order.currency,
        price: order.price,
        status: order.status,
        accepted_at: order.acceptedAt,
        paid_at: order.paidAt,
        stripe_session: order.sessionId,
        wasnt_token: order.wasntToken,
        wasnt_used: order.wasntUsed,
        terms_version: TERMS_VERSION,
      },
    })
  }

  private orderFrom(row: Record<string, unknown>): Order {
    return {
      id: String(row.id),
      accountId: String(row.player_id),
      sku: row.sku === 'starter' ? 'starter' : 'pack-small',
      cents: Number(row.cents),
      currency: row.currency === 'usd' ? 'usd' : 'cad',
      price: String(row.price),
      status: row.status === 'paid' ? 'paid' : 'review',
      acceptedAt: String(row.accepted_at),
      paidAt: row.paid_at ? String(row.paid_at) : null,
      sessionId: row.stripe_session ? String(row.stripe_session) : null,
      wasntToken: row.wasnt_token ? String(row.wasnt_token) : null,
      wasntUsed: row.wasnt_used === true,
    }
  }

  private async orderIdByStripe(sessionId: string): Promise<string | null> {
    const row = await this.one<{ id: string }>(`rg_orders?stripe_session=eq.${encodeURIComponent(sessionId)}&select=id`)
    return row?.id ?? null
  }

  private async bindStripe(sessionId: string, orderId: string): Promise<void> {
    await this.rest(`rg_orders?id=eq.${orderId}`, { method: 'PATCH', body: { stripe_session: sessionId } })
  }

  private async orderIdByWasnt(token: string): Promise<string | null> {
    const row = await this.one<{ id: string }>(`rg_orders?wasnt_token=eq.${encodeURIComponent(token)}&select=id`)
    return row?.id ?? null
  }

  private async bindWasnt(token: string, orderId: string): Promise<void> {
    await this.rest(`rg_orders?id=eq.${orderId}`, { method: 'PATCH', body: { wasnt_token: token } })
  }

  private async readChallenge(code: string): Promise<Challenge | null> {
    const row = await this.one<{ code: string; puzzle: Challenge['puzzle']; sender_name: string; sender_seconds: number; sender_id: string | null; results: Challenge['results'] }>(
      `rg_challenges?code=eq.${encodeURIComponent(code)}&select=code,puzzle,sender_name,sender_seconds,sender_id,results`,
    )
    if (!row) return null
    return { code: row.code, puzzle: row.puzzle, senderName: row.sender_name, senderSeconds: row.sender_seconds, senderId: row.sender_id, results: row.results ?? [] }
  }

  private async writeChallenge(challenge: Challenge): Promise<void> {
    await this.rest('rg_challenges?on_conflict=code', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: {
        code: challenge.code,
        puzzle: challenge.puzzle,
        sender_name: challenge.senderName,
        sender_seconds: challenge.senderSeconds,
        sender_id: challenge.senderId,
        results: challenge.results,
      },
    })
  }

  private async teamIdByCode(code: string): Promise<string | null> {
    const row = await this.one<{ id: string }>(`game_groups?invite_code=eq.${encodeURIComponent(code)}&select=id`)
    return row?.id ?? null
  }

  private async teamIdByName(name: string): Promise<string | null> {
    const row = await this.one<{ id: string }>(`game_groups?name=ilike.${encodeURIComponent(name)}&select=id&limit=1`)
    return row?.id ?? null
  }

  private async readTeam(id: string): Promise<Team | null> {
    const group = await this.one<{ id: string; name: string; invite_code: string | null; open_join: boolean; mascot: string | null; week_key: string | null; week_scores: Record<string, number> | null }>(
      `game_groups?id=eq.${id}&select=id,name,invite_code,open_join,mascot,week_key,week_scores`,
    )
    if (!group) return null
    const closed = await this.one(`group_closed?group_id=eq.${id}&select=group_id`)
    const members = await this.many<{ player_id: string; joined_at: string }>(`group_members?group_id=eq.${id}&left_at=is.null&removed_at=is.null&select=player_id,joined_at`)
    const roles = await this.many<{ player_id: string; role: Team['members'][number]['rank'] }>(`group_roles?group_id=eq.${id}&select=player_id,role`)
    const asks = await this.many<{ player_id: string; created_at: string }>(`group_join_requests?group_id=eq.${id}&status=eq.pending&select=player_id,created_at`)
    const names = await this.names([...members.map((member) => member.player_id), ...asks.map((ask) => ask.player_id)])
    const roleOf = (playerId: string) => roles.find((role) => role.player_id === playerId)?.role ?? 'member'
    return {
      id: group.id,
      code: group.invite_code ?? '',
      name: group.name,
      mascot: group.mascot ?? 'Leo',
      openJoin: group.open_join === true,
      closed: !!closed,
      weekKey: group.week_key ?? '',
      scores: group.week_scores ?? {},
      members: members.map((member) => ({
        id: member.player_id,
        name: names.get(member.player_id) ?? 'Player',
        rank: roleOf(member.player_id),
        joinedAt: member.joined_at,
      })),
      asks: asks.map((ask) => ({ id: ask.player_id, name: names.get(ask.player_id) ?? 'Player', at: ask.created_at })),
    }
  }

  private async writeTeam(team: Team): Promise<void> {
    const existing = await this.one<{ id: string }>(`game_groups?id=eq.${team.id}&select=id`)
    const leader = team.members.find((member) => member.rank === 'leader') ?? team.members[0]
    const parsed = /^(\S+) (\S+) #(\d+)$/.exec(team.name)
    const group = {
      name: team.name,
      invite_code: team.code,
      open_join: team.openJoin,
      mascot: team.mascot,
      week_key: team.weekKey,
      week_scores: team.scores,
    }
    if (!existing) {
      if (!leader) throw new SchemaError('team')
      await this.rest('game_groups', { method: 'POST', body: { id: team.id, founder_id: leader.id, ...group } })
    } else {
      await this.rest(`game_groups?id=eq.${team.id}`, { method: 'PATCH', body: group })
    }
    if (parsed) {
      await this.rest('group_titles?on_conflict=group_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: { group_id: team.id, adjective: parsed[1], noun: parsed[2], tag_no: Number(parsed[3]) },
      })
    }
    if (team.closed) {
      await this.rest('group_closed?on_conflict=group_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: { group_id: team.id },
      })
    } else {
      await this.rest(`group_closed?group_id=eq.${team.id}`, { method: 'DELETE' })
    }
    const current = await this.many<{ id: string; player_id: string }>(`group_members?group_id=eq.${team.id}&left_at=is.null&removed_at=is.null&select=id,player_id`)
    const wanted = new Set(team.members.map((member) => member.id))
    for (const row of current) {
      if (!wanted.has(row.player_id)) await this.rest(`group_members?id=eq.${row.id}`, { method: 'PATCH', body: { left_at: new Date().toISOString() } })
    }
    const have = new Set(current.map((row) => row.player_id))
    for (const member of team.members) {
      if (!have.has(member.id)) {
        await this.rest('group_members', { method: 'POST', body: { group_id: team.id, player_id: member.id, joined_at: member.joinedAt } })
      }
      await this.rest('group_roles?on_conflict=group_id,player_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: { group_id: team.id, player_id: member.id, role: member.rank },
      })
    }
    const asks = await this.many<{ id: string; player_id: string }>(`group_join_requests?group_id=eq.${team.id}&status=eq.pending&select=id,player_id`)
    const askIds = new Set(team.asks.map((ask) => ask.id))
    for (const row of asks) {
      if (!askIds.has(row.player_id)) await this.rest(`group_join_requests?id=eq.${row.id}`, { method: 'PATCH', body: { status: 'cancelled' } })
    }
    const askHave = new Set(asks.map((row) => row.player_id))
    for (const ask of team.asks) {
      if (!askHave.has(ask.id)) await this.rest('group_join_requests', { method: 'POST', body: { group_id: team.id, player_id: ask.id, status: 'pending' } })
    }
  }

  private async rank(ids: string[], scope: string, size: number): Promise<BoardResult['rows']> {
    if (!ids.length) return []
    const scores = await this.many<{ player_id: string; time_seconds: number; mode: string; level: number; score: number; daily_date: string | null; created_at: string }>(
      `scores?player_id=in.(${ids.join(',')})&select=player_id,time_seconds,mode,level,score,daily_date,created_at&limit=800`,
    )
    return this.decorate(ids, scores, scope, size)
  }

  private async decorate(
    ids: string[],
    scores: { player_id: string; time_seconds: number; mode: string; level: number; score: number; daily_date: string | null; created_at: string }[],
    scope: string,
    size: number,
  ): Promise<BoardResult['rows']> {
    const today = torontoDate()
    const start = weekStart()
    const totals = new Map<string, number>()
    for (const id of ids) totals.set(id, 0)
    for (const row of scores) {
      if (scope === 'today') {
        if (row.mode === 'daily' && row.daily_date === today) {
          const prev = totals.get(row.player_id)
          if (prev == null || prev === 0 || row.time_seconds < prev) totals.set(row.player_id, row.time_seconds)
        }
      } else if (scope === 'survival') {
        if (row.mode === 'endless' && row.level === size) totals.set(row.player_id, Math.max(totals.get(row.player_id) ?? 0, row.score))
      } else if (Date.parse(row.created_at) >= start) {
        totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + 1)
      }
    }
    const names = await this.names(ids)
    const hidden = await this.hiddenNames(ids)
    const saves = ids.length
      ? await this.many<{ player_id: string; state: State }>(`game_saves?player_id=in.(${ids.join(',')})&slot=eq.rewrite&select=player_id,state`)
      : []
    const winsOf = new Map(saves.map((save) => [save.player_id, winMap(save.state ?? {})]))
    return [...totals.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => (scope === 'today' ? a[1] - b[1] : b[1] - a[1]))
      .slice(0, 50)
      .map(([id, score]) => ({
        id,
        name: hidden.has(id) ? 'Player' : names.get(id) ?? 'Player',
        score,
        throne: throneForBoards(winsOf.get(id) ?? {})?.id ?? 0,
      }))
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)].filter(Boolean)
    if (!unique.length) return new Map()
    const rows = await this.many<{ id: string; public_name: string }>(`players?id=in.(${unique.join(',')})&select=id,public_name`)
    return new Map(rows.map((row) => [row.id, row.public_name]))
  }

  private async hiddenNames(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set()
    const ages = await this.many<{ user_id: string; choice: string }>(`age_choices?user_id=in.(${ids.join(',')})&select=user_id,choice`)
    const parents = await this.many<{ child_id: string }>(`parent_links?child_id=in.(${ids.join(',')})&status=eq.active&select=child_id`)
    const linked = new Set(parents.map((row) => row.child_id))
    return new Set(ages.filter((row) => row.choice === 'under_13' && !linked.has(row.user_id)).map((row) => row.user_id))
  }

  private async authUser(id: string): Promise<{ email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, string> } | null> {
    const res = await this.auth(`/admin/users/${id}`, { method: 'GET' })
    if (!res.ok) return null
    return (await res.json()) as { email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, string> }
  }

  private readMail(): Mail[] {
    try {
      return JSON.parse(readFileSync(MAILBOX, 'utf8')) as Mail[]
    } catch {
      return []
    }
  }

  private writeMail(box: Mail[]): void {
    mkdirSync(dirname(MAILBOX), { recursive: true })
    writeFileSync(MAILBOX, JSON.stringify(box.slice(0, 40)))
  }

  private async one<T>(path: string): Promise<T | null> {
    const rows = await this.rest(path)
    return (rows[0] as T) ?? null
  }

  private async many<T>(path: string): Promise<T[]> {
    return (await this.rest(path)) as T[]
  }

  private async rpc(fn: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await this.authFetch(`/rest/v1/rpc/${fn}`, { method: 'POST', body })
    const text = await res.text()
    if (!res.ok) this.fail(res.status, text)
    return text ? JSON.parse(text) as unknown : null
  }

  private async rest(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<unknown[]> {
    const res = await this.authFetch(`/rest/v1/${path}`, init)
    if (init.method === 'DELETE' || res.status === 204) return []
    const text = await res.text()
    if (!res.ok) this.fail(res.status, text)
    if (!text) return []
    const data = JSON.parse(text) as unknown
    return Array.isArray(data) ? data : [data]
  }

  private fail(status: number, text: string): never {
    let message = text.slice(0, 300)
    try {
      const parsed = JSON.parse(text) as { code?: string; message?: string }
      message = parsed.message || message
      if (parsed.code === 'PGRST204' || parsed.code === '42P01' || parsed.code === 'PGRST202' || /does not exist|schema cache/i.test(message)) {
        throw new SchemaError(message)
      }
    } catch (err) {
      if (err instanceof SchemaError) throw err
    }
    if (status === 404) throw new SchemaError(message)
    throw new Error(message || `supabase ${status}`)
  }

  private async auth(path: string, init: { method?: string; body?: unknown }): Promise<Response> {
    if (!this.key) throw new MissingKey()
    return fetch(`${this.url}/auth/v1${path}`, {
      method: init.method ?? 'GET',
      headers: { apikey: this.key, authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  }

  private async authFetch(path: string, init: { method?: string; body?: unknown; prefer?: string }): Promise<Response> {
    if (!this.key) throw new MissingKey()
    const headers: Record<string, string> = {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      'content-type': 'application/json',
    }
    if (init.prefer) headers.prefer = init.prefer
    else if (init.method === 'POST' || init.method === 'PATCH') headers.prefer = 'return=representation'
    return fetch(`${this.url}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  }
}

export function openStore(env: Env): Store {
  return new Store(env)
}
