import { ShortfallSheet, type ShortfallAction } from './ShortfallSheet'
import { isStoreBuild, type CoinPack } from '../game/iap'
import type { CoinPackId } from '../game/iap'

export interface ShortfallSheetHostProps {
  open: boolean
  action: ShortfallAction
  need: number
  have: number
  detail?: string
  onClose: () => void
  onPlay: () => void
  onBuyCoins: (packId: CoinPackId) => void | Promise<void>
}

/** App-owned shortfall sheet: native gets Buy pack; web gets play-for-coins only. */
export function ShortfallSheetHost({
  open,
  action,
  need,
  have,
  detail,
  onClose,
  onPlay,
  onBuyCoins,
}: ShortfallSheetHostProps) {
  return (
    <ShortfallSheet
      open={open}
      action={action}
      need={need}
      have={have}
      detail={detail}
      onClose={onClose}
      onPlay={onPlay}
      onBuyPack={
        isStoreBuild()
          ? (pack: CoinPack) => {
              onClose()
              void onBuyCoins(pack.id)
            }
          : undefined
      }
    />
  )
}
