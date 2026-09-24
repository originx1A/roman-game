/* Share helpers — social links, native share, score duel text. */

export function buildShareLinks(opts: { url: string; text: string; title: string }) {
  const url = encodeURIComponent(opts.url)
  const text = encodeURIComponent(opts.text)
  const title = encodeURIComponent(opts.title)
  return {
    sms: `sms:?&body=${text}%20${url}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    mailto: `mailto:?subject=${title}&body=${text}%0A%0A${url}`,
  }
}

export async function nativeShare(data: ShareData): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share(data)
    return true
  } catch {
    return false
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function formatShareTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Plain-language score brag for social / clipboard share. */
export function scoreShareText(opts: {
  score: number
  elapsedMs: number
  boardName: string
}): string {
  return `I scored ${opts.score} pts on ${opts.boardName} (${formatShareTime(opts.elapsedMs)}) in Roman's Game — can you beat me?`
}

/** Challenge / duel invite copy when a score is attached. */
export function duelShareText(opts: {
  score: number
  elapsedMs: number
  boardName: string
  fromName: string
}): string {
  return `${opts.fromName} scored ${opts.score} pts (${formatShareTime(opts.elapsedMs)}) on ${opts.boardName}. Score duel — beat them in Roman's Game!`
}
