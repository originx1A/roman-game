import { ShortfallSheet, type ShortfallAction } from './ShortfallSheet'
import { isStoreBuild, type CoinPack } from '../game/iap'
import type { CoinPackId } from '../game/iap'
import type { WebPackOffer } from '../game/webPacks'

export interface ShortfallSheetHostProps {
  open: boolean
  action: ShortfallAction
  need: number
  have: number
  detail?: string
  onClose: () => void
  onPlay: () => void
  onBuyCoins: (packId: CoinPackId) => void | Promise<void>
  /** Website catalog. Leave unset in the native app. */
  webPacks?: WebPackOffer[] | null
  purchasesUnavailable?: boolean
}

/** App-owned shortfall sheet. Native buys from the store. The website buys a web pack. */
export function ShortfallSheetHost({
  open,
  action,
  need,
  have,
  detail,
  onClose,
  onPlay,
  onBuyCoins,
  webPacks,
  purchasesUnavailable = false,
}: ShortfallSheetHostProps) {
  const store = isStoreBuild()
  const canBuy = store || (!store && !!webPacks && webPacks.length > 0)
  return (
    <ShortfallSheet
      open={open}
      action={action}
      need={need}
      have={have}
      detail={detail}
      onClose={onClose}
      onPlay={onPlay}
      webPacks={store ? null : webPacks}
      purchasesUnavailable={store ? false : purchasesUnavailable}
      onBuyPack={
        canBuy
          ? (pack: CoinPack) => {
              onClose()
              void onBuyCoins(pack.id)
            }
          : undefined
      }
    />
  )
}
