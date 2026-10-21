import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverEmailStart(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-email-start')
}
