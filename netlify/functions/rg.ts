import { handle, type Env } from '../lib/rewrite/server.ts'

interface Context {
  geo?: { country?: { code?: string } }
  deploy?: { context?: string }
}

/** One router for the rewrite. Preview sends mail and accepts Stripe test keys only. */
export default async function rg(req: Request, context: Context = {}): Promise<Response> {
  const env: Env = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RG_DEV_MAILBOX: process.env.RG_DEV_MAILBOX,
    CONTEXT: context.deploy?.context || process.env.CONTEXT,
    URL: process.env.URL,
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    NETLIFY: process.env.NETLIFY,
    country: context.geo?.country?.code ?? null,
  }
  return handle(req, env)
}
