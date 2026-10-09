import { getStore } from '@netlify/blobs'
import { json, siteBase } from '../lib/http.ts'
import { ownerGate } from '../lib/ownerGate.ts'
import { cleanGiftNote, giftShareMessage } from '../../src/game/pets.ts'
import { createGift, GIFT_STORE, parseGift } from '../lib/gifts.ts'

/** Owner only: POST {key, gift, note?} → {code, link}. */
export default async function giftCreate(req: Request): Promise<Response> {
  const gate = await ownerGate(req)
  if (gate.res) return gate.res
  const body = gate.body as { key?: unknown; gift?: unknown; note?: unknown }
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
