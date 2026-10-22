import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authAccount(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'account')
}
