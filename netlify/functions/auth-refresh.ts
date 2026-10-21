import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRefresh(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'refresh')
}
