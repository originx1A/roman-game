import type { ReactNode } from 'react'
import { packValueBlurb, isStoreBuild, type CoinPack } from '../game/iap'
import type { CoinPackId } from '../game/iap'
import { useOnline } from '../game/useOnline'

export interface CoinPackCardProps {
  pack: CoinPack
  onBuy: (packId: CoinPackId) => void
  /** Localized store price when the native shop has loaded it */
  priceText?: string
  /** Website card. The native app never sets this. */
  webBuy?: boolean
}

/** Real-money buy. Offline it stays disabled and says to connect. */
export function OfflineBuyButton({ onClick, children = 'Buy' }: { onClick: () => void; children?: ReactNode }) {
  const online = useOnline()
  return (
    <button
      type="button"
      className="btn ghost product-buy"
      disabled={!online}
      onClick={() => {
        if (!online) return
        onClick()
      }}
    >
      {online ? children : 'Connect to buy'}
    </button>
  )
}

export function CoinPackCard({ pack, onBuy, priceText, webBuy = false }: CoinPackCardProps) {
  const store = isStoreBuild()
  const online = useOnline()
  const showBuy = store || (webBuy && !store)
  const offline = webBuy && !store && !online
  return (
    <article className={`product-card${store ? '' : ' product-card-web'}`}>
      <div className="product-card-top">
        <h3>{pack.label}</h3>
        <p className="product-coins">+{pack.coins}</p>
      </div>
      <p className="product-value">{packValueBlurb(pack.coins)}</p>
      <div className="product-card-foot">
        <span className="product-price">{priceText || pack.priceHint}</span>
        {showBuy ? (
          <button type="button" className="btn ghost product-buy" disabled={offline} onClick={() => { if (!offline) onBuy(pack.id) }}>
            {offline ? 'Connect to buy' : 'Buy'}
          </button>
        ) : null}
      </div>
    </article>
  )
}
