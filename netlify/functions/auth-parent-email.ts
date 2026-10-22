import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authParentEmail(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'parent-email')
}
