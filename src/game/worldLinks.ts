/** Links out to romansgame.com. One rotating tip, not a wall of buttons. */

export interface WorldLink {
  id: string
  label: string
  href: string
}

const q = (path: string) => `https://romansgame.com${path}${path.includes('?') ? '&' : '?'}from=game`

export const WORLD_MENU: readonly WorldLink[] = [
  { id: 'world', label: "Roman's World", href: q('/') },
  { id: 'cards', label: 'Cards', href: q('/stories/cards/') },
  { id: 'stories', label: 'Stories', href: q('/stories/') },
  { id: 'news', label: 'News', href: q('/news/') },
  { id: 'podcast', label: 'Podcast', href: q('/podcast/') },
  { id: 'music', label: 'Soundtrack', href: q('/music/') },
  { id: 'wallpapers', label: 'Wallpapers', href: q('/wallpapers/') },
  { id: 'defenders', label: 'Meet the Defenders', href: q('/defenders/') },
]

export const RESULT_TIPS: readonly WorldLink[] = [
  { id: 'cards', label: 'Your cards live at romansgame.com', href: q('/stories/cards/') },
  { id: 'stories', label: 'Read a defender story', href: q('/defenders/') },
  { id: 'music', label: 'The soundtrack is on the site', href: q('/music/') },
  { id: 'news', label: "Roman's World News", href: q('/news/') },
  { id: 'podcast', label: 'There is a podcast', href: q('/podcast/') },
]

export function resultTip(seed: number): WorldLink {
  const i = Math.abs(Math.floor(seed)) % RESULT_TIPS.length
  return RESULT_TIPS[i]
}

export const CARDS_URL = 'https://romansgame.com/stories/cards/?from=game'

/** The collection page cannot show the Unseen card yet. */
export const CARD_REVEAL = {
  title: 'You unlocked a special card!',
  body: 'The Unseen is yours. It will appear in your card collection at romansgame.com soon.',
  button: 'Cards section',
  href: CARDS_URL,
  comingSoon: true,
} as const

export const SITE_SHARE = 'https://romansgame.com'
