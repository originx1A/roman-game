import { itemArt } from '../game/catalog'

export function ItemPic({ id, large = false, small = false }: { id: string; large?: boolean; small?: boolean }) {
  const art = itemArt(id)
  if (!art) return null
  const size = large ? 80 : small ? 36 : 64
  const kind = large ? 'item-art lg' : small ? 'item-art sm' : 'item-art'
  return <img className={kind} src={art.src} srcSet={art.srcSet} sizes={`${size}px`} alt="" width={size} height={size} />
}
