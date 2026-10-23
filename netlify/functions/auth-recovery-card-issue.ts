import { handleAuthRequest } from '../lib/authHandler.ts'

export default function authRecoveryCardIssue(req: Request): Promise<Response> {
  return handleAuthRequest(req, 'recovery-card-issue')
}
