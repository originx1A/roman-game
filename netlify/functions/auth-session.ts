import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authSession(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'session')
}
