import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authSignout(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'signout')
}
