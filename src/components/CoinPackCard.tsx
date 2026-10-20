import { packValueBlurb, isStoreBuild, type CoinPack } from '../game/iap'
import type { CoinPackId } from '../game/iap'
import { coinStackDiscs, formatPackCoins } from '../game/coinPackDisplay'

export interface CoinPackCardProps {
  pack: CoinPack
  onBuy: (packId: CoinPackId) => void
  /** Localized store price when the native shop has loaded it */
  priceText?: string
  /** Website card. The native app never sets this. */
  webBuy?: boolean
}

export function CoinPackCard({ pack, onBuy, priceText, webBuy = false }: CoinPackCardProps) {
  const store = isStoreBuild()
  const showBuy = store || (webBuy && !store)
  const discs = coinStackDiscs(pack.coins)
  const price = priceText || pack.priceHint
  return (
    <article className={`product-card product-card-money${store ? '' : ' product-card-web'}`} data-pack={pack.id}>
      <span className="coin-stack" data-discs={discs} aria-hidden="true">
        {Array.from({ length: discs }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <h3>{pack.label}</h3>
      <p className="product-coins">{formatPackCoins(pack.coins)}</p>
      <p className="product-value">{packValueBlurb(pack.coins)}</p>
      <div className="product-card-foot">
        <span className="product-price">
          <span className="pay-mark" aria-hidden="true">💳</span> {price}
        </span>
        {showBuy ? (
          <button type="button" className="btn ghost product-buy" onClick={() => onBuy(pack.id)}>
            Buy
          </button>
        ) : null}
      </div>
    </article>
  )
}
