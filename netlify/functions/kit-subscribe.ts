import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { type JsonStore, KIT_NEWS_STORE, envForDeploy, handleSubscribe } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/** POST /api/kit-subscribe — in-game opt-in and the /news/ signup bar. */
export default function kitSubscribe(req: Request, context: Context): Promise<Response> {
  return handleSubscribe(req, { env: envForDeploy(process.env, context?.deploy?.context), store: store() })
}
