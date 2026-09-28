import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { GIFT_CODE_RE, normalizeGiftCode } from '../../src/game/pets.ts'
import { GIFT_STORE, redeemGift } from '../lib/gifts.ts'

/** Player: POST {code} → {ok, gift} the first time only. */
export default async function giftRedeem(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let code: unknown
  try {
    code = ((await req.json()) as { code?: unknown }).code
  } catch {
    return json({ ok: false, reason: 'Missing code' }, 400)
  }
  if (typeof code !== 'string' || !GIFT_CODE_RE.test(normalizeGiftCode(code))) {
    return json({ ok: false, reason: 'That doesn’t look like a gift code (like ROMA-7K2P).' }, 400)
  }
  try {
    const store = getStore({ name: GIFT_STORE, consistency: 'strong' })
    const out = await redeemGift(store, code)
    if (!out.ok) return json({ ok: false, code: out.code, reason: out.reason }, out.status)
    return json({ ok: true, code: out.code, gift: out.gift })
  } catch (err) {
    console.error('gift-redeem failed', err instanceof Error ? err.message : 'error')
    return json({ ok: false, reason: 'Gifts are unavailable right now. Try again later.' }, 502)
  }
}
