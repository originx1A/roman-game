import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authSignin(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'signin')
}
