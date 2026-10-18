import { audioMediaEnabled, audioSalesEnabled } from '../lib/audioSales.ts'
import { json } from '../lib/http.ts'

/** Tells the store page whether Buy buttons and private-bucket media should appear. */
export default async function storeSales(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  return json({ enabled: audioSalesEnabled(), media: audioMediaEnabled() })
}
