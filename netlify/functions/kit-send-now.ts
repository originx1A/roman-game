import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { type JsonStore, KIT_NEWS_STORE, envForDeploy, handleSendNow } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/** POST /api/kit-send-now — header X-Kit-Admin-Secret. */
export default function kitSendNow(req: Request, context: Context): Promise<Response> {
  return handleSendNow(req, { env: envForDeploy(process.env, context?.deploy?.context), store: store() })
}
