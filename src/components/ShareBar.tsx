/** Reconstructed from roman-game.surge.sh production JS. */
import { buildShareLinks, copyText, nativeShare } from '../game/share'

export function ShareBar({
  url,
  title = "Roman's Game",
  text = "Come play Roman's logic board with me!",
  onCopied,
  emailHref,
}: {
  url: string
  title?: string
  text?: string
  onCopied?: () => void
  /** When set, the Email chip uses this mailto (recipient included) instead of a blank one. */
  emailHref?: string
}) {
  const links = buildShareLinks({ url, title, text })
  return (
    <div className="share-bar">
      <button
        type="button"
        className="share-chip"
        onClick={async () => {
          ;(await nativeShare({ url, title, text })) || ((await copyText(url)), onCopied?.())
        }}
      >
        Share
      </button>
      <a className="share-chip" href={links.sms}>
        SMS
      </a>
      <a className="share-chip" href={links.whatsapp} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a className="share-chip" href={links.x} target="_blank" rel="noreferrer">
        X
      </a>
      <a className="share-chip" href={links.facebook} target="_blank" rel="noreferrer">
        Facebook
      </a>
      <a className="share-chip" href={links.telegram} target="_blank" rel="noreferrer">
        Telegram
      </a>
      <a className="share-chip" href={emailHref || links.mailto}>
        Email
      </a>
      <button
        type="button"
        className="share-chip"
        onClick={async () => {
          await copyText(url)
          onCopied?.()
        }}
      >
        Copy link
      </button>
    </div>
  )
}
