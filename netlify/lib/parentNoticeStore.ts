/**
 * Parent confirmation and day-later follow-up.
 * The working copy is a Netlify blob. Mail is sent only when
 * ACCOUNT_LEDGER_ENABLED=1 and RESEND_API_KEY is set.
 * The database delete inside cancel uses the same flag and does not run otherwise.
 */
import { getStore } from '@netlify/blobs'
import { randomBytes } from 'node:crypto'
import { deleteAccountDatabase } from './accountDeleteSql.ts'
import { deletePinRecord } from './purchasePinStore.ts'
import {
  PARENT_NOTICE_FROM,
  cancelUrl,
  dueParentMails,
  parentConfirmLetter,
  parentFollowUpLetter,
  parentMailEnabled,
  parentNoticeHtml,
  safeNickname,
  sendParentMail,
  type ParentMailKind,
  type ParentNotice,
} from '../../src/game/parentNotice.ts'

export const PARENT_NOTICE_STORE = 'roman-parent-notice'

type BlobStore = {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown): Promise<unknown>
  delete(key: string): Promise<void>
}

function store(): BlobStore {
  return getStore({ name: PARENT_NOTICE_STORE, consistency: 'strong' }) as unknown as BlobStore
}

function noticeKey(userId: string): string {
  return `notice/${userId}`
}

function tokenKey(token: string): string {
  return `token/${token}`
}

function asNotice(raw: unknown): ParentNotice | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<ParentNotice>
  if (typeof r.userId !== 'string' || typeof r.createdAt !== 'number') return null
  if (typeof r.cancelToken !== 'string') return null
  return {
    userId: r.userId,
    email: typeof r.email === 'string' ? r.email : '',
    nickname: typeof r.nickname === 'string' ? r.nickname : null,
    createdAt: r.createdAt,
    confirmSentAt: typeof r.confirmSentAt === 'number' ? r.confirmSentAt : null,
    followUpSentAt: typeof r.followUpSentAt === 'number' ? r.followUpSentAt : null,
    cancelToken: r.cancelToken,
    cancelledAt: typeof r.cancelledAt === 'number' ? r.cancelledAt : null,
    databaseDeleted: r.databaseDeleted === true,
  }
}

async function readNotice(userId: string): Promise<ParentNotice | null> {
  return asNotice(await store().get(noticeKey(userId), { type: 'json' }))
}

async function writeNotice(notice: ParentNotice): Promise<void> {
  await store().setJSON(noticeKey(notice.userId), notice)
  if (/^[a-f0-9]{64}$/.test(notice.cancelToken)) {
    await store().setJSON(tokenKey(notice.cancelToken), notice.userId)
  }
}

async function readIndex(): Promise<string[]> {
  const raw = await store().get('index', { type: 'json' })
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string')
}

async function addIndex(userId: string): Promise<void> {
  const ids = await readIndex()
  if (ids.includes(userId)) return
  await store().setJSON('index', [...ids, userId].slice(-5000))
}

function newToken(): string {
  return randomBytes(32).toString('hex')
}

export interface ScheduleInput {
  userId: string
  email: string
  nickname: unknown
  now: number
}

/** One notice per account. A second call does not move the day-later time. */
export async function scheduleParentNotice(input: ScheduleInput): Promise<ParentNotice | null> {
  if (!/^[0-9a-f-]{36}$/i.test(input.userId)) return null
  const email = input.email.trim().toLowerCase()
  if (!email.includes('@') || email.length > 320) return null
  const existing = await readNotice(input.userId)
  if (existing) return existing
  const notice: ParentNotice = {
    userId: input.userId,
    email,
    nickname: safeNickname(input.nickname),
    createdAt: input.now,
    confirmSentAt: null,
    followUpSentAt: null,
    cancelToken: newToken(),
    cancelledAt: null,
    databaseDeleted: false,
  }
  await writeNotice(notice)
  await addIndex(input.userId)
  return notice
}

function letter(notice: ParentNotice, kind: ParentMailKind, origin: string): { subject: string; text: string } | null {
  const link = cancelUrl(origin, notice.cancelToken)
  if (!link || !notice.email) return null
  if (kind === 'confirm') return parentConfirmLetter(notice.nickname, link)
  return parentFollowUpLetter(link)
}

async function sendOne(notice: ParentNotice, kind: ParentMailKind, origin: string, now: number): Promise<ParentNotice> {
  const apiKey = process.env.RESEND_API_KEY
  if (!parentMailEnabled(process.env.ACCOUNT_LEDGER_ENABLED, apiKey) || !apiKey) return notice
  const mail = letter(notice, kind, origin)
  if (!mail) return notice
  const link = cancelUrl(origin, notice.cancelToken)
  if (!link) return notice
  try {
    const from = process.env.PARENT_NOTICE_FROM?.trim() || PARENT_NOTICE_FROM
    const ok = await sendParentMail({
      apiKey,
      from,
      to: notice.email,
      subject: mail.subject,
      text: mail.text,
      html: parentNoticeHtml(mail.text, link),
    })
    if (!ok) return notice
  } catch {
    return notice
  }
  const next: ParentNotice = kind === 'confirm'
    ? { ...notice, confirmSentAt: now }
    : { ...notice, followUpSentAt: now, email: '' }
  await writeNotice(next)
  return next
}

/** Sends whatever is due for one account. Does nothing when mail is off. */
export async function deliverUserNotice(userId: string, origin: string, now = Date.now()): Promise<ParentNotice | null> {
  if (!parentMailEnabled(process.env.ACCOUNT_LEDGER_ENABLED, process.env.RESEND_API_KEY)) {
    return readNotice(userId)
  }
  let notice = await readNotice(userId)
  if (!notice) return null
  const due = dueParentMails(notice, now)
  if (due.includes('confirm')) notice = await sendOne(notice, 'confirm', origin, now)
  if (due.includes('followup') && notice.confirmSentAt != null) {
    notice = await sendOne(notice, 'followup', origin, now)
  }
  return notice
}

/** Hourly job. Returns immediately when mail is off, before any blob or database call. */
export async function deliverDueParentNotices(origin: string, now = Date.now()): Promise<{ sent: number; mail: boolean }> {
  if (!parentMailEnabled(process.env.ACCOUNT_LEDGER_ENABLED, process.env.RESEND_API_KEY)) {
    return { sent: 0, mail: false }
  }
  const ids = await readIndex()
  let sent = 0
  for (const id of ids) {
    const before = await readNotice(id)
    if (!before) continue
    const due = dueParentMails(before, now)
    const after = await deliverUserNotice(id, origin, now)
    if (!after) continue
    if (due.includes('confirm') && after.confirmSentAt != null && before.confirmSentAt == null) sent += 1
    if (due.includes('followup') && after.followUpSentAt != null && before.followUpSentAt == null) sent += 1
  }
  return { sent, mail: true }
}

export type CancelResult = 'missing' | 'deleted' | 'kept-row'

/** Cancel from the day-later email. Removes the notice email and the purchase PIN. Database only when the flag is on. */
export async function cancelParentNotice(token: string, now = Date.now()): Promise<CancelResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return 'missing'
  const userId = await store().get(tokenKey(token), { type: 'json' })
  if (typeof userId !== 'string') return 'missing'
  const notice = await readNotice(userId)
  if (!notice || notice.cancelToken !== token) return 'missing'
  if (notice.databaseDeleted) return 'deleted'
  await deletePinRecord(userId)
  const databaseDeleted = notice.databaseDeleted || await deleteAccountDatabase(userId, { now })
  await writeNotice({
    ...notice,
    email: '',
    nickname: null,
    cancelledAt: notice.cancelledAt ?? now,
    databaseDeleted,
  })
  return databaseDeleted ? 'deleted' : 'kept-row'
}

/** Account delete from the game. Drops the parent email from the notice. */
export async function deleteParentNotice(userId: string, now = Date.now(), databaseDeleted = false): Promise<void> {
  const notice = await readNotice(userId)
  if (!notice) return
  await writeNotice({
    ...notice,
    email: '',
    nickname: null,
    cancelledAt: notice.cancelledAt ?? now,
    databaseDeleted: notice.databaseDeleted || databaseDeleted,
  })
}
