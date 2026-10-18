/**
 * Roman's world shelf. Add a product by editing this file only.
 * The store page HTML is generated from it (scripts/render-store-page.ts).
 *
 * The coloring book price stays on Amazon. Audiobook prices are CAD cents.
 */

export type StoreLink = {
  label: string
  href: string
  /** Product link on another shop (Amazon). Gets rel="noopener sponsored". */
  sponsored?: boolean
}

/**
 * Amazon Associates ids. An empty string leaves that shop's links untagged.
 * amazon.ca uses amazonTagCA. amazon.com uses amazonTagUS.
 */
export const amazonTagCA = 'jrny06-20'
export const amazonTagUS = 'jrny00-20'

export const AMAZON_ASSOCIATE_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.'

export function amazonHref(href: string, tags: { ca: string; us: string } = { ca: amazonTagCA, us: amazonTagUS }): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return href
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const tag = host === 'amazon.ca' ? tags.ca.trim() : host === 'amazon.com' ? tags.us.trim() : ''
  if (!tag) return href
  url.searchParams.set('tag', tag)
  return url.toString()
}

/** Shown in the footer when either Associates id is set. */
export function amazonAssociateDisclosure(tags: { ca: string; us: string } = { ca: amazonTagCA, us: amazonTagUS }): string {
  return tags.ca.trim() || tags.us.trim() ? AMAZON_ASSOCIATE_DISCLOSURE : ''
}

export type StoreImage = {
  src: string
  alt: string
}

export type StoreBonus = {
  /** Text before the link, including the trailing space. */
  before: string
  label: string
  href: string
  /** Text after the link, usually the period. */
  after: string
}

export type StoreItem = {
  id: string
  title: string
  summary: string
  status: 'live' | 'soon'
  statusLabel: string
  /** One spec line, such as publisher, edition, and page size. */
  details?: string
  /** Extra line. The label is the link. */
  bonus?: StoreBonus
  /**
   * Amazon ASIN. When this is set, the card is for sale: Amazon buttons and
   * "See price on Amazon". Leave it empty and set `image` to null until the
   * book is ready. Adding an ASIN and a cover is the whole switch to live.
   */
  asin?: string
  /** Plain sentence. Never a made-up price. */
  priceNote?: string
  /** Cover art. `null` shows the book placeholder. Omit it when the item has no cover. */
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
  'One shelf for the books, stories, and music of Roman\u2019s world. The coloring book is on Amazon. Audiobooks are listed here. Songs are still on the way.'

/** CAD display. Free stays the word Free, never CA$0.00. */
export function formatCad(cents: number): string {
  if (cents === 0) return 'Free'
  return `CA$${(cents / 100).toFixed(2)}`
}

export type AudioFiles = {
  /** Full master in the private bucket. Paid masters need a purchase token. */
  master: string
  sample: string
  cover: string
}

export type AudioProduct = {
  slug: string
  title: string
  /** Spoken length, for the card. */
  runtime: string
  /** 0 means free. No Stripe checkout. */
  priceCents: number
  group: 'many-thrones' | null
}

/**
 * Object keys in the private audiobook bucket.
 * masters: masters/<slug>.mp3 · samples: samples/<slug>-sample.mp3 · covers: covers/<slug>.jpg
 * The bundle cover is covers/all-13.jpg. The bundle is not itself a download.
 */
function standardAudioFiles(slug: string): AudioFiles {
  return {
    master: `masters/${slug}.mp3`,
    sample: `samples/${slug}-sample.mp3`,
    cover: `covers/${slug}.jpg`,
  }
}

export const AUDIO_PRODUCTS: AudioProduct[] = [
  { slug: 'tales-of-the-empty-throne', title: 'Tales of the Empty Throne', runtime: '1h 31m', priceCents: 0, group: null },
  { slug: 'the-first-five', title: 'The First Five', runtime: '45m', priceCents: 599, group: null },
  { slug: 'many-thrones-1-carvings', title: 'Many Thrones, Book 1: Carvings', runtime: '52m', priceCents: 599, group: 'many-thrones' },
  { slug: 'many-thrones-2-root', title: 'Many Thrones, Book 2: Root', runtime: '51m', priceCents: 599, group: 'many-thrones' },
  { slug: 'many-thrones-3-diver', title: 'Many Thrones, Book 3: Diver', runtime: '50m', priceCents: 599, group: 'many-thrones' },
  { slug: 'many-thrones-4-hollow', title: 'Many Thrones, Book 4: Hollow', runtime: '57m', priceCents: 599, group: 'many-thrones' },
  { slug: 'many-thrones-5-map', title: 'Many Thrones, Book 5: Map', runtime: '56m', priceCents: 599, group: 'many-thrones' },
  { slug: 'many-thrones-6-wont-go', title: "Many Thrones, Book 6: Won't Go", runtime: '51m', priceCents: 599, group: 'many-thrones' },
  { slug: 'many-thrones-7-invite', title: 'Many Thrones, Book 7: Invite', runtime: '57m', priceCents: 599, group: 'many-thrones' },
  { slug: 'the-unseen', title: 'The Unseen', runtime: '1h 30m', priceCents: 799, group: null },
  { slug: 'the-face-of-the-unseen', title: 'The Face of the Unseen', runtime: '1h 10m', priceCents: 799, group: null },
  { slug: 'the-lost-keeper', title: 'The Lost Keeper', runtime: '1h 06m', priceCents: 799, group: null },
  { slug: 'the-choice', title: 'The Choice', runtime: '1h 06m', priceCents: 799, group: null },
]

export const AUDIO_BUNDLE = {
  slug: 'all-13',
  title: 'All 13 Audiobooks',
  priceCents: 2999,
  summary: 'The 12 paid audiobooks together. Tales of the Empty Throne stays free.',
} as const

export const AUDIO_FILES: Record<string, AudioFiles> = Object.fromEntries(
  [...AUDIO_PRODUCTS.map((product) => product.slug), AUDIO_BUNDLE.slug].map((slug) => [slug, standardAudioFiles(slug)]),
)

export function audioFiles(slug: string): AudioFiles | null {
  return AUDIO_FILES[slug] ?? null
}

export function paidAudioProducts(): AudioProduct[] {
  return AUDIO_PRODUCTS.filter((product) => product.priceCents > 0)
}

/** What a paid slug grants. Free stories and unknown slugs are not for sale. */
export function purchaseBySlug(slug: string): { slug: string; title: string; priceCents: number; slugs: string[] } | null {
  if (slug === AUDIO_BUNDLE.slug) {
    return {
      slug,
      title: AUDIO_BUNDLE.title,
      priceCents: AUDIO_BUNDLE.priceCents,
      slugs: paidAudioProducts().map((product) => product.slug),
    }
  }
  const product = AUDIO_PRODUCTS.find((item) => item.slug === slug)
  if (!product || product.priceCents <= 0) return null
  return { slug, title: product.title, priceCents: product.priceCents, slugs: [product.slug] }
}

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
        details: 'JRNYfun Publishing · First Edition · 45 pages · 8.5 × 11 in paperback',
        bonus: {
          before: 'Bonus: the QR code on the back cover unlocks a free audio story, ',
          label: 'Tales of the Empty Throne',
          href: '#audio-tales-of-the-empty-throne',
          after: '.',
        },
        status: 'live',
        statusLabel: 'Available now',
        priceNote: 'See price on Amazon',
        asin: 'B0HNDZ96N5',
        image: {
          src: './coloring-book-cover.webp',
          alt: "Cover of Roman's Game: Tales of the Empty Throne Coloring Book. A boy and five defenders stand before a stone archway.",
        },
      },
      {
        id: 'empty-throne-adult-coloring-book',
        title: "Roman's Game: Tales of the Empty Throne: Adult Coloring Book",
        summary: 'A longer coloring book of the Empty Throne tales. It is not for sale yet.',
        details: '92 pages · 8.5 × 11 in',
        status: 'soon',
        statusLabel: 'Coming soon',
        /** Set this to the ASIN when the book is on Amazon. A cover alone does not put the card on sale. */
        asin: '',
        image: {
          src: './adult-coloring-book-cover.webp',
          alt: "Cover of Roman's Game: Tales of the Empty Throne: Adult Coloring Book. A cracked throne stands in a ruined hall under shafts of light, with a hooded figure at the foot of the steps.",
        },
        links: [
          {
            label: 'Get notified',
            href: 'https://romansgame.com/news/#signup',
          },
        ],
      },
    ],
  },
  {
    id: 'audiobooks',
    label: 'Audiobooks & Stories',
    items: [],
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
