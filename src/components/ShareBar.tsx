/** One Share button. The link carries the friend code. A picture card goes along when the device allows it. */
import { useState, type ReactNode } from 'react'
import { bragCardFile } from '../game/bragCard'
import { copyText, nativeShare } from '../game/share'
import { shareUrl } from '../social/hub'

export interface ScoreShare {
  url: string
  text: string
}

export function ShareBar({
  url,
  title = "Roman's Game",
  text = "Come play Roman's Game with me.",
  onCopied,
  onShareScore,
  children,
}: {
  url: string
  title?: string
  text?: string
  onCopied?: () => void
  emailHref?: string
  inviteUrl?: string
  inviteText?: string
  onShareScore?: () => ScoreShare
  children?: ReactNode
}) {
  const [score, setScore] = useState<ScoreShare>({ url, text })

  async function share() {
    const next = onShareScore ? onShareScore() : score.url === url ? { url, text } : score
    setScore(next)
    const sharedUrl = shareUrl(next.url)
    const file = await bragCardFile(next.text)
    const data: ShareData = { url: sharedUrl, title, text: next.text }
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file]
    const shared = await nativeShare(data)
    if (!shared) {
      await copyText(`${next.text} ${sharedUrl}`)
      onCopied?.()
    }
  }

  return (
    <div className="share-bar">
      {children}
      <button type="button" className="btn primary" data-testid="share-score" onClick={() => void share()}>
        Share
      </button>
    </div>
  )
}
