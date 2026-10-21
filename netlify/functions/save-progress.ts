import { parseSaveBody } from '../lib/accountsRules.ts'
import { json } from '../lib/http.ts'
import { requireUser, userToken } from '../lib/payGate.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

export interface SaveDeps {
  userId(token: string): Promise<string | null>
  write(playerId: string, profileId: string, blob: Record<string, unknown>, chapters: string[], videos: string[], cards: string[]): Promise<boolean>
  read(playerId: string, profileId: string): Promise<{ blob: unknown; chapters: unknown; videos: unknown; cards: unknown } | null>
}

function liveDeps(): SaveDeps {
  return {
    userId: requireUser,
    async write(playerId, profileId, blob, chapters, videos, cards) {
      const admin = supabaseAdmin()
      if (!admin) return false
      const now = new Date().toISOString()
      const save = await admin.from('player_saves').upsert({
        player_id: playerId,
        profile_id: profileId,
        blob,
        updated_at: now,
      })
      if (save.error) return false
      const progress = await admin.from('site_progress').upsert({
        player_id: playerId,
        profile_id: profileId,
        chapters,
        videos,
        cards,
        updated_at: now,
      })
      return !progress.error
    },
    async read(playerId, profileId) {
      const admin = supabaseAdmin()
      if (!admin) return null
      const { data: save } = await admin.from('player_saves').select('blob').eq('player_id', playerId).eq('profile_id', profileId).maybeSingle()
      const { data: progress } = await admin.from('site_progress').select('chapters, videos, cards').eq('player_id', playerId).eq('profile_id', profileId).maybeSingle()
      if (!save && !progress) return null
      return {
        blob: save?.blob ?? {},
        chapters: progress?.chapters ?? [],
        videos: progress?.videos ?? [],
        cards: progress?.cards ?? [],
      }
    },
  }
}

/**
 * Saves this profile's progress on the server.
 * Writes player_saves and site_progress only. Does not replace public.save_progress.
 * The same-named RPC, when this migration creates it, writes those two tables for auth.uid().
 */
export async function handleSaveProgress(req: Request, deps: SaveDeps = liveDeps()): Promise<Response> {
  const playerId = await deps.userId(userToken(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)

  if (req.method === 'GET') {
    const profileId = new URL(req.url).searchParams.get('profileId') || ''
    const parsed = parseSaveBody({ profileId, blob: {}, chapters: [], videos: [], cards: [] })
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
    const row = await deps.read(playerId, parsed.profileId)
    if (!row) return json({ ok: true, blob: {}, chapters: [], videos: [], cards: [] })
    return json({ ok: true, ...row })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Missing save.' }, 400)
  }
  const parsed = parseSaveBody(body)
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
  const wrote = await deps.write(playerId, parsed.profileId, parsed.blob, parsed.chapters, parsed.videos, parsed.cards)
  if (!wrote) return json({ ok: false, error: 'Accounts are not set up yet.' }, 503)
  return json({ ok: true })
}

export default function saveProgress(req: Request): Promise<Response> {
  return handleSaveProgress(req)
}
