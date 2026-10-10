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

/** 9.31-m: tip appended to text shares (reconstructed 9.31-n from the live 9.31-m bundle; the recovery patch missed it) */
export const HOMESCREEN_TIP = "Tip: save it to your home screen (browser menu > Add to Home Screen) so it's always one tap away."

async function homescreenGuideFile(): Promise<File | null> {
  try {
    const r = await fetch('images/add-to-homescreen-guide.jpg')
    if (!r.ok) return null
    const blob = await r.blob()
    return new File([blob], 'add-to-homescreen.jpg', { type: 'image/jpeg' })
  } catch {
    return null
  }
}

/** 9.31-m: native share with the add-to-home-screen guide image attached when the device supports files */
export async function nativeShareWithGuide(opts: { url: string; title: string; text: string }): Promise<boolean> {
  if (!navigator.share) return false
  try {
    const file = await homescreenGuideFile()
    const data: ShareData = { title: opts.title, text: `${opts.text}\n${opts.url}`, url: opts.url }
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file]
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
