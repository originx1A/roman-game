/**
 * Roman's world shelf. Add a product by editing this file only.
 * The store page HTML is generated from it (scripts/render-store-page.ts).
 *
 * No prices live here. Amazon shows the coloring-book price. Everything
 * else is still "coming soon" and must not invent a number.
 */

export type StoreLink = {
  label: string
  href: string
  /** Product link on another shop (Amazon). Gets rel="noopener sponsored". */
  sponsored?: boolean
}

export type StoreImage = {
  src: string
  alt: string
}

export type StoreItem = {
  id: string
  title: string
  summary: string
  status: 'live' | 'soon'
  statusLabel: string
  /** Plain sentence. Never a made-up price. */
  priceNote?: string
  /**
   * Cover art. TODO: the Tales of the Empty Throne coloring-book cover is not
   * in this repo. Set `image` when a real file is added, and remove the placeholder.
   */
  image?: StoreImage | null
  links?: StoreLink[]
}

export type StoreSection = {
  id: string
  /** Tab label */
  label: string
  items: StoreItem[]
}

export type StoreNotify = {
  heading: string
  body: string
  label: string
  href: string
  note: string
}

export type StoreNavLink = {
  label: string
  href: string
  current?: boolean
}

export const STORE_TITLE = 'Store'

export const STORE_INTRO =
  'One shelf for the books, stories, and music of Roman\u2019s world. The coloring book is ready. Stories, songs, and bundles are still on the way.'

/** Same Roman's World News signup the rest of the site already uses. Not a new list. */
export const STORE_NOTIFY: StoreNotify = {
  heading: 'Get notified',
  body: 'Parents can get a short note when a story, song, or bundle is ready. It is optional.',
  label: 'Get notified',
  href: 'https://romansgame.com/news/#signup',
  note: 'Opens the Roman\u2019s World News signup. Unsubscribe anytime.',
}

/** Marketing-site nav, with Store as this page. Other links stay on romansgame.com. */
export const STORE_NAV: StoreNavLink[] = [
  { label: 'Home', href: 'https://romansgame.com/' },
  { label: 'Play', href: 'https://romansgame.com/play/' },
  { label: 'Lore', href: 'https://romansgame.com/lore' },
  { label: 'Defenders', href: 'https://romansgame.com/defenders/' },
  { label: 'Watch', href: 'https://romansgame.com/watch' },
  { label: 'Music', href: 'https://romansgame.com/music/' },
  { label: 'Wallpapers', href: 'https://romansgame.com/wallpapers/' },
  { label: 'Stories', href: 'https://romansgame.com/stories/' },
  { label: 'Cards', href: 'https://romansgame.com/stories/cards/' },
  { label: 'Store', href: '/store/', current: true },
  { label: 'News', href: 'https://romansgame.com/news/' },
  { label: 'Support', href: 'https://romansgame.com/support' },
]

export const STORE_SECTIONS: StoreSection[] = [
  {
    id: 'coloring-books',
    label: 'Coloring Books',
    items: [
      {
        id: 'empty-throne-coloring-book',
        title: "Roman's Game: Tales of the Empty Throne Coloring Book",
        summary: 'A paperback coloring book of the Empty Throne tales, sold on Amazon.',
        status: 'live',
        statusLabel: 'Available now',
        priceNote: 'See price on Amazon',
        image: null,
        links: [
          {
            label: 'Buy on Amazon.ca',
            href: 'https://www.amazon.ca/dp/B0HNDZ96N5',
            sponsored: true,
          },
          {
            label: 'Buy on Amazon.com',
            href: 'https://www.amazon.com/dp/B0HNDZ96N5',
            sponsored: true,
          },
        ],
      },
    ],
  },
  {
    id: 'audiobooks',
    label: 'Audiobooks & Stories',
    items: [
      {
        id: 'sagas',
        title: 'Audiobooks & Stories',
        summary: 'Saga 1 will be free to read and hear. Later sagas will be sold here. Prices are not set yet.',
        status: 'soon',
        statusLabel: 'Coming soon',
      },
    ],
  },
  {
    id: 'music',
    label: 'Music',
    items: [
      {
        id: 'songs-and-album',
        title: 'Songs and the album',
        summary: 'Songs and the album will be sold here. Prices are not set yet.',
        status: 'soon',
        statusLabel: 'Coming soon',
      },
    ],
  },
  {
    id: 'bundles',
    label: 'Bundles & Passes',
    items: [
      {
        id: 'bundles-and-passes',
        title: 'Bundles & Passes',
        summary: 'A way to get books, stories, and music together. Nothing is for sale here yet, and prices are not set.',
        status: 'soon',
        statusLabel: 'Coming soon',
      },
    ],
  },
]
