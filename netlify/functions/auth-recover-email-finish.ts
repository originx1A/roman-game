import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverEmailFinish(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-email-finish')
}
