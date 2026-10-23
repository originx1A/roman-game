import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authName(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'name')
}
