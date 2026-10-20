/**
 * Friends, inbox, presence, and the outbox flush.
 * Network failures stay queued. The game keeps running.
 */
import { getSupabase, cloudState } from '../cloud/cloud'
import { applyFriendRef, setActiveFriendRef } from '../game/friendRef'
import { visibleBalance } from '../game/coinSettle'
import { ackOp, emitOutboxCount, enqueueOp, listDue, listPending, newOpId, replaceOp, reschedule, type OutboxOp } from '../game/outbox'
import { pushQuiet } from '../game/quietQueue'
import { loadProfiles, setActiveProfileId, upsertProfile } from '../game/profiles'

export interface InboxItem {
  id: number
  kind: 'request' | 'challenge' | 'result' | 'live'
  fromName: string
  body: string
  payload: Record<string, unknown>
  read: boolean
}

export interface SocialSnapshot {
  friends: string[]
  asked: string[]
  online: string[]
  inbox: InboxItem[]
  unread: number
  code: string
  pendingWrites: number
  serverBalance: number | null
}

const CACHE = 'rg.social.cache.v1'
const empty: SocialSnapshot = {
  friends: [],
  asked: [],
  online: [],
  inbox: [],
  unread: 0,
  code: '',
  pendingWrites: 0,
  serverBalance: null,
}

let snap: SocialSnapshot = loadCache()
const listeners = new Set<() => void>()
let started = false
let flushing = false
let signedInUserId = ''
let activeRound: { kind: 'challenge' | 'live'; theirName: string; theirScore: number; matchId?: string } | null = null
const seenOnline = new Set<string>()

function loadCache(): SocialSnapshot {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE) || 'null') as SocialSnapshot | null
    if (!raw || !Array.isArray(raw.friends) || !Array.isArray(raw.inbox)) return { ...empty }
    return { ...empty, ...raw, pendingWrites: 0 }
  } catch {
    return { ...empty }
  }
}

function saveCache() {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ ...snap, pendingWrites: 0 }))
  } catch {
    /* private mode: this visit still has the list in memory */
  }
}

function publish(patch: Partial<SocialSnapshot>) {
  snap = { ...snap, ...patch }
  if (snap.code) setActiveFriendRef(snap.code)
  saveCache()
  for (const fn of listeners) fn()
}

export function socialSnapshot(): SocialSnapshot {
  return snap
}

export function onSocial(fn: () => void): () => void {
  listeners.add(fn)
  fn()
  return () => listeners.delete(fn)
}

export function shareUrl(url: string): string {
  return applyFriendRef(url)
}

async function sb() {
  try {
    return await getSupabase()
  } catch {
    return null
  }
}

async function rpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const client = await sb()
  if (!client) return null
  const { data, error } = await client.rpc(name, args)
  if (error) return null
  return (data ?? { ok: true }) as Record<string, unknown>
}

export function startSocial(): void {
  if (started || typeof window === 'undefined') return
  started = true
  void refresh().catch(() => undefined)
  void flushOutbox()
  window.setInterval(() => void refresh().catch(() => undefined), 30_000)
  window.setInterval(() => void beat(false), 25_000)
  window.addEventListener('online', () => void flushOutbox())
  window.addEventListener('focus', () => void flushOutbox())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox()
  })
  navigator.serviceWorker?.addEventListener?.('message', (event: MessageEvent) => {
    if (event.data?.type === 'rg-flush') void flushOutbox()
  })
  const ref = new URLSearchParams(window.location.search).get('ref')
  if (ref) void connectFriendCode(ref)
  const link = new URLSearchParams(window.location.search).get('link')
  if (link) void redeemDeviceLink(link)
}

export function setPlaying(playing: boolean): void {
  void beat(playing)
}

async function beat(playing: boolean) {
  if (cloudState().status !== 'signed-in') return
  await rpc('touch_presence', { is_playing: playing })
}

export async function refresh(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const client = await sb()
  if (!client || cloudState().status !== 'signed-in') return
  const [code, friends, presence, inbox] = await Promise.all([
    rpc('ensure_friend_code', {}),
    client.rpc('my_friends').then((res) => res, () => null),
    client.rpc('friend_presence').then((res) => res, () => null),
    client.from('inbox').select('id, kind, from_name, body, payload, read_at, created_at').order('created_at', { ascending: false }).limit(40).then((res) => res, () => null),
  ])
  const names = friends && Array.isArray(friends.data) ? friends.data.map((row: { name: string }) => row.name).filter(Boolean) : snap.friends
  const online: string[] = []
  const now = Date.now()
  if (presence && Array.isArray(presence.data)) {
    for (const row of presence.data as { name: string; playing: boolean; last_seen: string }[]) {
      const fresh = now - new Date(row.last_seen).getTime() < 50_000
      if (row.playing && fresh) {
        online.push(row.name)
        if (!seenOnline.has(row.name.toLowerCase())) {
          seenOnline.add(row.name.toLowerCase())
          pushQuiet(`${row.name} is online`)
        }
      }
    }
  }
  const items: InboxItem[] = inbox && Array.isArray(inbox.data)
    ? inbox.data.map((row) => ({
        id: Number(row.id),
        kind: row.kind,
        fromName: String(row.from_name || 'Friend'),
        body: String(row.body || ''),
        payload: (row.payload ?? {}) as Record<string, unknown>,
        read: !!row.read_at,
      }))
    : snap.inbox
  const unread = items.filter((item) => !item.read).length
  if (typeof code === 'object' && code && typeof (code as { length?: number }).length !== 'number' && typeof code !== 'string') {
    /* rpc returned jsonb or text */
  }
  const friendCode = typeof code === 'string' ? code : typeof (code as { ensure_friend_code?: string })?.ensure_friend_code === 'string' ? (code as { ensure_friend_code: string }).ensure_friend_code : snap.code
  // ensure_friend_code returns text, which supabase puts in data directly
  const resolved = typeof code === 'string' ? code : friendCode
  publish({
    friends: names,
    online,
    inbox: items,
    unread,
    code: resolved || snap.code,
    pendingWrites: (await listPending()).length,
  })
  const user = cloudState()
  const session = await client.auth.getSession()
  const uid = session.data.session?.user.id
  if (uid) {
    signedInUserId = uid
    upsertProfile({
      userId: uid,
      name: user.publicName || user.name || 'Player',
      accessToken: session.data.session?.access_token || '',
      refreshToken: session.data.session?.refresh_token || '',
      hasPin: false,
      hasPicture: false,
      passkey: loadProfiles().find((row) => row.userId === uid)?.passkey ?? false,
    })
    setActiveProfileId(uid)
    await ensureOpening(uid)
  }
}

async function ensureOpening(userId: string) {
  const flag = `rg.opening.done.${userId}`
  try {
    if (localStorage.getItem(flag) === '1') return
  } catch {
    return
  }
  let coins = 0
  try {
    const wallet = JSON.parse(localStorage.getItem('roman.wallet.v1') || '{}') as { coins?: number }
    coins = Math.max(0, Math.min(50_000, Math.round(wallet.coins || 0)))
  } catch {
    coins = 0
  }
  if (coins < 1) {
    try { localStorage.setItem(flag, '1') } catch { /* ignore */ }
    return
  }
  const id = openingId(userId)
  await enqueueOp('earn', { amount: coins, reason: 'opening' }, id)
  const rows = await listPending()
  const row = rows.find((item) => item.id === id)
  if (row) await replaceOp({ ...row, createdAt: 0 })
}

function openingId(userId: string): string {
  const key = `rg.opening.id.${userId}`
  try {
    const saved = localStorage.getItem(key)
    if (saved) return saved
    const id = newOpId()
    localStorage.setItem(key, id)
    return id
  } catch {
    return newOpId()
  }
}

export async function connectFriendCode(code: string): Promise<void> {
  const id = await enqueueOp('friend_connect', { code })
  const res = await rpc('connect_friend_code', { friend_code: code })
  if (res && res.ok !== false) {
    await ackOp(id)
    if (typeof res.name === 'string') pushQuiet(`Friends with ${res.name}`)
    await refresh()
  }
}

export async function requestFriend(name: string): Promise<void> {
  const id = newOpId()
  await enqueueOp('friend_request', { name }, id)
  publish({ asked: [...new Set([...snap.asked, name])] })
  await flushOutbox()
}

export async function respondRequest(id: number, accept: boolean): Promise<void> {
  await rpc('respond_friend', { request_id: id, accept })
  publish({ inbox: snap.inbox.map((item) => (item.id === id ? { ...item, read: true } : item)) })
  await refresh()
}

export async function sendChallenge(name: string, payload: Record<string, unknown>, body: string): Promise<void> {
  const id = newOpId()
  await enqueueOp('challenge', { name, payload, body }, id)
  pushQuiet(`Challenge sent to ${name}`)
  await flushOutbox()
}

export async function sendLive(name: string, layout: string, puzzleName: string): Promise<void> {
  const id = newOpId()
  await enqueueOp('live', { name, layout, puzzleName }, id)
  pushQuiet(`Invite sent to ${name}`)
  await flushOutbox()
}

export function armRound(round: { kind: 'challenge' | 'live'; theirName: string; theirScore: number; matchId?: string } | null): void {
  activeRound = round
}

export async function noteRoundScore(score: number, ms: number): Promise<void> {
  const round = activeRound
  activeRound = null
  if (!round) return
  if (round.kind === 'live' && round.matchId) {
    await rpc('finish_live', { match_id: round.matchId, score, ms })
    return
  }
  const id = newOpId()
  await enqueueOp('result', { name: round.theirName, my: score, their: round.theirScore }, id)
  await flushOutbox()
}

export async function markInboxRead(ids: number[]): Promise<void> {
  const client = await sb()
  if (!client || !ids.length) return
  await client.from('inbox').update({ read_at: new Date().toISOString() }).in('id', ids)
  publish({
    inbox: snap.inbox.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)),
    unread: snap.inbox.filter((item) => !item.read && !ids.includes(item.id)).length,
  })
}

export async function flushOutbox(): Promise<void> {
  if (flushing) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  flushing = true
  try {
    const due = await listDue()
    for (const op of due) {
      const ok = await sendOp(op)
      if (ok === 'ack') await ackOp(op.id)
      else if (ok === 'retry') await reschedule(op)
    }
    const left = await listPending()
    publish({ pendingWrites: left.length })
    await emitOutboxCount()
    await settleBalance(left)
  } catch {
    /* stay queued */
  } finally {
    flushing = false
  }
}

async function sendOp(op: OutboxOp): Promise<'ack' | 'retry'> {
  try {
    if (op.kind === 'friend_connect') {
      const res = await rpc('connect_friend_code', { friend_code: op.payload.code })
      return res ? 'ack' : 'retry'
    }
    if (op.kind === 'friend_request') {
      const res = await rpc('request_friend', { op: op.id, friend_name: op.payload.name })
      return res ? 'ack' : 'retry'
    }
    if (op.kind === 'challenge') {
      const res = await rpc('send_challenge', {
        op: op.id,
        to_name: op.payload.name,
        body: op.payload.body,
        payload: op.payload.payload,
      })
      if (res && res.ok !== false) void pingFriend(String(op.payload.name || ''), String(op.payload.body || 'A friend challenged you'))
      return res ? 'ack' : 'retry'
    }
    if (op.kind === 'result') {
      const res = await rpc('post_result', {
        op: op.id,
        their_name: op.payload.name,
        my_score: op.payload.my,
        their_score: op.payload.their,
      })
      return res ? 'ack' : 'retry'
    }
    if (op.kind === 'live') {
      const res = await rpc('send_live', {
        op: op.id,
        to_name: op.payload.name,
        layout: op.payload.layout,
        puzzle_name: op.payload.puzzleName,
      })
      return res ? 'ack' : 'retry'
    }
    if (op.kind === 'spend') {
      const res = await rpc('apply_coin_spend', {
        op: op.id,
        cost: op.payload.cost,
        item_type: op.payload.itemType,
        item_id: op.payload.itemId,
      })
      if (!res) return 'retry'
      if (res.ok === false && (res.error === 'insufficient' || res.error === 'bad_item' || res.error === 'bad_cost')) {
        rejectSpend(op, typeof res.balance === 'number' ? res.balance : null)
        return 'ack'
      }
      return res.ok === false ? 'retry' : 'ack'
    }
    if (op.kind === 'earn') {
      const res = await rpc('apply_coin_earn', { op: op.id, amount: op.payload.amount, reason: op.payload.reason })
      if (!res) return 'retry'
      if (res.ok !== false && op.payload.reason === 'opening') {
        const uid = cloudUser() || (await currentUserId())
        if (uid) {
          try { localStorage.setItem(`rg.opening.done.${uid}`, '1') } catch { /* ignore */ }
        }
      }
      if (res.ok === false && res.error !== 'rate') return 'ack'
      return res.ok === false ? 'retry' : 'ack'
    }
    if (op.kind === 'stripe') {
      const claimed = await claimStripe(String(op.payload.sessionId || ''))
      return claimed ? 'ack' : 'retry'
    }
    if (op.kind === 'score') {
      const res = await rpc('submit_score', {
        op: op.id,
        score: op.payload.score,
        level: op.payload.level,
        moves: op.payload.moves,
        time_seconds: op.payload.time_seconds,
        mode: op.payload.mode,
        puzzle_id: op.payload.puzzle_id ?? null,
        daily_date: op.payload.daily_date ?? null,
      })
      return res ? 'ack' : 'retry'
    }
    return 'ack'
  } catch {
    return 'retry'
  }
}

function cloudUser(): string {
  return signedInUserId
}

async function currentUserId(): Promise<string> {
  const client = await sb()
  const session = await client?.auth.getSession()
  const uid = session?.data.session?.user.id || ''
  if (uid) signedInUserId = uid
  return uid
}

function rejectSpend(op: OutboxOp, balance: number | null) {
  const note = 'Not enough coins on the account. We put the coins back and locked that item.'
  pushQuiet(note)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('rg-coin-reject', {
    detail: { balance, cost: op.payload.cost, undo: op.payload.undo, note, itemType: op.payload.itemType, itemId: op.payload.itemId },
  }))
}

async function settleBalance(pending: OutboxOp[]) {
  const res = await rpc('coin_balance', {})
  const server = typeof res === 'number' ? res : typeof res?.coin_balance === 'number' ? Number(res.coin_balance) : null
  if (server == null || Number.isNaN(server)) return
  let delta = 0
  for (const op of pending) {
    if (op.kind === 'earn' || op.kind === 'stripe') delta += Number(op.payload.amount) || 0
    if (op.kind === 'spend') delta -= Number(op.payload.cost) || 0
  }
  publish({ serverBalance: server })
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('rg-balance', { detail: { balance: visibleBalance(server, delta) } }))
}

export async function claimStripe(sessionId: string): Promise<boolean> {
  if (!sessionId) return false
  try {
    const client = await sb()
    const token = (await client?.auth.getSession())?.data.session?.access_token
    if (!token) return false
    const res = await fetch('/api/coin-credit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return data.ok !== false
  } catch {
    return false
  }
}

export async function redeemDeviceLink(secret: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/device-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret }),
    })
    const data = (await res.json()) as { ok?: boolean; token_hash?: string; email?: string; error?: string }
    if (!data.ok || !data.token_hash) return { ok: false, error: data.error || 'That code did not work.' }
    const client = await sb()
    if (!client) return { ok: false, error: 'Offline' }
    const { error } = await client.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' })
    if (error) return { ok: false, error: 'Could not switch devices. Try the code again.' }
    await refresh()
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not switch devices.' }
  }
}

export async function startDeviceLink(): Promise<{ code: string; token: string } | null> {
  const res = await rpc('device_link_start', { label: deviceLabel() })
  if (!res || typeof res.code !== 'string' || typeof res.token !== 'string') return null
  return { code: res.code, token: res.token }
}

async function pingFriend(name: string, body: string) {
  if (!name) return
  const client = await sb()
  const token = (await client?.auth.getSession())?.data.session?.access_token
  if (!token) return
  await fetch('/api/push-send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ toName: name, title: "Roman's Game", body }),
  }).catch(() => undefined)
}

function deviceLabel(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'iPhone or iPad'
  if (/Android/.test(ua)) return 'Android'
  return 'Desktop'
}

export function isFriend(name: string): boolean {
  const key = name.trim().toLowerCase()
  return snap.friends.some((friend) => friend.toLowerCase() === key)
}

export function isAsked(name: string): boolean {
  const key = name.trim().toLowerCase()
  return snap.asked.some((friend) => friend.toLowerCase() === key)
}

export function isOnline(name: string): boolean {
  const key = name.trim().toLowerCase()
  return snap.online.some((friend) => friend.toLowerCase() === key)
}
