import { getStore } from '@netlify/blobs'
import { type JsonStore, KIT_NEWS_STORE, handleDaily } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/** 13:20 and 14:20 UTC. The Toronto gate lets exactly one of those run send. */
export default function kitDailyNews(req: Request): Promise<Response> {
  return handleDaily(req, { env: process.env, store: store() })
}
