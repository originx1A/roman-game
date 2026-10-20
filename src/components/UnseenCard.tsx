import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { onCardProgress, type CardProgress } from '../cloud/cloud'
import { CARD_PIECES, localCard } from '../game/unseenCard'
import type { RecordsBlob } from '../game/replay'

/** Server count when signed in, this device's count otherwise */
export function useUnseenPieces(records?: RecordsBlob): { pieces: number; earned: boolean; verified: boolean } {
  const [server, setServer] = useState<CardProgress | null>(null)
  useEffect(() => onCardProgress(setServer), [])
  if (server) return { pieces: Math.min(CARD_PIECES, server.pieces), earned: server.earned, verified: true }
  const p = localCard(records).pieces
  return { pieces: p, earned: false, verified: false }
}

/**
 * 9.32-d: card BACK while locked (cracked gold back, the Unseen pressed through, glow pulsing in the cracks
 * and getting stronger with progress). Once earned the card FLIPS to the front, which plays the looping animation.
 */
export function UnseenCardArt({ pieces, from, size = 'sm', animate = size === 'lg' }: { pieces: number; from?: number; size?: 'sm' | 'lg'; animate?: boolean }) {
  const [shown, setShown] = useState(from ?? pieces)
  useEffect(() => {
    if (from == null) return setShown(pieces)
    setShown(from)
    const t = window.setTimeout(() => setShown(pieces), 450)
    return () => window.clearTimeout(t)
  }, [from, pieces])
  const r = Math.max(0, Math.min(1, shown / CARD_PIECES))
  const earned = r >= 1
  return (
    <div className={`unseen-card unseen-card-${size}${earned ? ' is-earned' : ''}`} style={{ ['--reveal' as string]: r }} aria-hidden="true">
      <div className="unseen-flip">
        <div className="unseen-face unseen-back">
          <img src="/images/unseen-card-back.webp" alt="" draggable={false} />
          <div className="unseen-cracks" />
          {size === 'lg' ? <div className="unseen-embers" /> : null}
          {from != null && pieces > from && pieces < CARD_PIECES ? <div className="unseen-burn" /> : null}
        </div>
        <div className="unseen-face unseen-front">
          {earned && animate && !reducedMotion() ? (
            <video src="/images/unseen-card-animated.mp4" poster="/images/unseen-card-poster.webp" autoPlay muted loop playsInline disablePictureInPicture />
          ) : (
            <img src="/images/unseen-card.webp" alt="" draggable={false} />
          )}
        </div>
      </div>
    </div>
  )
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function UnseenCardTile({ records }: { records?: RecordsBlob }) {
  const { pieces, earned } = useUnseenPieces(records)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="unseen-tile" onClick={() => setOpen(true)}>
        <UnseenCardArt pieces={earned ? CARD_PIECES : pieces} />
        <span className="unseen-tile-text">
          <b>{earned ? 'Unseen card earned!' : `Unseen card: ${pieces} of ${CARD_PIECES}`}</b>
          <small>{earned ? 'It’s in your collection.' : 'Exclusive. Only earned in the game.'}</small>
        </span>
      </button>
      {open ? createPortal(
        <div className="unseen-modal" role="dialog" aria-label="The Unseen card" onClick={() => setOpen(false)}>
          <div className="unseen-modal-body" onClick={(e) => e.stopPropagation()}>
            <UnseenCardArt pieces={earned ? CARD_PIECES : pieces} size="lg" />
            <h3>{earned ? 'The Unseen is yours' : `Unseen card: ${pieces} of ${CARD_PIECES}`}</h3>
            <p>{earned ? 'The card has turned. The Unseen is yours.' : 'Each piece brings the card closer. Collect them all and it turns over.'}</p>
            <ul>
              <li>Clear a board for the first time: 1 piece (20 boards)</li>
              <li>Win the daily puzzle: 1 piece a day (30 days)</li>
            </ul>
            <p className="unseen-note">Sign in to save the card to your account.</p>
            <button type="button" className="btn primary" onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

/** Win screen moment: only shown when this win added a piece. Tap to open the details in place. */
export function UnseenCardGain({ from, to }: { from: number; to: number }) {
  const [open, setOpen] = useState(false)
  const earned = to >= CARD_PIECES
  const added = Math.max(0, to - from)
  return (
    <button
      type="button"
      className={`unseen-gain${open ? ' is-open' : ''}`}
      data-testid="win-gold-card"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      <UnseenCardArt pieces={to} from={from} size="sm" />
      <span className="unseen-gain-copy">
        <b>{earned ? 'The Unseen card is yours' : 'The Unseen card'}</b>
        <small>{open ? 'Tap to close' : `${to} of ${CARD_PIECES}`}</small>
        <span className="unseen-gain-details">
          <span>
            <small>What it does: an exclusive card. Collect every piece and it turns over. You can show it on the Board.</small>
            <small>Needed: {CARD_PIECES} pieces. A new board and each Daily win each add one.</small>
            <small>Progress: {to} of {CARD_PIECES}{added > 0 ? `. This win added ${added}.` : ''}</small>
          </span>
        </span>
      </span>
    </button>
  )
}
