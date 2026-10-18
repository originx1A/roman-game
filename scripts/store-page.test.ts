import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { AMAZON_ASSOCIATE_DISCLOSURE, amazonAssociateDisclosure, amazonHref, amazonTagCA, amazonTagUS, STORE_SECTIONS } from '../src/store/catalog.ts'
import { renderStorePage } from '../src/store/renderStorePage.ts'

const html = renderStorePage()
const page = readFileSync(new URL('../public/store/index.html', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')

test('store catalog is the four shelves, with the coloring book live and nothing else priced', () => {
  assert.deepEqual(STORE_SECTIONS.map((s) => s.id), ['coloring-books', 'audiobooks', 'music', 'bundles'])
  const book = STORE_SECTIONS[0].items[0]
  assert.equal(book.status, 'live')
  assert.equal(book.priceNote, 'See price on Amazon')
  assert.deepEqual(
    book.links?.map((l) => l.href),
    ['https://www.amazon.ca/dp/B0HNDZ96N5', 'https://www.amazon.com/dp/B0HNDZ96N5'],
  )
  for (const section of STORE_SECTIONS.slice(1)) {
    assert.equal(section.items[0].status, 'soon')
    assert.equal(section.items[0].links, undefined)
    assert.equal(section.items[0].priceNote, undefined)
  }
})

test('store page links Amazon in a new tab, points at the existing newsletter, and has no payment code', () => {
  assert.equal(page, html)
  assert.match(html, /rel="noopener sponsored"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /https:\/\/www\.amazon\.ca\/dp\/B0HNDZ96N5/)
  assert.match(html, /https:\/\/www\.amazon\.com\/dp\/B0HNDZ96N5/)
  assert.match(html, /See price on Amazon/)
  assert.match(html, /Coming soon/)
  assert.match(html, /Saga 1 will be free/)
  assert.match(html, /href="https:\/\/romansgame\.com\/news\/#signup"/)
  assert.match(html, /Get notified/)
  assert.match(html, /role="tablist"/)
  assert.match(html, /aria-current="page"/)
  assert.doesNotMatch(html, /\$\d/)
  assert.doesNotMatch(html, /stripe|checkout|sk_live|sk_test|supabase/i)
})

test('the game nav and sitemap point at /store/', () => {
  assert.match(app, /href="\/store\/"/)
  assert.match(sitemap, /<loc>https:\/\/play\.romansgame\.com\/store\/<\/loc>/)
})

test('Amazon Associates tags are appended per shop, and an empty tag leaves the link alone', () => {
  assert.equal(amazonTagCA, 'jrny06-20')
  assert.equal(amazonTagUS, 'jrny00-20')
  assert.equal(amazonHref('https://www.amazon.ca/dp/B0HNDZ96N5'), 'https://www.amazon.ca/dp/B0HNDZ96N5?tag=jrny06-20')
  assert.equal(amazonHref('https://www.amazon.com/dp/B0HNDZ96N5'), 'https://www.amazon.com/dp/B0HNDZ96N5?tag=jrny00-20')
  assert.equal(amazonHref('https://www.amazon.ca/dp/B0HNDZ96N5', { ca: '', us: 'jrny00-20' }), 'https://www.amazon.ca/dp/B0HNDZ96N5')
  assert.equal(amazonHref('https://www.amazon.com/dp/B0HNDZ96N5', { ca: 'jrny06-20', us: '' }), 'https://www.amazon.com/dp/B0HNDZ96N5')
  assert.equal(amazonAssociateDisclosure(), AMAZON_ASSOCIATE_DISCLOSURE)
  assert.equal(amazonAssociateDisclosure({ ca: '', us: '' }), '')
  assert.match(html, /amazon\.ca\/dp\/B0HNDZ96N5\?tag=jrny06-20/)
  assert.match(html, /amazon\.com\/dp\/B0HNDZ96N5\?tag=jrny00-20/)
  assert.match(html, /As an Amazon Associate we earn from qualifying purchases\./)
  assert.match(html, /coloring-book-cover\.webp/)
  assert.match(html, /shelf-banner/)
  assert.doesNotMatch(html, /tag=jrny06-20[\s\S]*tag=jrny06-20/)
})
