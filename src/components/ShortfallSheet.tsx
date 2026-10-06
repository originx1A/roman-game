import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { cheapestPackForGap, isStoreBuild, packValueBlurb, type CoinPack } from '../game/iap'
import { cheapestWebPack, type WebPackOffer } from '../game/webPacks'

export type ShortfallAction = 'hint' | 'rescue' | 'revive' | 'upgrade'

const ACTION_NAME: Record<ShortfallAction, string> = {
  hint: 'Hint',
  rescue: 'Rescue',
  revive: 'Revive',
  upgrade: 'Upgrade',
}

export interface ShortfallSheetProps {
  open: boolean
  action: ShortfallAction
  need: number
  have: number
  detail?: string
  onClose: () => void
  onPlay: () => void
  /** Buy the cheapest pack that covers the gap. Native uses store packs. Web uses webPacks. */
  onBuyPack?: (pack: CoinPack) => void
  /** Website catalog from the server. Omitted in the native app. */
  webPacks?: WebPackOffer[] | null
  /** Website shop could not reach the payment functions. */
  purchasesUnavailable?: boolean
}

export function ShortfallSheet({
  open,
  action,
  need,
  have,
  detail,
  onClose,
  onPlay,
  onBuyPack,
  webPacks,
  purchasesUnavailable = false,
}: ShortfallSheetProps) {
  const titleId = useId()
  const short = Math.max(0, need - have)
  const store = isStoreBuild()
  const pack = cheapestPackForGap(short || need)
  const webOffer = !store && webPacks && webPacks.length > 0 ? cheapestWebPack(webPacks, short || need) : null
  const actionLabel =
    action === 'upgrade' && detail ? `Upgrade (${detail})` : ACTION_NAME[action]

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const node = (
    <div className="shortfall-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="shortfall-scrim" aria-label="Close" onClick={onClose} />
      <div className="shortfall-sheet">
        <div className="shortfall-accent" aria-hidden />
        <h2 id={titleId} className="shortfall-title">
          Need more coins
        </h2>
        <p className="shortfall-math">
          {actionLabel} costs {need} · you have {have} · need {short}
        </p>
        <p className="shortfall-body">{packValueBlurb(100)}</p>
        <p className="shortfall-body">Win a board for ~90–200 coins</p>
        {!store && purchasesUnavailable ? (
          <p className="shortfall-body shortfall-web-note">Purchases are unavailable right now.</p>
        ) : null}
        <div className="shortfall-actions">
          <button type="button" className="btn primary" onClick={onPlay}>
            Play for coins
          </button>
          {store && onBuyPack ? (
            <button type="button" className="btn ghost" onClick={() => onBuyPack(pack)}>
              Buy {pack.label} · +{pack.coins} ({pack.priceHint})
            </button>
          ) : null}
          {!store && webOffer && onBuyPack ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                onBuyPack({
                  id: webOffer.id,
                  productId: webOffer.productId,
                  label: webOffer.label,
                  coins: webOffer.coins,
                  priceHint: webOffer.priceLabel,
                })
              }
            >
              Buy {webOffer.label} · +{webOffer.coins} ({webOffer.priceLabel})
            </button>
          ) : null}
          <button type="button" className="btn shortfall-dismiss" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
