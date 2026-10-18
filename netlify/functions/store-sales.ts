import { audioSalesEnabled, publicAudioBase } from '../lib/audioSales.ts'
import { json } from '../lib/http.ts'

/** Tells the store page whether Buy buttons should replace Coming soon, and where public files live. */
export default async function storeSales(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  return json({ enabled: audioSalesEnabled(), publicBase: publicAudioBase() })
}
