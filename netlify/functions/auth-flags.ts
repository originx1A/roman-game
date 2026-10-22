import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authFlags(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'flags')
}
