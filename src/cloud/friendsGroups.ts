/**
 * Friends and groups on the phone leaderboard.
 * Reads and writes go through migration 011. Display names only.
 * The personal best still lives on player_board. Group points are recorded per game.
 */
import { boardError } from './boardError'
import { cloudClient } from './cloud'

const UP_YET = "The board isn't up yet."

export type FriendStatus = 'none' | 'pending' | 'incoming' | 'friends'
export type JoinStatus = 'none' | 'pending' | 'member' | 'founder' | 'leader' | 'captain' | 'no_group'
export type GroupLink = 'none' | 'pending' | 'member' | 'founder' | 'leader' | 'captain'
export type GroupRole = '' | 'leader' | 'captain' | 'member'

export interface PlayerRow {
  name: string
  score: number
  place: number
  groupName: string | null
}

export interface GroupRow {
  groupName: string
  average: number
  place: number
  activeMembers: number
  seasonPoints: number
}

export interface MyCard {
  name: string
  score: number
  place: number | null
  groupName: string | null
  friendsCount: number
  pendingCount: number
  founder: boolean
  role: GroupRole
  nextName: string | null
}

export interface PlayerCard {
  name: string
  score: number
  place: number | null
  groupName: string | null
  friendStatus: FriendStatus
  joinStatus: JoinStatus
  isYou: boolean
  role: GroupRole
}

export interface GroupCard {
  groupName: string
  weekAverage: number | null
  monthAverage: number | null
  seasonPoints: number
  activeWeek: number
  activeMonth: number
  joinStatus: GroupLink
}

export interface MemberRow {
  name: string
  status: 'active' | 'inactive'
  canRemove: boolean
  role: GroupRole
  nextInLine: boolean
}

export interface InboxRow {
  kind: 'friend' | 'join'
  name: string
  groupName: string | null
}

export type Ok<T> = { ok: true; data: T }
export type Err = { ok: false; error: string }
export type BoardResult<T> = Ok<T> | Err

type Raw = Record<string, unknown>

export { boardError }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function placeOf(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function groupOf(value: unknown): string | null {
  const name = text(value)
  return name || null
}

function rowsOf(data: unknown): Raw[] {
  if (!Array.isArray(data)) return []
  return data.filter((row): row is Raw => !!row && typeof row === 'object')
}

function first(data: unknown): Raw | null {
  return rowsOf(data)[0] ?? null
}

function friendStatus(value: unknown): FriendStatus {
  if (value === 'pending' || value === 'incoming' || value === 'friends') return value
  return 'none'
}

function joinStatus(value: unknown): JoinStatus {
  if (value === 'pending' || value === 'member' || value === 'founder' || value === 'leader' || value === 'captain' || value === 'no_group') return value
  return 'none'
}

function groupLink(value: unknown): GroupLink {
  if (value === 'pending' || value === 'member' || value === 'founder' || value === 'leader' || value === 'captain') return value
  return 'none'
}

function roleOf(value: unknown, founder = false): GroupRole {
  if (value === 'leader' || value === 'captain' || value === 'member') return value
  return founder ? 'leader' : ''
}

function parsePlayers(data: unknown): PlayerRow[] {
  const rows: PlayerRow[] = []
  for (const row of rowsOf(data)) {
    const name = text(row.name)
    const place = placeOf(row.place)
    if (!name || place == null) continue
    rows.push({ name, score: num(row.score), place, groupName: groupOf(row.group_name) })
  }
  return rows
}

async function offlineOr<T>(run: (sb: NonNullable<Awaited<ReturnType<typeof cloudClient>>>) => Promise<BoardResult<T>>): Promise<BoardResult<T>> {
  try {
    const sb = await cloudClient()
    if (!sb) return { ok: false, error: "You're offline." }
    return await run(sb)
  } catch {
    return { ok: false, error: UP_YET }
  }
}

export function loadEveryone(): Promise<BoardResult<PlayerRow[]>> {
  return offlineOr(async (sb) => {
    const next = await sb.from('everyone_board').select('name, score, place, group_name').order('place', { ascending: true }).limit(100)
    if (!next.error) return { ok: true, data: parsePlayers(next.data) }
    const prev = await sb.from('player_board').select('name, score, place').order('place', { ascending: true }).limit(100)
    if (prev.error) return { ok: false, error: UP_YET }
    return { ok: true, data: parsePlayers(prev.data) }
  })
}

export function loadFriends(): Promise<BoardResult<PlayerRow[]>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('friends_board')
    if (error) return { ok: false, error: boardError(error) }
    return { ok: true, data: parsePlayers(data) }
  })
}

export function loadGroupBoard(period: 'week' | 'month'): Promise<BoardResult<GroupRow[]>> {
  return offlineOr(async (sb) => {
    const table = period === 'month' ? 'group_month_board' : 'group_week_board'
    // Name, rank, score, and a member count. Member names stay off this board.
    const { data, error } = await sb.from(table).select('group_name, average, place, active_members, season_points').order('place', { ascending: true }).limit(100)
    if (error) return { ok: false, error: UP_YET }
    const rows: GroupRow[] = []
    for (const row of rowsOf(data)) {
      const groupName = text(row.group_name)
      const place = placeOf(row.place)
      if (!groupName || place == null) continue
      rows.push({
        groupName,
        average: num(row.average),
        place,
        activeMembers: num(row.active_members),
        seasonPoints: num(row.season_points),
      })
    }
    return { ok: true, data: rows }
  })
}

export function loadMyCard(): Promise<BoardResult<MyCard>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('my_card')
    if (error) return { ok: false, error: boardError(error, 'Sign in first.') }
    const row = first(data)
    const name = text(row?.name)
    if (!row || !name) return { ok: false, error: 'Sign in first.' }
    return {
      ok: true,
      data: {
        name,
        score: num(row.score),
        place: placeOf(row.place),
        groupName: groupOf(row.group_name),
        friendsCount: num(row.friends_count),
        pendingCount: num(row.pending_count),
        founder: row.founder === true,
        role: roleOf(row.role, row.founder === true),
        nextName: groupOf(row.next_name),
      },
    }
  })
}

export function loadPlayerCard(target: string): Promise<BoardResult<PlayerCard>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('player_card', { target })
    if (error) return { ok: false, error: boardError(error) }
    const row = first(data)
    const name = text(row?.name)
    if (!row || !name) return { ok: false, error: 'Not on the board.' }
    return {
      ok: true,
      data: {
        name,
        score: num(row.score),
        place: placeOf(row.place),
        groupName: groupOf(row.group_name),
        friendStatus: friendStatus(row.friend_status),
        joinStatus: joinStatus(row.join_status),
        isYou: row.is_you === true,
        role: roleOf(row.role),
      },
    }
  })
}

export function loadGroupCard(target: string): Promise<BoardResult<GroupCard>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('group_card', { target })
    if (error) return { ok: false, error: boardError(error) }
    const row = first(data)
    const groupName = text(row?.group_name)
    if (!row || !groupName) return { ok: false, error: 'No group by that name' }
    return {
      ok: true,
      data: {
        groupName,
        weekAverage: row.week_average == null ? null : num(row.week_average),
        monthAverage: row.month_average == null ? null : num(row.month_average),
        seasonPoints: num(row.season_points),
        activeWeek: num(row.active_week),
        activeMonth: num(row.active_month),
        joinStatus: groupLink(row.join_status),
      },
    }
  })
}

export function loadMembers(target: string): Promise<BoardResult<MemberRow[]>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('group_member_rows', { target })
    if (error) return { ok: false, error: boardError(error) }
    const rows: MemberRow[] = []
    for (const row of rowsOf(data)) {
      const name = text(row.name)
      if (!name) continue
      rows.push({
        name,
        status: row.member_status === 'inactive' ? 'inactive' : 'active',
        canRemove: row.can_remove === true,
        role: roleOf(row.role),
        nextInLine: row.next_in_line === true,
      })
    }
    return { ok: true, data: rows }
  })
}

export function loadInbox(): Promise<BoardResult<InboxRow[]>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('request_inbox')
    if (error) return { ok: false, error: boardError(error, 'Sign in first.') }
    const rows: InboxRow[] = []
    for (const row of rowsOf(data)) {
      const name = text(row.name)
      if (!name || (row.kind !== 'friend' && row.kind !== 'join')) continue
      rows.push({ kind: row.kind, name, groupName: groupOf(row.group_name) })
    }
    return { ok: true, data: rows }
  })
}

async function mutate(call: (sb: NonNullable<Awaited<ReturnType<typeof cloudClient>>>) => PromiseLike<{ error: { message?: string } | null }>): Promise<Err | { ok: true }> {
  return offlineOr(async (sb) => {
    const { error } = await call(sb)
    if (error) return { ok: false, error: boardError(error) }
    return { ok: true, data: undefined }
  }).then((result) => (result.ok ? { ok: true } : result))
}

export const sendFriend = (playerName: string) => mutate((sb) => sb.rpc('send_friend_request', { player_name: playerName }))
export const cancelFriend = (playerName: string) => mutate((sb) => sb.rpc('cancel_friend_request', { player_name: playerName }))
export const acceptFriend = (playerName: string) => mutate((sb) => sb.rpc('accept_friend', { player_name: playerName }))
export const declineFriend = (playerName: string) => mutate((sb) => sb.rpc('decline_friend', { player_name: playerName }))
export const unfriend = (playerName: string) => mutate((sb) => sb.rpc('unfriend', { player_name: playerName }))
async function named(call: (sb: NonNullable<Awaited<ReturnType<typeof cloudClient>>>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<Err | { ok: true; name: string }> {
  const result = await offlineOr(async (sb) => {
    const { data, error } = await call(sb)
    if (error) return { ok: false, error: boardError(error) }
    const name = text(data)
    if (!name) return { ok: false, error: UP_YET }
    return { ok: true, data: name }
  })
  return result.ok ? { ok: true, name: result.data } : result
}

export const createGroup = (adjective: string, noun: string) => named((sb) => sb.rpc('create_group', { adjective, noun }))
export const renameGroup = (adjective: string, noun: string) => named((sb) => sb.rpc('rename_group', { adjective, noun }))
export const requestJoin = (groupName: string) => mutate((sb) => sb.rpc('request_join', { group_name: groupName }))
export const cancelJoin = (groupName: string) => mutate((sb) => sb.rpc('cancel_join', { group_name: groupName }))
export const acceptJoin = (playerName: string) => mutate((sb) => sb.rpc('accept_join', { player_name: playerName }))
export const declineJoin = (playerName: string) => mutate((sb) => sb.rpc('decline_join', { player_name: playerName }))
export const leaveGroup = () => mutate((sb) => sb.rpc('leave_group'))
export const removeMember = (playerName: string) => mutate((sb) => sb.rpc('remove_inactive_member', { player_name: playerName }))
export const promoteCaptain = (playerName: string) => mutate((sb) => sb.rpc('promote_captain', { player_name: playerName }))
export const demoteCaptain = (playerName: string) => mutate((sb) => sb.rpc('demote_captain', { player_name: playerName }))

export function leavePreview(): Promise<BoardResult<{ nextName: string | null; closes: boolean }>> {
  return offlineOr(async (sb) => {
    const { data, error } = await sb.rpc('leave_preview')
    if (error) return { ok: false, error: boardError(error) }
    const row = first(data)
    return { ok: true, data: { nextName: groupOf(row?.next_name), closes: row?.closes === true } }
  })
}

/** Stores the Dec 1 roster when that day has arrived. No prize UI. */
export async function lockRosters(): Promise<void> {
  try {
    const sb = await cloudClient()
    if (!sb) return
    await sb.rpc('lock_season_rosters')
  } catch {
    /* migration not applied yet, or the lock is still in the future */
  }
}
