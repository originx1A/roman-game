import type { AuthDeps } from './authHandler.ts'

function page(status: number, title: string, text: string): Response {
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${text}</p></body></html>`
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** The parent opens this from their email. It saves the recovery address and does not create an account. */
export async function approveParentHold(req: Request, deps: AuthDeps): Promise<Response> {
  if (req.method !== 'GET') return page(405, 'Not available', 'Open the link from the email.')
  const token = new URL(req.url).searchParams.get('token')?.trim() || ''
  if (token.length < 12) return page(400, 'That link does not work', 'Ask for a new email from the account.')
  const approved = await deps.backend.approveParentEmail(deps.hashCard(token), new Date(deps.now()).toISOString())
  if (!approved) return page(400, 'That link does not work', 'It may have expired. Ask for a new email from the account.')
  return page(
    200,
    'Recovery email saved',
    'This address can receive recovery codes for that account. No account was created for you, and this does not turn on purchases.',
  )
}
