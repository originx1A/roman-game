import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { ANALYTICS_STORE, buildEvent, recordEvent } from '../lib/analytics.ts'

/** Player game → POST {id, ev, size?, ms?, vote?, note?}. Always answers 204 (the game ignores the answer). Stores no IP. */
export default async function ping(req: Request, context: Context): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  try {
    const text = await req.text()
    if (text.length > 2000) return new Response(null, { status: 204 })
    const ev = buildEvent(JSON.parse(text), context?.geo)
    if (ev) await recordEvent(getStore({ name: ANALYTICS_STORE }), ev)
  } catch {
    /* never bother the game */
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
