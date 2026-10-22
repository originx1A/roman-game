import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverLostStart(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-lost-start')
}
