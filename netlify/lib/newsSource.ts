/**
 * Published Roman's World News stories.
 *
 * The daily publisher is not in this repo. https://romansgame.com/news/ is a
 * separate static site (footer build tag v2026-10-15n as of 2026-10-18). Posts
 * are hand-built HTML deployed together. There is no pool, queue, used-flag,
 * or 09:07 scheduler in originx1A/roman-game. The index lists whatever was
 * last deployed. This module reads that published index so the feed and the
 * morning email stay current without a second copy of the stories.
 */
import { canonicalNewsUrl, sanitizeEmailHtml } from './emailLinks.ts'
import { editionInstant, rfc822Utc } from './newsTime.ts'

export const NEWS_INDEX_URL = 'https://romansgame.com/news/'
export const CHANNEL_TITLE = "Roman's World News"
export const CHANNEL_DESCRIPTION =
  "Daily news from the world of Roman's Game — gossip, weather, drama, throne sightings, and site news."
export const PLAY_URL = 'https://play.romansgame.com'

export const SHARE_PITCH =
  "You're on the morning list. Share this story with someone who'd like the realm, catch up at https://romansgame.com/news/ , or play free at https://play.romansgame.com ."

export interface Story {
  /** Stable slug. RSS guid. Never a full URL. */
  id: string
  title: string
  excerpt: string
  link: string
  /** YYYY-MM-DD from the published card */
  date: string
  image?: string
  sourceIndex: number
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

export function storyIdFromHref(href: string): string {
  const clean = href.split('?')[0]?.split('#')[0] ?? href
  const parts = clean.split('/').filter(Boolean)
  const last = parts[parts.length - 1] ?? 'story'
  return last.replace(/\.html?$/i, '')
}

function textOf(inner: string, kind: 'h2' | 'nex' | 'nmeta'): string {
  const re = kind === 'h2'
    ? /<h2[^>]*>([\s\S]*?)<\/h2>/i
    : new RegExp(`<div[^>]*class="[^"]*\\b${kind}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i')
  const raw = re.exec(inner)?.[1] ?? ''
  return decodeHtml(raw.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Cards from the published /news/ index. Order is the page order. */
export function parseNewsIndex(html: string, base = NEWS_INDEX_URL): Story[] {
  const stories: Story[] = []
  const re = /<a\b([^>]*\bclass="[^"]*\bncard\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const attrs = match[1] ?? ''
    const inner = match[2] ?? ''
    const href = /href="([^"]+)"/i.exec(attrs)?.[1]
    if (!href) continue
    const title = textOf(inner, 'h2')
    const excerpt = textOf(inner, 'nex')
    const date = textOf(inner, 'nmeta')
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const img = /<img\b[^>]*\bsrc="([^"]+)"/i.exec(inner)?.[1]
    let link = href
    let image: string | undefined
    try {
      link = new URL(href, base).toString()
      if (img) image = new URL(img, base).toString()
    } catch {
      continue
    }
    stories.push({
      id: storyIdFromHref(href),
      title,
      excerpt,
      link,
      date,
      image,
      sourceIndex: stories.length,
    })
  }
  return stories
}

export function parseStoryPageImage(html: string, pageUrl: string): string | undefined {
  const og = /<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/i.exec(html)
    ?? /<meta\b[^>]*content="([^"]+)"[^>]*property="og:image"/i.exec(html)
  const src = og?.[1] ?? /<img\b[^>]*\bsrc="([^"]+)"/i.exec(html)?.[1]
  if (!src) return undefined
  try {
    return new URL(src, pageUrl).toString()
  } catch {
    return undefined
  }
}

/** Newest edition date first. Same date keeps the publisher's page order. */
export function storiesNewestFirst(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => b.date.localeCompare(a.date) || a.sourceIndex - b.sourceIndex)
}

/** Newest story whose published date is this Toronto date, or null. */
export function storyForDate(stories: Story[], dateKey: string): Story | null {
  return storiesNewestFirst(stories).find((story) => story.date === dateKey) ?? null
}

export function renderRss(stories: Story[], selfUrl = `${NEWS_INDEX_URL}feed.xml`): string {
  const items = storiesNewestFirst(stories).map((story) => {
    const when = editionInstant(story.date)
    const pub = Number.isNaN(when.getTime()) ? '' : rfc822Utc(when)
    return [
      '    <item>',
      `      <title>${xmlEscape(story.title)}</title>`,
      `      <description>${xmlEscape(story.excerpt)}</description>`,
      `      <link>${xmlEscape(story.link)}</link>`,
      `      <pubDate>${pub}</pubDate>`,
      `      <guid isPermaLink="false">${xmlEscape(story.id)}</guid>`,
      '    </item>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${xmlEscape(CHANNEL_TITLE)}</title>`,
    `    <link>${xmlEscape(NEWS_INDEX_URL)}</link>`,
    `    <description>${xmlEscape(CHANNEL_DESCRIPTION)}</description>`,
    `    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xmlEscape(selfUrl)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

/**
 * Classic Kit templates wrap this body and add their own chrome.
 * The liquid tags are required so the send still has an unsubscribe link
 * and a postal address if the template does not inject them.
 * They are left unescaped on purpose.
 * Amazon hosts are rewritten to this story's romansgame.com/news/ URL
 * (or dropped when the story link is not one). See emailLinks.ts.
 */
export function broadcastHtml(story: Story): string {
  const image = story.image
    ? `<p><img src="${xmlEscape(story.image)}" alt="${xmlEscape(story.title)}"></p>`
    : ''
  const html = [
    `<h1>${xmlEscape(story.title)}</h1>`,
    `<p>${xmlEscape(story.excerpt)}</p>`,
    image,
    `<p><a href="${xmlEscape(story.link)}">Read today's story</a></p>`,
    `<p>${xmlEscape(SHARE_PITCH)}</p>`,
    '<p><a href="{{ unsubscribe_url }}">Unsubscribe</a></p>',
    '<p>{{ address }}</p>',
  ].filter(Boolean).join('\n')
  return sanitizeEmailHtml(html, canonicalNewsUrl(story.link))
}

export async function loadPublishedStories(fetchImpl: typeof fetch, indexUrl = NEWS_INDEX_URL): Promise<Story[]> {
  const res = await fetchImpl(indexUrl, { headers: { accept: 'text/html' } })
  if (!res.ok) throw new Error(`news index HTTP ${res.status}`)
  return parseNewsIndex(await res.text(), indexUrl)
}
