import { ShortfallSheet, type ShortfallAction } from './ShortfallSheet'

export interface ShortfallSheetHostProps {
  open: boolean
  action: ShortfallAction
  need: number
  have: number
  detail?: string
  onClose: () => void
  onPlay: () => void
}

/** App-owned shortfall sheet. 9.33-a: coins are earned by playing only — no packs to buy. */
export function ShortfallSheetHost({ open, action, need, have, detail, onClose, onPlay }: ShortfallSheetHostProps) {
  return <ShortfallSheet open={open} action={action} need={need} have={have} detail={detail} onClose={onClose} onPlay={onPlay} />
}
