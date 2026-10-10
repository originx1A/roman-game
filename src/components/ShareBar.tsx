/** Reconstructed from roman-game.surge.sh production JS. */
import { useState } from 'react'
import { buildShareLinks, copyText, nativeShareWithGuide, HOMESCREEN_TIP } from '../game/share'

export function ShareBar({
  url,
  title = "Roman's Game",
  text = "Come play Roman's logic board with me!",
  onCopied,
  emailHref,
  onShared,
}: {
  url: string
  title?: string
  text?: string
  onCopied?: () => void
  /** When set, the Email chip uses this mailto (recipient included) instead of a blank one. */
  emailHref?: string
  /** Fired when a share actually goes out (native share or copy). 9.31-m: owner-dashboard share rate. */
  onShared?: () => void
}) {
  const [showGuide, setShowGuide] = useState(false)
  // Append the home-screen tip to text shares so recipients know how to save the game
  const fullText = text.includes('Add to Home Screen') ? text : `${text}\n📱 ${HOMESCREEN_TIP}`
  const fullLinks = buildShareLinks({ url, title, text: fullText })
  return (
    <div className="share-bar">
      <button
        type="button"
        className="share-chip"
        onClick={async () => {
          const ok = await nativeShareWithGuide({ url, title, text: fullText })
          if (ok) onShared?.()
          else {
            await copyText(`${fullText}\n${url}`)
            onShared?.()
            onCopied?.()
          }
        }}
      >
        Share
      </button>
      <a className="share-chip" href={fullLinks.sms}>
        SMS
      </a>
      <a className="share-chip" href={fullLinks.whatsapp} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      <a className="share-chip" href={fullLinks.x} target="_blank" rel="noreferrer">
        X
      </a>
      <a className="share-chip" href={fullLinks.facebook} target="_blank" rel="noreferrer">
        Facebook
      </a>
      <a
        className="share-chip yt-chip"
        href="https://www.youtube.com/@RomansGameOG"
        target="_blank"
        rel="noreferrer"
        aria-label="Subscribe to Roman's Game on YouTube"
      >
        ▶️ Subscribe on YouTube
      </a>
      <a className="share-chip" href={fullLinks.telegram} target="_blank" rel="noreferrer">
        Telegram
      </a>
      <a className="share-chip" href={emailHref || fullLinks.mailto}>
        Email
      </a>
      <button
        type="button"
        className="share-chip"
        onClick={async () => {
          await copyText(`${fullText}\n${url}`)
          onShared?.()
          onCopied?.()
        }}
      >
        Copy link
      </button>
      <button
        type="button"
        className="share-chip homescreen-chip"
        onClick={() => setShowGuide((v) => !v)}
        aria-expanded={showGuide}
      >
        📱 Save to home screen
      </button>
      {showGuide && (
        <div className="homescreen-guide">
          <img
            src="images/add-to-homescreen-guide.jpg"
            alt="How to add Roman's Game to your phone home screen in 3 steps"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}
