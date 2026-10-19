/**
 * Amazon Associates policy prohibits affiliate links in emails.
 * Every amazon.* host (amazon.com, amazon.ca, amazon.co.uk, and the rest),
 * plus amzn.to and a.co, is removed from email HTML and plain text whether
 * or not the URL carries a tag. In a story email each one is rewritten to
 * that post's canonical https://romansgame.com/news/ article URL. When the
 * email has no article (welcome, support alert, dry-run of those), the link
 * is dropped and the surrounding text stays. If the visible text is itself
 * an Amazon URL, that text is removed too, so the host cannot remain in the
 * message. Image sources on those hosts are removed rather than pointed at
 * an article page. The RSS feed and the public articles are not passed
 * through this module.
 */

const TRAIL = /[.,;:!?)\]]+$/

function tokens(): RegExp {
  return /(?:https?:\/\/|\/\/)[^\s<>"']+|(?<![@/])\b(?:[a-z0-9-]+\.)*(?:amazon(?:\.[a-z]{2,}){1,2}|amzn\.to|a\.co)(?:\/[^\s<>"']*)?/gi
}

function decodeBasic(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

export function isAmazonHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '')
  if (host === 'a.co' || host.endsWith('.a.co')) return true
  if (host === 'amzn.to' || host.endsWith('.amzn.to')) return true
  const labels = host.split('.')
  const at = labels.lastIndexOf('amazon')
  if (at < 0) return false
  if (at !== labels.length - 2 && at !== labels.length - 3) return false
  const rest = labels.slice(at + 1)
  if (rest.length === 1) return /^[a-z]{2,}$/.test(rest[0] ?? '')
  return /^[a-z]{2,3}$/.test(rest[0] ?? '') && /^[a-z]{2}$/.test(rest[1] ?? '')
}

export function isAmazonUrl(value: string): boolean {
  let raw = decodeBasic(value).trim()
  if (!raw || raw.startsWith('mailto:') || raw.includes('@') && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return false
  if (raw.startsWith('//')) raw = `https:${raw}`
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return isAmazonHost(url.hostname)
  } catch {
    return false
  }
}

/** Canonical article on romansgame.com/news/, or null when `link` is not one. */
export function canonicalNewsUrl(link: string | null | undefined): string | null {
  if (!link) return null
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'romansgame.com' || !url.pathname.startsWith('/news/')) return null
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/news') return 'https://romansgame.com/news/'
  return `https://romansgame.com${path}/`
}

function tidy(value: string): string {
  return value
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]+$/gm, '')
}

export function sanitizeEmailText(value: string, articleUrl: string | null): string {
  const next = value.replace(tokens(), (token) => {
    const trail = TRAIL.exec(token)?.[0] ?? ''
    const core = trail ? token.slice(0, -trail.length) : token
    if (!core || !isAmazonUrl(core)) return token
    return `${articleUrl ?? ''}${trail}`
  })
  return tidy(next)
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return decodeBasic(match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * Rewrite or drop Amazon links in an email body.
 * `articleUrl` must already be a romansgame.com/news/ URL; anything else is ignored.
 */
export function sanitizeEmailHtml(value: string, articleUrl: string | null): string {
  const article = articleUrl && canonicalNewsUrl(articleUrl) === articleUrl ? articleUrl : null
  const anchors = value.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs: string, inner: string) => {
    const href = attr(attrs, 'href')
    if (!isAmazonUrl(href)) return whole
    const visible = decodeBasic(inner.replace(/<[^>]+>/g, '')).trim()
    const visibleIsLink = visible !== '' && isAmazonUrl(visible)
    if (!article) return visibleIsLink ? '' : inner
    const label = visibleIsLink ? escapeAttr(article) : inner
    return `<a href="${escapeAttr(article)}">${label}</a>`
  })
  const images = anchors.replace(/<img\b[^>]*>/gi, (tag) => (isAmazonUrl(attr(tag, 'src')) ? '' : tag))
  return tidy(sanitizeEmailText(images, article)).replace(/<a\b[^>]*>\s*<\/a>/gi, '')
}
