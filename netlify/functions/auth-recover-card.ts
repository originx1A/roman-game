import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverCard(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-card')
}
