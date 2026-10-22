import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverLostFinish(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-lost-finish')
}
