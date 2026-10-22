import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authFamily(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'family')
}
