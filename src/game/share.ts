/* Reconstructed from https://roman-game.surge.sh production JS (index-ChNfA4F8.js).
 * Logic matches the deployed build; formatting/names may differ from original source.
 */

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
