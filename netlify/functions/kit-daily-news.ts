import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'
import { type JsonStore, KIT_NEWS_STORE, envForDeploy, handleDaily } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/** 13:20 and 14:20 UTC. The Toronto gate lets exactly one of those run send. */
export default function kitDailyNews(req: Request, context: Context): Promise<Response> {
  return handleDaily(req, { env: envForDeploy(process.env, context?.deploy?.context), store: store() })
}
