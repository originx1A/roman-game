export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export const PURCHASES_UNAVAILABLE = 'Purchases are unavailable right now.'

/** Netlify sets URL to the site the player is actually on, including local dev. */
export function siteBase(): string {
  const raw = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888'
  return raw.replace(/\/$/, '')
}
