import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { type JsonStore, KIT_NEWS_STORE, envForDeploy, handleWebhook } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/**
 * POST /api/kit-webhook — header X-Kit-Webhook-Secret.
 * The marketing-site signup bar posts straight to Kit, outside this repo.
 * Point a Kit webhook here so those subscribers are tagged and welcomed.
 */
export default function kitWebhook(req: Request, context: Context): Promise<Response> {
  return handleWebhook(req, { env: envForDeploy(process.env, context?.deploy?.context), store: store() })
}
