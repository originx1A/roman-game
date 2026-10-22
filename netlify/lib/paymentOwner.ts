import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin.ts'

export type OwnerSnapshot = {
  ownerRole: 'adult' | null
  ownerAssumedAt: string | null
  ownerEmail: string | null
}

export type PaymentEvidence = {
  userId: string
  action: 'attached' | 'detached'
  stripeEventId: string | null
  stripePaymentMethodId: string | null
  stripeCustomerId: string | null
  occurredAt: string
  deviceUaHash: string | null
  deviceUa: string | null
  ipHash: string | null
}

export function emptyOwner(): OwnerSnapshot {
  return { ownerRole: null, ownerAssumedAt: null, ownerEmail: null }
}

/** A verified card makes this account adult-owned. The first time sticks. */
export function attachOwner(current: OwnerSnapshot, at: string, email: string | null): OwnerSnapshot {
  if (current.ownerRole === 'adult') {
    return {
      ownerRole: 'adult',
      ownerAssumedAt: current.ownerAssumedAt ?? at,
      ownerEmail: email || current.ownerEmail,
    }
  }
  return { ownerRole: 'adult', ownerAssumedAt: at, ownerEmail: email }
}

/** No card left: kid mode. Purchases stop. Evidence rows stay. */
export function clearOwner(): OwnerSnapshot {
  return emptyOwner()
}

export function clipDevice(ua: string | null | undefined): string | null {
  if (!ua) return null
  const clean = ua.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.slice(0, 180)
}

type FlagRow = {
  owner_role?: string | null
  owner_assumed_at?: string | null
  owner_email?: string | null
}

function snapshotFrom(row: FlagRow | null): OwnerSnapshot {
  if (!row || row.owner_role !== 'adult') return emptyOwner()
  return {
    ownerRole: 'adult',
    ownerAssumedAt: row.owner_assumed_at ? String(row.owner_assumed_at) : null,
    ownerEmail: row.owner_email ? String(row.owner_email) : null,
  }
}

export async function readOwner(admin: SupabaseClient, userId: string): Promise<OwnerSnapshot> {
  const { data, error } = await admin
    .from('account_flags')
    .select('owner_role, owner_assumed_at, owner_email')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return emptyOwner()
  return snapshotFrom(data as FlagRow)
}

export async function writeOwner(admin: SupabaseClient, userId: string, owner: OwnerSnapshot): Promise<void> {
  const { data } = await admin.from('account_flags').select('user_id').eq('user_id', userId).maybeSingle()
  const fields = {
    owner_role: owner.ownerRole,
    owner_assumed_at: owner.ownerAssumedAt,
    owner_email: owner.ownerEmail,
    updated_at: new Date().toISOString(),
  }
  if (data) {
    const { error } = await admin.from('account_flags').update(fields).eq('user_id', userId)
    if (error) throw new Error('owner')
    return
  }
  const { error } = await admin.from('account_flags').insert({ user_id: userId, ...fields })
  if (error) throw new Error('owner')
}

export async function addEvidence(admin: SupabaseClient, row: PaymentEvidence): Promise<void> {
  const { error } = await admin.from('payment_evidence').insert({
    user_id: row.userId,
    action: row.action,
    stripe_event_id: row.stripeEventId,
    stripe_payment_method_id: row.stripePaymentMethodId,
    stripe_customer_id: row.stripeCustomerId,
    occurred_at: row.occurredAt,
    device_ua_hash: row.deviceUaHash,
    device_ua: clipDevice(row.deviceUa),
    ip_hash: row.ipHash,
  })
  if (error && !/duplicate|23505/i.test(`${error.code || ''} ${error.message || ''}`)) throw new Error('evidence')
}

export async function userForCustomer(admin: SupabaseClient, customerId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('payment_evidence')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .order('occurred_at', { ascending: false })
    .limit(1)
  if (error || !Array.isArray(data) || data.length === 0) return null
  const id = (data[0] as { user_id?: unknown }).user_id
  return typeof id === 'string' ? id : null
}

export async function disablePayments(admin: SupabaseClient, userId: string): Promise<void> {
  await admin
    .from('account_payments')
    .update({ payments_enabled: false, updated_at: new Date().toISOString() })
    .eq('player_id', userId)
}

export async function noteCardAttached(
  admin: SupabaseClient,
  input: {
    userId: string
    at: string
    email: string | null
    evidence: Omit<PaymentEvidence, 'userId' | 'action' | 'occurredAt'>
  },
): Promise<OwnerSnapshot> {
  const current = await readOwner(admin, input.userId)
  const next = attachOwner(current, input.at, input.email)
  await writeOwner(admin, input.userId, next)
  await addEvidence(admin, {
    userId: input.userId,
    action: 'attached',
    occurredAt: input.at,
    ...input.evidence,
  })
  return next
}

export async function noteCardDetached(
  admin: SupabaseClient,
  input: {
    userId: string
    at: string
    remaining: number | null
    evidence: Omit<PaymentEvidence, 'userId' | 'action' | 'occurredAt'>
  },
): Promise<OwnerSnapshot> {
  await addEvidence(admin, {
    userId: input.userId,
    action: 'detached',
    occurredAt: input.at,
    ...input.evidence,
  })
  if (input.remaining == null || input.remaining > 0) return readOwner(admin, input.userId)
  const next = clearOwner()
  await writeOwner(admin, input.userId, next)
  await disablePayments(admin, input.userId)
  return next
}

export function ownerAdmin(): SupabaseClient | null {
  return supabaseAdmin()
}
