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
  /**
   * Set from `data-keep-quotes` on the card `<h2>`.
   * When true, a wrapping quote pair stays in the Kit subject.
   */
  keepTitleQuotes?: boolean
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
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&apos;|&#x27;/g, "'")
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&amp;/g, '&')
}

const WRAP_PAIRS = new Set(['""', "''", '\u201C\u201D', '\u2018\u2019'])

function escapedAt(value: string, index: number): boolean {
  let slashes = 0
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i -= 1) slashes += 1
  return slashes % 2 === 1
}

/** Turn `\"` and `\'` (and the curly equivalents) into real quote characters. `\\` stays a backslash. */
function unescapeTitleQuotes(value: string): string {
  return value.replace(/\\([\\"'\u201C\u201D\u2018\u2019])/g, '$1')
}

/**
 * Title text for the Kit subject (and thumbnail alt).
 *
 * Published cards sometimes include the YAML or JSON quotes around the
 * heading, so the `<h2>` text is `"Throne Weather — …"` after HTML decode.
 * One matching wrapping pair is removed: straight `"` or `'`, or curly
 * `“…”` / `‘…’`. Quotes inside the title are left in place. Only one pair
 * is removed.
 *
 * A wrapping pair is kept when either of these is true:
 * - The title sets a flag: `data-keep-quotes="true"` (also `1`, `yes`, `on`,
 *   or the bare attribute) on the story `<h2>`. That is `keepQuotes` here.
 *   `false`, `0`, `no`, and `off` do not set it.
 * - The wrapping quotes are escaped: `\"Title\"` or `\'Title\'` (curly
 *   quotes the same way). The backslashes are removed and the quote
 *   characters stay.
 *
 * Escaped quotes anywhere else are also unescaped after the wrap check, so a
 * JSON-quoted title that contains quotes (`"Say \"hi\""`) keeps the inner
 * ones (`Say "hi"`). `JSON.stringify('"On purpose"')` stays `"On purpose"`.
 */
export function stripWrappingTitleQuotes(title: string, keepQuotes = false): string {
  const value = title.trim()
  if (!keepQuotes && value.length >= 2) {
    const open = value[0] ?? ''
    const close = value[value.length - 1] ?? ''
    const wrapped = WRAP_PAIRS.has(open + close) && !escapedAt(value, 0) && !escapedAt(value, value.length - 1)
    if (wrapped) return unescapeTitleQuotes(value.slice(1, -1).trim())
  }
  return unescapeTitleQuotes(value)
}

function h2Attr(inner: string, name: string): string | null {
  const attrs = /<h2\b([^>]*)>/i.exec(inner)?.[1] ?? ''
  const match = new RegExp(`\\b${name}\\b\\s*(?:=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+)))?`, 'i').exec(attrs)
  if (!match) return null
  const value = match[1] ?? match[2] ?? match[3]
  return value === undefined ? '' : value
}

/** `data-keep-quotes` on the card `<h2>`. Bare or empty counts as set. */
export function h2KeepsTitleQuotes(inner: string): boolean {
  const raw = h2Attr(inner, 'data-keep-quotes')
  if (raw === null) return false
  const value = raw.trim()
  if (value === '') return true
  if (/^(0|false|no|off)$/i.test(value)) return false
  return /^(1|true|yes|on)$/i.test(value)
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
    const keepTitleQuotes = h2KeepsTitleQuotes(inner)
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
      ...(keepTitleQuotes ? { keepTitleQuotes: true } : {}),
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
