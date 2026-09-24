import { packValueBlurb, isStoreBuild, type CoinPack } from '../game/iap'
import type { CoinPackId } from '../game/iap'

export interface CoinPackCardProps {
  pack: CoinPack
  onBuy: (packId: CoinPackId) => void
}

export function CoinPackCard({ pack, onBuy }: CoinPackCardProps) {
  const store = isStoreBuild()
  return (
    <article className={`product-card${store ? '' : ' product-card-web'}`}>
      <div className="product-card-top">
        <h3>{pack.label}</h3>
        <p className="product-coins">+{pack.coins}</p>
      </div>
      <p className="product-value">{packValueBlurb(pack.coins)}</p>
      <div className="product-card-foot">
        <span className="product-price">{pack.priceHint}</span>
        {store ? (
          <button type="button" className="btn ghost product-buy" onClick={() => onBuy(pack.id)}>
            Buy
          </button>
        ) : (
          <span className="product-app-only">App Store / Play</span>
        )}
      </div>
    </article>
  )
}
