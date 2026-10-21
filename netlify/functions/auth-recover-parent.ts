import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoverParent(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recover-parent')
}
