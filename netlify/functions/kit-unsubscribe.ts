import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { type JsonStore, KIT_NEWS_STORE, envForDeploy, handleUnsubscribe } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/** GET or POST /api/kit-unsubscribe?token=… — one-click and mailbox List-Unsubscribe. */
export default function kitUnsubscribe(req: Request, context: Context): Promise<Response> {
  return handleUnsubscribe(req, { env: envForDeploy(process.env, context?.deploy?.context), store: store() })
}
