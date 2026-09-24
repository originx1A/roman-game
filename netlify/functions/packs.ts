import { publicPackCatalog, WEB_CURRENCY } from '../lib/coinPacks.ts'
import { json } from '../lib/http.ts'

/** Public price list for the website shop. No Stripe secret is used. */
export default async function packs(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json({ error: 'Method not allowed' }, 405)
  }
  return json({ currency: WEB_CURRENCY, packs: publicPackCatalog() })
}
