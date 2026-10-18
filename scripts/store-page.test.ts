import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { AMAZON_ASSOCIATE_DISCLOSURE, amazonAssociateDisclosure, amazonHref, amazonTagCA, amazonTagUS, STORE_SECTIONS } from '../src/store/catalog.ts'
import { renderStorePage } from '../src/store/renderStorePage.ts'

const html = renderStorePage()
const page = readFileSync(new URL('../public/store/index.html', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')

test('store catalog keeps the coloring book live, and music and bundles unpriced', () => {
  assert.deepEqual(STORE_SECTIONS.map((s) => s.id), ['coloring-books', 'audiobooks', 'music', 'bundles'])
  const book = STORE_SECTIONS[0].items[0]
  assert.equal(book.status, 'live')
  assert.equal(book.asin, 'B0HNDZ96N5')
  assert.equal(book.priceNote, 'See price on Amazon')
  assert.equal(book.details, 'JRNYfun Publishing · First Edition · 45 pages · 8.5 × 11 in paperback')
  assert.equal(book.bonus?.href, '#audio-tales-of-the-empty-throne')
  const adult = STORE_SECTIONS[0].items[1]
  assert.equal(adult.status, 'soon')
  assert.equal(adult.asin, '')
  assert.equal(adult.priceNote, undefined)
  assert.equal(adult.image, null)
  assert.equal(adult.details, '92 pages · 8.5 × 11 in')
  assert.deepEqual(adult.links?.map((l) => l.href), ['https://romansgame.com/news/#signup'])
  assert.equal(STORE_SECTIONS[1].items.length, 0)
  for (const section of STORE_SECTIONS.slice(2)) {
    assert.equal(section.items[0].status, 'soon')
    assert.equal(section.items[0].links, undefined)
    assert.equal(section.items[0].priceNote, undefined)
  }
})

test('store page links Amazon in a new tab and points at the existing newsletter', () => {
  assert.equal(page, html)
  assert.match(html, /rel="noopener sponsored"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /https:\/\/www\.amazon\.ca\/dp\/B0HNDZ96N5/)
  assert.match(html, /https:\/\/www\.amazon\.com\/dp\/B0HNDZ96N5/)
  assert.match(html, /See price on Amazon/)
  assert.match(html, /Coming soon/)
  assert.match(html, /href="https:\/\/romansgame\.com\/news\/#signup"/)
  assert.match(html, /Get notified/)
  assert.match(html, /role="tablist"/)
  assert.match(html, /aria-current="page"/)
  assert.match(html, /Many Thrones, Book 1: Carvings/)
  assert.match(html, /data-buy="the-first-five"/)
  assert.match(html, /<details class="audio-group">/)
  const coloring = html.slice(html.indexOf('id="coloring-books"'), html.indexOf('id="audiobooks"'))
  const adult = html.slice(html.indexOf('id="empty-throne-adult-coloring-book"'), html.indexOf('id="audiobooks"'))
  const audio = html.slice(html.indexOf('id="audiobooks"'), html.indexOf('id="music"'))
  assert.doesNotMatch(coloring, /CA\$/)
  assert.match(coloring, /JRNYfun Publishing · First Edition · 45 pages · 8\.5 × 11 in paperback/)
  assert.match(coloring, /Bonus: the QR code on the back cover unlocks a free audio story, <a href="#audio-tales-of-the-empty-throne">Tales of the Empty Throne<\/a>\./)
  assert.match(adult, /92 pages · 8\.5 × 11 in/)
  assert.match(adult, /href="https:\/\/romansgame\.com\/news\/#signup"/)
  assert.doesNotMatch(adult, /amazon\.(ca|com)|See price on Amazon|Buy on Amazon/)
  assert.doesNotMatch(audio, /amazon/i)
  assert.doesNotMatch(audio, /stories\/audio/)
  assert.doesNotMatch(html, /sk_live|sk_test|whsec_|supabase/i)
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
  assert.equal(html.split(AMAZON_ASSOCIATE_DISCLOSURE).length - 1, 2)
  assert.doesNotMatch(html, /As an Amazon Associate we earn/)
  assert.match(html, /coloring-book-cover\.webp/)
  assert.match(html, /shelf-banner/)
  assert.doesNotMatch(html, /tag=jrny06-20[\s\S]*tag=jrny06-20/)
})
