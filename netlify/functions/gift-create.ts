import { getStore } from '@netlify/blobs'
import { json, siteBase } from '../lib/http.ts'
import { cleanGiftNote, giftShareMessage } from '../../src/game/pets.ts'
import { createGift, GIFT_STORE, OWNER_KEY_ENV, ownerKeyConfigured, ownerKeyMatches, parseGift } from '../lib/gifts.ts'

/** Owner only: POST {key, gift, note?} → {code, link}. */
export default async function giftCreate(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ownerKeyConfigured()) return json({ error: `Gifting isn't set up: add ${OWNER_KEY_ENV} in Netlify.`, configured: false }, 503)
  let body: { key?: unknown; gift?: unknown; note?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (!ownerKeyMatches(body.key)) {
    await new Promise((r) => setTimeout(r, 600))
    return json({ error: 'Wrong owner passphrase.' }, 401)
  }
  const gift = parseGift(body.gift)
  if (!gift) return json({ error: 'That gift isn’t valid.' }, 400)
  try {
    const store = getStore({ name: GIFT_STORE, consistency: 'strong' })
    const code = await createGift(store, gift, typeof body.note === 'string' ? body.note : '')
    const link = `${siteBase()}/?gift=${code}`
    const note = cleanGiftNote(body.note)
    return json({ ok: true, code, gift, note, link, message: giftShareMessage({ gift, code, link, note }) })
  } catch (err) {
    console.error('gift-create failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not save the code. Try again.' }, 502)
  }
}
