import { PUBLIC_MEDIA_CACHE, isPublicAudioKey } from '../lib/publicMedia.ts'
import { presignR2Get, r2Settings } from '../lib/r2Sign.ts'

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Presigns a public store file: the free Saga 1 master, samples, and covers.
 * Anything else, including every paid master, is not found.
 */
export default async function storeMedia(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return text('Method not allowed', 405)
  const key = new URL(req.url).searchParams.get('key')
  if (!isPublicAudioKey(key)) return text('Not found', 404)

  const settings = r2Settings()
  if (!settings) return text('Audio is unavailable right now.', 503)

  const signed = presignR2Get({ ...settings, key })
  return new Response(null, {
    status: 302,
    headers: { Location: signed, 'cache-control': PUBLIC_MEDIA_CACHE },
  })
}
