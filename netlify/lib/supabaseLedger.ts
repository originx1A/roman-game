import type { SupabaseClient } from '@supabase/supabase-js'
import type { Entitlement, GiftCode, Ledger, Purchase } from './accountsLedger.ts'
import { dbNotReady } from './payGate.ts'

type Row = Record<string, unknown>

function purchaseFromRow(row: Row): Purchase {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    paymentIntentId: typeof row.payment_intent_id === 'string' ? row.payment_intent_id : null,
    playerId: String(row.player_id),
    itemType: 'pack',
    itemId: String(row.item_id),
    purpose: row.purpose === 'gift' ? 'gift' : 'self',
    status: row.status === 'revoked' || row.status === 'blocked' ? row.status : 'paid',
    coins: Number(row.coins) || 0,
    amountCents: Number(row.amount_cents) || 0,
    currency: String(row.currency || 'cad'),
    livemode: row.livemode === true,
    giftCodeId: typeof row.gift_code_id === 'string' ? row.gift_code_id : null,
    deviceClaimedAt: typeof row.device_claimed_at === 'string' ? row.device_claimed_at : null,
  }
}

function giftFromRow(row: Row): GiftCode {
  const status = row.status
  return {
    id: String(row.id),
    codeHash: String(row.code_hash),
    hint: String(row.code_hint),
    reveal: typeof row.reveal === 'string' ? row.reveal : null,
    buyerId: String(row.buyer_id),
    itemId: String(row.item_id),
    status: status === 'redeemed' || status === 'void' || status === 'cancelled' ? status : 'open',
    redeemedBy: typeof row.redeemed_by === 'string' ? row.redeemed_by : null,
    purchaseId: String(row.purchase_id),
    sessionId: String(row.session_id || ''),
    createdAt: String(row.created_at || ''),
  }
}

function giftToRow(row: GiftCode): Row {
  return {
    status: row.status,
    reveal: row.reveal,
    redeemed_by: row.redeemedBy,
    redeemed_at: row.status === 'redeemed' ? new Date().toISOString() : null,
  }
}

/** Service-role ledger. Callers must not log row contents that include a gift reveal. */
export function supabaseLedger(admin: SupabaseClient): Ledger {
  return {
    async findPurchaseBySession(sessionId) {
      const { data, error } = await admin.from('purchases').select('*').eq('session_id', sessionId).maybeSingle()
      if (error) {
        if (dbNotReady(error)) throw new Error('not_ready')
        throw new Error('purchase_read')
      }
      return data ? purchaseFromRow(data as Row) : null
    },
    async findPurchaseByPaymentIntent(paymentIntentId) {
      const { data, error } = await admin.from('purchases').select('*').eq('payment_intent_id', paymentIntentId).maybeSingle()
      if (error) throw new Error(dbNotReady(error) ? 'not_ready' : 'purchase_read')
      return data ? purchaseFromRow(data as Row) : null
    },
    async insertPurchase(row) {
      const { error } = await admin.from('purchases').insert({
        id: row.id,
        session_id: row.sessionId,
        payment_intent_id: row.paymentIntentId,
        player_id: row.playerId,
        item_type: row.itemType,
        item_id: row.itemId,
        purpose: row.purpose,
        status: row.status,
        coins: row.coins,
        amount_cents: row.amountCents,
        currency: row.currency,
        livemode: row.livemode,
        gift_code_id: row.giftCodeId,
      })
      if (error && error.code !== '23505') throw new Error(dbNotReady(error) ? 'not_ready' : 'purchase_write')
    },
    async savePurchase(row) {
      const { error } = await admin.from('purchases').update({ status: row.status }).eq('id', row.id)
      if (error) throw new Error('purchase_write')
    },
    async activeEntitlement(playerId, itemId) {
      const { data, error } = await admin
        .from('entitlements')
        .select('id')
        .eq('player_id', playerId)
        .eq('item_id', itemId)
        .is('revoked_at', null)
        .limit(1)
      if (error) throw new Error(dbNotReady(error) ? 'not_ready' : 'entitlement_read')
      return Array.isArray(data) && data.length > 0
    },
    async insertEntitlement(row: Entitlement) {
      const { error } = await admin.from('entitlements').insert({
        id: row.id,
        player_id: row.playerId,
        item_type: row.itemType,
        item_id: row.itemId,
        purchase_id: row.purchaseId,
        gift_code_id: row.giftCodeId,
        source: row.giftCodeId ? 'gift' : 'purchase',
      })
      if (error && error.code !== '23505') throw new Error('entitlement_write')
    },
    async revokeEntitlement(playerId, itemId, purchaseId, at) {
      const { error } = await admin
        .from('entitlements')
        .update({ revoked_at: at })
        .eq('player_id', playerId)
        .eq('item_id', itemId)
        .eq('purchase_id', purchaseId)
        .is('revoked_at', null)
      if (error) throw new Error('entitlement_write')
    },
    async insertGift(row) {
      const { error } = await admin.from('gift_codes').insert({
        id: row.id,
        code_hash: row.codeHash,
        code_hint: row.hint,
        reveal: row.reveal,
        buyer_id: row.buyerId,
        item_type: 'pack',
        item_id: row.itemId,
        status: row.status,
        purchase_id: row.purchaseId,
        session_id: row.sessionId,
        created_at: row.createdAt,
      })
      if (error && error.code !== '23505') throw new Error(dbNotReady(error) ? 'not_ready' : 'gift_write')
    },
    async findGiftByHash(codeHash) {
      const { data, error } = await admin.from('gift_codes').select('*').eq('code_hash', codeHash).maybeSingle()
      if (error) throw new Error(dbNotReady(error) ? 'not_ready' : 'gift_read')
      return data ? giftFromRow(data as Row) : null
    },
    async findGiftBySession(sessionId) {
      const { data, error } = await admin.from('gift_codes').select('*').eq('session_id', sessionId).maybeSingle()
      if (error) throw new Error(dbNotReady(error) ? 'not_ready' : 'gift_read')
      return data ? giftFromRow(data as Row) : null
    },
    async saveGift(row) {
      let query = admin.from('gift_codes').update(giftToRow(row)).eq('id', row.id)
      if (row.status === 'redeemed') query = query.eq('status', 'open')
      const { data, error } = await query.select('id')
      if (error) throw new Error('gift_write')
      return Array.isArray(data) && data.length > 0 ? 'ok' : 'lost'
    },
    async creditCoins(playerId, op, amount) {
      if (amount <= 0) return
      const { error } = await admin.rpc('apply_stripe_credit', { player: playerId, op, amount })
      if (error) throw new Error(dbNotReady(error) ? 'not_ready' : 'credit')
    },
    async debitCoins(playerId, op, amount) {
      if (amount <= 0) return 0
      const { data, error } = await admin.rpc('revoke_stripe_coins', { player: playerId, op, amount })
      if (error) throw new Error('debit')
      const removed = (data as { removed?: number } | null)?.removed
      return typeof removed === 'number' ? removed : 0
    },
    async seenEvent(eventId) {
      const { data, error } = await admin.from('stripe_events').select('event_id').eq('event_id', eventId).maybeSingle()
      if (error) throw new Error(dbNotReady(error) ? 'not_ready' : 'event_read')
      return !!data
    },
    async markEvent(eventId, eventType) {
      const { error } = await admin.from('stripe_events').insert({ event_id: eventId, event_type: eventType })
      if (error && error.code !== '23505') throw new Error('event_write')
    },
  }
}
