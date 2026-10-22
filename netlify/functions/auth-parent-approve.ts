import { productionDeps } from '../lib/authHandler.ts'
import { approveParentHold } from '../lib/parentApprove.ts'

export default function authParentApprove(req: Request): Promise<Response> {
  const deps = productionDeps()
  if (!deps) {
    return Promise.resolve(new Response('Accounts are not set up yet.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))
  }
  return approveParentHold(req, deps)
}
