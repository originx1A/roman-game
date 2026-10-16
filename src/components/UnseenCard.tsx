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

/** The card under shadow. `from` animates the shadow burning back to `pieces`. */
/** Still card face sits under the shadow; once earned, the big views pop out and play the animated card. */
export function UnseenCardArt({ pieces, from, size = 'sm', animate = size === 'lg' }: { pieces: number; from?: number; size?: 'sm' | 'lg'; animate?: boolean }) {
  const [shown, setShown] = useState(from ?? pieces)
  useEffect(() => {
    if (from == null) return setShown(pieces)
    setShown(from)
    const t = window.setTimeout(() => setShown(pieces), 450)
    return () => window.clearTimeout(t)
  }, [from, pieces])
  const r = Math.max(0, Math.min(1, shown / CARD_PIECES))
  return (
    <div className={`unseen-card unseen-card-${size}${r >= 1 ? ' is-earned' : ''}`} style={{ ['--reveal' as string]: r }} aria-hidden="true">
      {r >= 1 && animate && !reducedMotion() ? (
        <video src="/images/unseen-card-animated.mp4" poster="/images/unseen-card.webp" autoPlay muted loop playsInline disablePictureInPicture />
      ) : (
        <img src="/images/unseen-card.webp" alt="" draggable={false} />
      )}
      <div className="unseen-shadow" />
      {from != null && pieces > from ? <div className="unseen-burn" /> : null}
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
            <p>Each piece burns back the shadow.</p>
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

/** Win screen moment: only shown when this win added a piece */
export function UnseenCardGain({ from, to }: { from: number; to: number }) {
  return (
    <div className="unseen-gain" role="status">
      <UnseenCardArt pieces={to} from={from} size={to >= CARD_PIECES ? 'lg' : 'sm'} />
      <span>
        <b>{to >= CARD_PIECES ? 'The Unseen card is yours!' : 'The shadow burns back'}</b>
        <small>Unseen card: {to} of {CARD_PIECES}</small>
      </span>
    </div>
  )
}
