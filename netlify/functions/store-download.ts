import { getStore } from '@netlify/blobs'
import { audioFiles } from '../../src/store/catalog.ts'
import { AUDIO_GRANT_STORE, isDownloadToken, recordDownload } from '../lib/audioGrant.ts'
import { presignR2Get, r2Settings } from '../lib/r2Sign.ts'

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Checks the download token, then redirects to a 15-minute R2 URL for that story's master file. */
export default async function storeDownload(req: Request): Promise<Response> {
  if (req.method !== 'GET') return text('Method not allowed', 405)
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const slug = url.searchParams.get('slug')
  if (!isDownloadToken(token) || !slug || !audioFiles(slug)) return text('This download link is not valid.', 404)

  const settings = r2Settings()
  if (!settings) return text('Downloads are unavailable right now.', 503)

  const claimed = await recordDownload(getStore({ name: AUDIO_GRANT_STORE, consistency: 'strong' }), token, slug)
  if (!claimed.ok) {
    if (claimed.reason === 'expired') return text('This download link has expired.', 410)
    if (claimed.reason === 'limit') return text('This story has reached its download limit.', 429)
    return text('This download link is not valid.', 404)
  }

  const master = audioFiles(slug)?.master
  if (!master) return text('This download link is not valid.', 404)
  const signed = presignR2Get({ ...settings, key: master })
  return new Response(null, {
    status: 302,
    headers: { Location: signed, 'cache-control': 'no-store' },
  })
}
