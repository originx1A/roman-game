import { getStore } from '@netlify/blobs'
import { type JsonStore, KIT_NEWS_STORE, handleSendNow } from '../lib/kitNews.ts'

function store(): JsonStore {
  return getStore({ name: KIT_NEWS_STORE, consistency: 'strong' }) as unknown as JsonStore
}

/** POST /api/kit-send-now — header X-Kit-Admin-Secret. */
export default function kitSendNow(req: Request): Promise<Response> {
  return handleSendNow(req, { env: process.env, store: store() })
}
