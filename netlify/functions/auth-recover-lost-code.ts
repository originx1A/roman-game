import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverLostCode(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-lost-code')
}
