import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  applyEarn,
  applySpend,
  freshAccount,
  freshDevice,
  itemKey,
  spendOffline,
  syncDevice,
  visibleBalance,
} from '../src/game/coinSettle.ts'
import { ackOp, backoffMs, enqueueOp, listPending, setOutboxStore, type OutboxOp, type OutboxStore } from '../src/game/outbox.ts'
import {
  availableAuthMethods,
  deviceCodeReady,
  deviceLinkUsable,
  emailCodeDigits,
  emailCodeReady,
  nextDeviceAttempt,
} from '../src/game/authMethods.ts'
import { applyFriendRef, bragLine, normalizeFriendCode, resultLines, setActiveFriendRef, withInviteRef } from '../src/game/friendRef.ts'
import { pushQuiet, quietSnapshot, resetQuiet, setQuietMuted, setQuietRound } from '../src/game/quietQueue.ts'
import { loadProfiles, PROFILE_CAP, removeProfile, upsertProfile, type ProfileStore } from '../src/game/profiles.ts'

function memStore(): ProfileStore {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  }
}

function memOutbox(): OutboxStore {
  const m = new Map<string, OutboxOp>()
  return {
    async list() {
      return [...m.values()]
    },
    async put(op) {
      if (!m.has(op.id)) m.set(op.id, op)
    },
    async delete(id) {
      m.delete(id)
    },
  }
}

test('offline spend then sync deducts once and confirms the item', () => {
  const pet = { id: 'spend-1', cost: 30, itemType: 'pet', itemId: 'lupa' }
  const spent = spendOffline(freshDevice(100), pet)
  assert.equal(spent.ok, true)
  assert.equal(spent.device.balance, 70)
  assert.equal(spent.device.items[itemKey(pet)].confirmed, false)
  const synced = syncDevice(spent.device, freshAccount(100))
  assert.equal(synced.account.balance, 70)
  assert.equal(synced.device.balance, 70)
  assert.equal(synced.device.items[itemKey(pet)].confirmed, true)
  assert.equal(synced.device.pending.length, 0)
  assert.equal(synced.note, undefined)
})

test('replaying the same spend does not deduct twice', () => {
  const op = { id: 'same', cost: 40, itemType: 'badge', itemId: 'spark:2' }
  const first = applySpend(freshAccount(100), op)
  const second = applySpend(first.account, op)
  assert.equal(second.result.duplicate, true)
  assert.equal(second.result.ok, true)
  assert.equal(second.account.balance, 60)
  assert.equal(second.account.items.length, 1)
})

test('two offline devices cannot spend the same coins', () => {
  let account = freshAccount(100)
  const a = spendOffline(freshDevice(100), { id: 'dev-a', cost: 80, itemType: 'pet', itemId: 'lupa' })
  const b = spendOffline(freshDevice(100), { id: 'dev-b', cost: 80, itemType: 'pet', itemId: 'aquila' })
  assert.equal(a.device.balance, 20)
  assert.equal(b.device.balance, 20)
  const first = syncDevice(a.device, account)
  account = first.account
  const second = syncDevice(b.device, account)
  assert.equal(first.device.items['pet:lupa'].confirmed, true)
  assert.equal(account.balance, 20)
  assert.equal(second.device.items['pet:aquila'], undefined)
  assert.equal(second.device.balance, 20)
  assert.match(second.note ?? '', /put the coins back/)
  assert.equal(second.account.items.includes('pet:aquila'), false)
})

test('an insufficient balance rejects the spend and grants nothing', () => {
  const local = spendOffline(freshDevice(10), { id: 'too-big', cost: 40, itemType: 'pet', itemId: 'nova' })
  assert.equal(local.ok, false)
  assert.equal(local.device.balance, 10)
  assert.equal(Object.keys(local.device.items).length, 0)

  const stale = spendOffline(freshDevice(100), { id: 'stale', cost: 40, itemType: 'pet', itemId: 'nova' })
  const synced = syncDevice(stale.device, freshAccount(10))
  assert.equal(synced.account.balance, 10)
  assert.equal(synced.account.items.length, 0)
  assert.equal(synced.device.balance, 10)
  assert.equal(synced.device.items['pet:nova'], undefined)
  assert.match(synced.note ?? '', /Not enough coins/)
})

test('a spend without a real cost never grants an item', () => {
  const zero = applySpend(freshAccount(50), { id: 'z', cost: 0, itemType: 'pet', itemId: 'lupa' })
  assert.equal(zero.result.ok, false)
  assert.equal(zero.account.items.length, 0)
  assert.equal(zero.account.balance, 50)
  const earned = applyEarn(freshAccount(0), { id: 'e1', amount: 25, reason: 'win' })
  const replay = applyEarn(earned.account, { id: 'e1', amount: 25, reason: 'win' })
  assert.equal(replay.account.balance, 25)
  assert.equal(replay.result.duplicate, true)
})

test('visible balance keeps unsent spends and never goes below zero', () => {
  assert.equal(visibleBalance(100, -30), 70)
  assert.equal(visibleBalance(10, -40), 0)
})

test('outbox stores one row per id', async () => {
  const box = memOutbox()
  setOutboxStore(box)
  const id = await enqueueOp('spend', { cost: 10, itemType: 'hint', itemId: 'h1' }, 'fixed-id')
  await enqueueOp('spend', { cost: 99, itemType: 'hint', itemId: 'h1' }, 'fixed-id')
  const rows = await listPending()
  assert.equal(id, 'fixed-id')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].payload.cost, 10)
  await ackOp('fixed-id')
  assert.equal((await listPending()).length, 0)
  setOutboxStore(null)
})

test('backoff grows and then caps', () => {
  assert.equal(backoffMs(1), 2000)
  assert.equal(backoffMs(2), 4000)
  assert.equal(backoffMs(3), 8000)
  assert.equal(backoffMs(12), 5 * 60_000)
})

test('desktop with no camera hides scan and still offers a code and a QR', () => {
  const methods = availableAuthMethods({ passkey: false, google: false, camera: false, largeScreen: true })
  assert.deepEqual(methods, ['qr', 'code', 'email'])
})

test('a phone with a camera offers scan ahead of show-my-QR, and always a 6-digit code', () => {
  const methods = availableAuthMethods({
    passkey: false,
    google: false,
    camera: true,
    largeScreen: false,
    includeEmail: false,
  })
  assert.deepEqual(methods, ['scan', 'qr', 'code'])
})

test('a large tablet with a camera leads with QR, then scan, and hides missing passkey and Google', () => {
  const methods = availableAuthMethods({ passkey: false, google: false, camera: true, largeScreen: true, includeEmail: true })
  assert.deepEqual(methods, ['qr', 'scan', 'code', 'email'])
  assert.equal(methods.includes('passkey'), false)
  assert.equal(methods.includes('google'), false)
})

test('the last method used on this device becomes the big button', () => {
  const methods = availableAuthMethods({
    passkey: true,
    google: true,
    camera: false,
    largeScreen: true,
    last: 'email',
  })
  assert.equal(methods[0], 'email')
  assert.equal(methods.includes('code'), true)
})

test('email codes accept 6 to 10 digits and device codes stay 6', () => {
  assert.equal(emailCodeDigits('12 3456'), '123456')
  assert.equal(emailCodeReady('123456'), true)
  assert.equal(emailCodeReady('12345678'), true)
  assert.equal(emailCodeReady('1234567890'), true)
  assert.equal(emailCodeReady('12345'), false)
  assert.equal(emailCodeDigits('1234567890123'), '1234567890')
  assert.equal(deviceCodeReady('482191'), true)
  assert.equal(deviceCodeReady('48219'), false)
  assert.equal(deviceCodeReady('1234567'), false)
})

test('a device code expires, is single use, and locks after too many tries', () => {
  const now = 1_000_000
  assert.equal(deviceLinkUsable({ createdAt: now - 4 * 60_000, now, used: false, attempts: 0 }), true)
  assert.equal(deviceLinkUsable({ createdAt: now - 6 * 60_000, now, used: false, attempts: 0 }), false)
  assert.equal(deviceLinkUsable({ createdAt: now, now, used: true, attempts: 0 }), false)
  const bad = nextDeviceAttempt(7, false)
  assert.equal(bad.locked, true)
  assert.equal(bad.ok, false)
  assert.equal(nextDeviceAttempt(8, true).ok, false)
})

test('share links carry the friend code and results name both players', () => {
  assert.equal(normalizeFriendCode('roman-4821'), 'ROMAN-4821')
  assert.equal(withInviteRef('https://play.romansgame.com/#challenge=abc', 'ROMAN-4821'), 'https://play.romansgame.com/?ref=ROMAN-4821#challenge=abc')
  setActiveFriendRef('ROMAN-1000')
  assert.match(applyFriendRef('https://play.romansgame.com/'), /ref=ROMAN-1000/)
  setActiveFriendRef(null)
  const lines = resultLines('Sam', 'Ada', 180, 100)
  assert.equal(lines.mine, 'You win')
  assert.equal(lines.theirs, 'Sam beat you by 80')
  const lost = resultLines('Sam', 'Ada', 100, 180)
  assert.equal(lost.mine, 'Ada beat you by 80')
  assert.equal(lost.theirs, 'You win')
  assert.equal(bragLine('the Keeper', 42), 'I beat the Keeper in 42 seconds, can you?')
})

test('quiet notices wait until the round is over and mute drops them', () => {
  resetQuiet()
  setQuietRound(true)
  pushQuiet('Sam is online')
  assert.equal(quietSnapshot().current, null)
  assert.equal(quietSnapshot().waiting, 1)
  setQuietRound(false)
  assert.equal(quietSnapshot().current?.text, 'Sam is online')
  resetQuiet()
  setQuietMuted(true)
  pushQuiet('Sam challenged you')
  assert.equal(quietSnapshot().current, null)
  assert.equal(quietSnapshot().waiting, 0)
  resetQuiet()
})

test('the server spend locks the balance and grants the item in one function', () => {
  const sql = readFileSync(new URL('../supabase/migration-006-social.sql', import.meta.url), 'utf8')
  assert.match(sql, /function public\._lock_balance[\s\S]{0,400}for update/)
  const spend = sql.slice(sql.indexOf('function public.apply_coin_spend'), sql.indexOf('function public.apply_coin_earn'))
  assert.match(spend, /security definer/)
  assert.match(spend, /_lock_balance/)
  assert.match(spend, /player_items/)
  assert.match(spend, /balance - cost/)
  assert.match(spend, /unique_violation/)
  assert.match(spend, /bad_item/)
})

test('a device keeps at most six profiles', () => {
  const store = memStore()
  for (let i = 0; i < 7; i++) {
    upsertProfile(
      { userId: `u${i}`, name: `P${i}`, accessToken: 'a', refreshToken: 'r', hasPin: false, hasPicture: false, passkey: false },
      store,
    )
  }
  assert.equal(loadProfiles(store).length, PROFILE_CAP)
  assert.equal(removeProfile('u0', store).some((row) => row.userId === 'u0'), false)
})
