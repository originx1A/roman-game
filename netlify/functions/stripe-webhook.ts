import { getStore } from '@netlify/blobs'
import { AUDIO_GRANT_STORE } from '../lib/audioGrant.ts'
import { handleAudiobookWebhook } from '../lib/audioWebhook.ts'
import { json } from '../lib/http.ts'

/** Stripe signs the raw body. Coin-pack events are ignored so the existing shop keeps working. */
export default async function stripeWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')
  const store = getStore({ name: AUDIO_GRANT_STORE, consistency: 'strong' })
  const result = await handleAudiobookWebhook({ payload, signature, store })
  return json(result.body, result.status)
}
