import { type JsonStore, handleFeed } from '../lib/kitNews.ts'

const store: JsonStore = {
  async get() {
    return null
  },
  async setJSON() {
    return { modified: false }
  },
  async delete() {
    return undefined
  },
}

/** RSS 2.0 for the published Roman's World News index. */
export default function newsFeed(req: Request): Promise<Response> {
  let selfUrl = 'https://play.romansgame.com/news/feed.xml'
  try {
    selfUrl = new URL('/news/feed.xml', req.url).toString()
  } catch {
    /* keep the public fallback */
  }
  return handleFeed({ env: process.env, store }, selfUrl)
}
