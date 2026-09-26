import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { isShareId, newShareId, sanitizeShare, type ShareRecord } from '../../src/game/shareRecord.ts'

const STORE = 'roman-share-links'

export interface ShareStore {
  setJSON(key: string, value: ShareRecord): Promise<unknown>
  get(key: string): Promise<ShareRecord | null>
}

export function blobShareStore(): ShareStore {
  const store = getStore({ name: STORE, consistency: 'strong' })
  return {
    setJSON: (key, value) => store.setJSON(key, value),
    get: async (key) => {
      const value = (await store.get(key, { type: 'json' })) as ShareRecord | null
      return value ?? null
    },
  }
}

export async function handleShare(req: Request, store: ShareStore): Promise<Response> {
  if (req.method === 'POST') {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Missing share' }, 400)
    }
    const saved = sanitizeShare(body)
    if (!saved) return json({ error: 'Missing share' }, 400)
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = newShareId()
      const existing = await store.get(id)
      if (existing) continue
      await store.setJSON(id, saved)
      return json({ id })
    }
    return json({ error: 'Could not save link' }, 500)
  }

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    if (!isShareId(id)) return json({ error: 'Missing share' }, 400)
    const saved = await store.get(id)
    if (!saved?.payload) return json({ error: 'Missing share' }, 404)
    return json(saved)
  }

  return json({ error: 'Method not allowed' }, 405)
}

/** POST /api/share stores a challenge or duel. GET /api/share?id= returns it. */
export default function share(req: Request): Promise<Response> {
  return handleShare(req, blobShareStore())
}
