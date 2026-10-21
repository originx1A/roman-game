import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authPasswordChange(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'password-change')
}
