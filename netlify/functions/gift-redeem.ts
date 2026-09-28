import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { GIFT_CODE_RE, normalizeGiftCode } from '../../src/game/pets.ts'
import { GIFT_STORE, peekGift, redeemGift } from '../lib/gifts.ts'

/** Player: POST {code} → {ok, gift, note} the first time only. POST {code, peek: true} just shows it. */
export default async function giftRedeem(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let code: unknown
  let peek = false
  try {
    const body = (await req.json()) as { code?: unknown; peek?: unknown }
    code = body.code
    peek = body.peek === true
  } catch {
    return json({ ok: false, reason: 'Missing code' }, 400)
  }
  if (typeof code !== 'string' || !GIFT_CODE_RE.test(normalizeGiftCode(code))) {
    return json({ ok: false, reason: 'That doesn’t look like a gift code (like ROMA-7K2P).' }, 400)
  }
  try {
    const store = getStore({ name: GIFT_STORE, consistency: 'strong' })
    const out = peek ? await peekGift(store, code) : await redeemGift(store, code)
    if (!out.ok) return json({ ok: false, code: out.code, reason: out.reason }, out.status)
    return json({ ok: true, peek, code: out.code, gift: out.gift, note: out.note })
  } catch (err) {
    console.error('gift-redeem failed', err instanceof Error ? err.message : 'error')
    return json({ ok: false, reason: 'Gifts are unavailable right now. Try again later.' }, 502)
  }
}
