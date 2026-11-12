import type { Context } from '@netlify/functions'

/**
 * 9.33-a19: same-origin proxy for the hub's public sponsors feed.
 *
 * The game (play.romansgame.com) and the sponsor system (romansgame.com)
 * live on different origins, and sponsors-public sends no CORS headers,
 * so the browser cannot read it cross-origin. This function reads it
 * server-side and re-serves the JSON on the game's own origin. It is a
 * read-only pass-through: it writes nothing, holds no keys, and returns
 * only what the public feed already publishes.
 *
 * Upstream defaults to the production feed. SPONSORS_FEED_URL (env) can
 * point a non-production deploy at another feed (e.g. a hub branch
 * preview running against the test sponsor store) without code changes.
 * Production reads the production feed (env or DEFAULT_UPSTREAM) and
 * nothing else — no branch override exists in this file.
 */
const DEFAULT_UPSTREAM = 'https://romansgame.com/.netlify/functions/sponsors-public'

export default async function sponsorsFeed(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'GET') return new Response(null, { status: 405 })
  const upstream = (process.env.SPONSORS_FEED_URL || DEFAULT_UPSTREAM).trim()
  try {
    const r = await fetch(upstream, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    const body = await r.text()
    return new Response(body, {
      status: r.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // The feed itself is no-store; a short shared cache here keeps a
        // busy front door from hammering the hub function on every visit.
        'cache-control': 'public, max-age=60',
      },
    })
  } catch {
    return new Response(JSON.stringify({ ok: false, code: 'upstream' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
}
