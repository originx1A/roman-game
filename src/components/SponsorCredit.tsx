import { useEffect, useState } from 'react'
import { isStoreBuild } from '../game/iap'

/**
 * 9.33-a19: the game front-door sponsor credit line.
 *
 * Display only — no booking, no store write, nothing that touches the
 * sponsor calendar. The line is fed by this site's own /api/sponsors-feed
 * proxy, which server-side reads the hub's public sponsors feed
 * (romansgame.com sponsors-public) because that feed sends no CORS
 * headers for a direct cross-origin read from play.romansgame.com.
 *
 * States (same construction as the website's printed credits):
 *  - an ACTIVE paid deal covers the game placement -> the paid credit:
 *    the credit_line form "…sponsored by NAME — line. (Paid sponsor)",
 *    or the sponsor's approved wording verbatim when no credit_line
 *    was given (the system's own rule, as in news/build-news.py).
 *  - no paid deal (or the feed cannot be reached) -> the house fallback,
 *    with Northroom Digital's name itself the link. The house name is
 *    never labelled "(Paid sponsor)" — it isn't one.
 * The "For the grown-ups:" framing is the game surface's own, from the
 * sponsor page's approved example (examples/game.webp): credits speak
 * to grown-ups, never to the children playing.
 * Web only: store builds keep players inside the app (same rule as the
 * home screen's romansgame.com link), so nothing renders there.
 */

interface GameCredit {
  business_name?: string
  credit_line?: string
  line?: string
}

const HOUSE = { name: 'Northroom Digital', href: 'https://payhip.com/NorthroomDigital' }

export function SponsorCredit() {
  const [credit, setCredit] = useState<GameCredit | null>(null)

  useEffect(() => {
    if (isStoreBuild()) return
    let live = true
    fetch('/api/sponsors-feed', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return
        const c = data && data.credits ? data.credits.game : null
        if (c && c.business_name) setCredit(c)
      })
      .catch(() => {
        /* house fallback stays */
      })
    return () => {
      live = false
    }
  }, [])

  if (isStoreBuild()) return null
  // The house line renders immediately (it is the standing state); the
  // paid credit swaps in if the feed answers with one.
  const line = (credit?.credit_line || '').trim()
  const wording = (credit?.line || '').trim()
  return (
    <p className="sponsor-credit" role="note">
      {credit ? (
        line ? (
          <>
            For the grown-ups: this free game is sponsored by <strong>{credit.business_name}</strong>
            {` \u2014 ${line}. (Paid sponsor)`}
          </>
        ) : wording ? (
          <>{wording}</>
        ) : (
          <>
            For the grown-ups: this free game is sponsored by <strong>{credit.business_name}</strong>. (Paid sponsor)
          </>
        )
      ) : (
        <>
          For the grown-ups: this free game is sponsored by{' '}
          <a href={HOUSE.href} target="_blank" rel="noopener noreferrer">
            {HOUSE.name}
          </a>
          .
        </>
      )}
    </p>
  )
}
