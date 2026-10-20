/** Share score, invite friends, and every other way under one disclosure. */
import { useState, type ReactNode } from 'react'
import { buildShareLinks, copyText, nativeShare } from '../game/share'

export interface ScoreShare {
  url: string
  text: string
}

export function ShareBar({
  url,
  title = "Roman's Game",
  text = 'Come play Roman\'s Game with me.',
  onCopied,
  emailHref,
  inviteUrl,
  inviteText = 'Come play Roman\'s Game with me.',
  onShareScore,
  children,
}: {
  url: string
  title?: string
  text?: string
  onCopied?: () => void
  /** When set, Email uses this mailto instead of a blank one. */
  emailHref?: string
  /** Game link for Invite friends. Defaults to the score link. */
  inviteUrl?: string
  inviteText?: string
  /** Build the score challenge, then share that link. */
  onShareScore?: () => ScoreShare
  children?: ReactNode
}) {
  const [score, setScore] = useState<ScoreShare>({ url, text })
  const live = onShareScore ? score : { url, text }
  const links = buildShareLinks({ url: live.url, title, text: live.text })
  const invite = inviteUrl || url

  async function shareScore() {
    const next = onShareScore ? onShareScore() : { url, text }
    setScore(next)
    const shared = await nativeShare({ url: next.url, title, text: next.text })
    if (!shared) {
      await copyText(next.url)
      onCopied?.()
    }
  }

  async function inviteFriends() {
    const shared = await nativeShare({ url: invite, title, text: inviteText })
    if (!shared) {
      await copyText(`${inviteText} ${invite}`)
      onCopied?.()
    }
  }

  return (
    <div className="share-bar">
      <div className="share-primary">
        <button type="button" className="btn primary" data-testid="share-score" onClick={() => void shareScore()}>
          Share score
        </button>
        <button type="button" className="btn ghost share-invite" data-testid="invite-friends" onClick={() => void inviteFriends()}>
          Invite friends
        </button>
      </div>
      <details className="share-more">
        <summary>More ways</summary>
        {children}
        <div className="share-more-links">
          <button
            type="button"
            className="share-chip"
            onClick={async () => {
              const next = onShareScore ? onShareScore() : { url, text }
              setScore(next)
              await copyText(next.url)
              onCopied?.()
            }}
          >
            Copy score link
          </button>
          <a className="share-chip" href={links.sms}>Text message</a>
          <a className="share-chip" href={links.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="share-chip" href={links.x} target="_blank" rel="noreferrer">Post on X</a>
          <a className="share-chip" href={links.facebook} target="_blank" rel="noreferrer">Facebook</a>
          <a className="share-chip" href={links.telegram} target="_blank" rel="noreferrer">Telegram</a>
          <a className="share-chip" href={emailHref || links.mailto}>Email</a>
          <button
            type="button"
            className="share-chip"
            onClick={async () => {
              await copyText(`${inviteText} ${invite}`)
              onCopied?.()
            }}
          >
            Copy invite
          </button>
        </div>
      </details>
    </div>
  )
}
