import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authSignup(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'signup')
}
