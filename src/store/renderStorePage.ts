import {
  amazonAssociateDisclosure,
  amazonHref,
  AUDIO_BUNDLE,
  AUDIO_PRODUCTS,
  audioFiles,
  formatCad,
  STORE_INTRO,
  STORE_NAV,
  STORE_NOTIFY,
  STORE_SECTIONS,
  STORE_TITLE,
  type AudioProduct,
  type StoreLink,
} from './catalog.ts'

const PAGE_URL = 'https://play.romansgame.com/store/'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHref(href: string): string {
  if (
    href.startsWith('/') ||
    href.startsWith('#') ||
    href.startsWith('./') ||
    href.startsWith('https://') ||
    href.startsWith('http://')
  ) {
    return escapeHtml(href)
  }
  return '#'
}

function linkAttrs(link: StoreLink): string {
  const parts = [`href="${safeHref(amazonHref(link.href))}"`]
  if (link.sponsored) parts.push('target="_blank"', 'rel="noopener sponsored"')
  return parts.join(' ')
}

function cover(itemId: string, title: string, image: { src: string; alt: string } | null | undefined): string {
  if (image?.src) {
    return `<img class="cover" src="${safeHref(image.src)}" alt="${escapeHtml(image.alt)}" width="360" height="540">`
  }
  if (image !== null) return ''
  return `<div class="cover cover-placeholder" role="img" aria-label="Placeholder for the cover of ${escapeHtml(title)}. The cover image is not in the project yet.">
    <!-- TODO: replace this placeholder with the coloring book cover when the file is added to the repo (${escapeHtml(itemId)}). -->
    <span class="cover-kicker">Roman&rsquo;s Game</span>
    <span class="cover-name">Tales of the Empty Throne</span>
    <span class="cover-kind">Coloring book</span>
  </div>`
}

function itemCard(sectionId: string, item: (typeof STORE_SECTIONS)[number]['items'][number]): string {
  const links = (item.links ?? [])
    .map((link) => `<a class="btn" ${linkAttrs(link)}>${escapeHtml(link.label)}</a>`)
    .join('\n          ')
  const price = item.priceNote ? `<p class="price">${escapeHtml(item.priceNote)}</p>` : ''
  const actions = links ? `<div class="actions">\n          ${links}\n        </div>` : ''
  const art = cover(item.id, item.title, item.image)
  const classes = ['product', item.status === 'soon' ? 'product-soon' : '', art ? '' : 'product-text'].filter(Boolean).join(' ')
  return `<article class="${classes}">
      ${art}
      <div class="product-copy">
        <p class="status status-${item.status}">${escapeHtml(item.statusLabel)}</p>
        <h2 id="${escapeHtml(sectionId)}-title">${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.summary)}</p>
        ${price}
        ${actions}
      </div>
    </article>`
}

function audioCover(slug: string, title: string): string {
  const files = audioFiles(slug)
  return `<div class="audio-cover">
        <img data-cover="${escapeHtml(files?.cover ?? '')}" alt="Cover of ${escapeHtml(title)}" width="72" height="72" hidden>
      </div>`
}

function audioSample(product: AudioProduct): string {
  const files = audioFiles(product.slug)
  return `<p class="sample-label">5-minute sample</p>
        <audio class="sample" controls preload="none" data-sample="${escapeHtml(files?.sample ?? '')}" aria-label="5-minute sample of ${escapeHtml(product.title)}" hidden></audio>`
}

function audioCard(product: AudioProduct): string {
  const files = audioFiles(product.slug)
  const offer = product.priceCents === 0
    ? `<p class="actions">
          <a class="btn" data-free="${escapeHtml(files?.master ?? '')}" hidden>Listen or download</a>
        </p>
        <p class="fine" data-free-wait>The free listen link appears when the audio files are online.</p>`
    : `<p class="actions">
          <button type="button" class="btn" data-buy="${escapeHtml(product.slug)}" aria-label="Buy ${escapeHtml(product.title)}" hidden>Buy</button>
        </p>
        <p class="status status-soon" data-soon>Coming soon</p>
        <p class="fine buy-error" data-buy-error role="status"></p>`
  return `<article class="audio-card" id="audio-${escapeHtml(product.slug)}">
      ${audioCover(product.slug, product.title)}
      <div class="audio-copy">
        <h2>${escapeHtml(product.title)}</h2>
        <p class="audio-meta"><span>${escapeHtml(product.runtime)}</span> · <span class="price">${escapeHtml(formatCad(product.priceCents))}</span></p>
        ${audioSample(product)}
        ${offer}
      </div>
    </article>`
}

function manyThrones(products: AudioProduct[]): string {
  return `<details class="audio-group">
      <summary>
        <span class="group-title">Many Thrones</span>
        <span class="group-note">7 books, CA$5.99 each</span>
        <span class="status status-soon" data-soon>Coming soon</span>
      </summary>
      <div class="audio-group-list">
        ${products.map((product) => audioCard(product)).join('\n        ')}
      </div>
    </details>`
}

function bundleCard(): string {
  return `<article class="audio-card audio-bundle" id="audio-${escapeHtml(AUDIO_BUNDLE.slug)}">
      ${audioCover(AUDIO_BUNDLE.slug, AUDIO_BUNDLE.title)}
      <div class="audio-copy">
        <h2>${escapeHtml(AUDIO_BUNDLE.title)}</h2>
        <p>${escapeHtml(AUDIO_BUNDLE.summary)}</p>
        <p class="audio-meta"><span class="price">${escapeHtml(formatCad(AUDIO_BUNDLE.priceCents))}</span></p>
        <p class="actions">
          <button type="button" class="btn" data-buy="${escapeHtml(AUDIO_BUNDLE.slug)}" aria-label="Buy ${escapeHtml(AUDIO_BUNDLE.title)}" hidden>Buy</button>
        </p>
        <p class="status status-soon" data-soon>Coming soon</p>
        <p class="fine buy-error" data-buy-error role="status"></p>
      </div>
    </article>`
}

/** Free story, standalone titles, the Many Thrones group, then the bundle. */
function audiobookShelf(): string {
  const parts: string[] = []
  let grouped = false
  for (const product of AUDIO_PRODUCTS) {
    if (product.group === 'many-thrones') {
      if (!grouped) {
        parts.push(manyThrones(AUDIO_PRODUCTS.filter((item) => item.group === 'many-thrones')))
        grouped = true
      }
      continue
    }
    parts.push(audioCard(product))
  }
  parts.push(bundleCard())
  return `<div class="audio-shelf">\n      ${parts.join('\n      ')}\n    </div>`
}

/** Full store document. Edit src/store/catalog.ts, then regenerate this. */
export function renderStorePage(): string {
  const nav = STORE_NAV.map(
    (item) =>
      `<li><a href="${safeHref(item.href)}"${item.current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a></li>`,
  ).join('')

  const tabs = STORE_SECTIONS.map(
    (section, index) =>
      `<button type="button" role="tab" id="tab-${escapeHtml(section.id)}" data-store-tab="${escapeHtml(section.id)}" aria-controls="${escapeHtml(section.id)}" aria-selected="${index === 0 ? 'true' : 'false'}" tabindex="${index === 0 ? '0' : '-1'}">${escapeHtml(section.label)}</button>`,
  ).join('\n        ')

  const disclosure = amazonAssociateDisclosure()
  const disclosureHtml = disclosure ? `\n    <p class="associate">${escapeHtml(disclosure)}</p>` : ''

  const panels = STORE_SECTIONS.map((section) => {
    const cards = section.items.map((item) => itemCard(section.id, item)).join('\n      ')
    const body = section.id === 'audiobooks' ? audiobookShelf() : cards || `<p>Coming soon.</p>`
    return `<section class="panel" id="${escapeHtml(section.id)}" role="tabpanel" data-store-panel aria-labelledby="tab-${escapeHtml(section.id)}" tabindex="0">
      ${body}
    </section>`
  }).join('\n\n    ')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Store — Roman's Game</title>
  <meta name="description" content="Coloring books, stories, and music from Roman's world. The Tales of the Empty Throne coloring book is on Amazon. Audiobooks are listed in Canadian dollars. Songs and bundles are coming soon.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${PAGE_URL}">
  <meta property="og:title" content="Store — Roman's Game">
  <meta property="og:description" content="The Tales of the Empty Throne coloring book is on Amazon. Audiobooks are listed in Canadian dollars. Songs and bundles are coming soon.">
  <meta property="og:url" content="${PAGE_URL}">
  <meta property="og:type" content="website">
  <link rel="icon" href="https://romansgame.com/assets/icons/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./store.css">
</head>
<body>
  <a class="skip" href="#store">Skip to the store</a>
  <header class="site-header">
    <div class="nav-inner">
      <a class="brand" href="https://romansgame.com/">ROMAN&rsquo;S GAME<span>JRNYfun</span></a>
      <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">&#9776;</button>
      <ul class="nav-links" id="site-nav">${nav}</ul>
    </div>
  </header>
  <img class="shelf-banner" src="../og-image.png" alt="Roman’s Game board with glossy tiles, a yellow buddy, and a gold coin" width="1200" height="630">
  <main class="wrap" id="store">
    <h1>${escapeHtml(STORE_TITLE)}</h1>
    <p class="intro">${escapeHtml(STORE_INTRO)}</p>
    <div class="tabs" role="tablist" aria-label="Store sections">
        ${tabs}
    </div>
    ${panels}
    <aside class="notify">
      <h2>${escapeHtml(STORE_NOTIFY.heading)}</h2>
      <p>${escapeHtml(STORE_NOTIFY.body)}</p>
      <p><a href="${safeHref(STORE_NOTIFY.href)}">${escapeHtml(STORE_NOTIFY.label)}</a></p>
      <p class="fine">${escapeHtml(STORE_NOTIFY.note)}</p>
    </aside>
  </main>
  <footer class="site-footer">
    <div>A <strong>JRNYfun</strong> production</div>
    <p><a href="https://romansgame.com/privacy">Privacy Policy</a> · <a href="https://romansgame.com/terms">Terms of Service</a> · <a href="https://romansgame.com/support">Contact</a></p>${disclosureHtml}
  </footer>
  <script src="./store.js"></script>
</body>
</html>
`
}
