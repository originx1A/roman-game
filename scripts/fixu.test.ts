import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const P = await import('../netlify/lib/purchases.ts')
const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const idx = rd('../index.html')
const robots = rd('../public/robots.txt')
const llms = rd('../public/llms.txt')
const sitemap = rd('../public/sitemap.xml')

test('9.30-u: index.html has a real title, description, Open Graph, and valid VideoGame/WebApplication JSON-LD', () => {
  assert.match(idx, /<title>Roman's Game: free logic puzzle game/)
  assert.match(idx, /<meta name="description" content="Roman's Game is a free, kid-friendly/)
  for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name']) assert.ok(idx.includes(`property="${p}"`), p)
  const m = idx.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)!
  const ld = JSON.parse(m[1])
  assert.deepEqual(ld['@type'], ['VideoGame', 'WebApplication'])
  assert.equal(ld.isAccessibleForFree, true)
  assert.equal(ld.offers.price, '0')
  assert.ok(ld.url.startsWith('https://romans-game.netlify.app'))
  assert.match(idx, /<noscript>/)
})

test('9.30-u: robots.txt lets search + AI crawlers in, keeps /api/ out, points at the sitemap, never names the owner page', () => {
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Googlebot', 'Bingbot', 'OAI-SearchBot', 'Applebot', 'CCBot']) assert.ok(robots.includes(`User-agent: ${bot}`), bot)
  assert.match(robots, /Disallow: \/api\//)
  assert.match(robots, /Sitemap: https:\/\/romans-game\.netlify\.app\/sitemap\.xml/)
  assert.doesNotMatch(robots, /Disallow: \/\s*$/m)
  for (const t of [robots, llms, sitemap, idx]) {
    assert.doesNotMatch(t, /roman-owner/)
    assert.doesNotMatch(t, /sk_(test|live)|rk_(test|live)|ROMAN_OWNER_KEY|whsec_/)
  }
})

test('9.30-u: llms.txt describes the game plainly and links to the site; sitemap lists the public pages', () => {
  assert.match(llms, /^# Roman's Game/)
  for (const w of ['free', 'no account', 'Remix', 'Endless', 'Daily Challenge', 'kid-friendly', 'https://romans-game.netlify.app/']) assert.ok(llms.toLowerCase().includes(w.toLowerCase()), w)
  assert.match(sitemap, /<loc>https:\/\/romans-game\.netlify\.app\/<\/loc>/)
  assert.match(sitemap, /privacy\.html/)
})

test('9.30-u: the owner page is noindex (header + meta) and the redirect keeps real files', () => {
  const toml = rd('../netlify.toml')
  assert.match(toml, /for = "\/roman-owner"[\s\S]*?X-Robots-Tag = "noindex/)
  assert.match(rd('../src/main.tsx'), /noindex, nofollow, noarchive/)
})

const session = { id: 'cs_test_a1B2c3D4e5F6g7H8', amount_total: 499, currency: 'usd', livemode: false }
const pack = { id: 'coins_500', coins: 500 }

test('9.30-u: a purchase record has time, pack, amount, status and a short ref - and no card / name / email / full session id', () => {
  const r = P.buildPurchaseRecord(session, pack, new Date('2026-09-30T14:00:00Z'))
  assert.deepEqual(r, { packId: 'coins_500', coins: 500, at: '2026-09-30T14:00:00.000Z', amountCents: 499, currency: 'usd', status: 'paid', live: false, ref: 'e5F6g7H8' })
  const blob = JSON.stringify(r)
  assert.ok(!blob.includes('cs_test'), 'not the full session id')
  assert.ok(!/@|card|email|name/i.test(blob))
})

test('9.30-u: owner list = last 30 days newest first, totals split live / test / older, old records still show', async () => {
  const st = P.memoryPurchaseStore()
  const now = new Date('2026-09-30T18:00:00Z')
  st.data.set('cs_live_x1', P.buildPurchaseRecord({ id: 'cs_live_AAAA1111', amount_total: 999, currency: 'usd', livemode: true }, { id: 'coins_1200', coins: 1200 }, new Date('2026-09-29T12:00:00Z')))
  st.data.set('cs_live_x2', P.buildPurchaseRecord({ id: 'cs_live_BBBB2222', amount_total: 1999, currency: 'usd', livemode: true }, { id: 'coins_3000', coins: 3000 }, new Date('2026-09-30T13:00:00Z')))
  st.data.set('cs_test_x3', P.buildPurchaseRecord(session, pack, new Date('2026-09-30T15:00:00Z')))
  st.data.set('cs_live_old', { packId: 'coins_500', coins: 500, at: '2026-09-20T12:00:00.000Z' }) // before 9.30-u: no amount stored
  st.data.set('cs_live_ancient', { packId: 'coins_500', coins: 500, at: '2026-07-01T12:00:00.000Z' }) // outside 30 days
  st.data.set('junk', { hello: 1 })
  const s = await P.loadPurchases(st, 30, now)
  assert.equal(s.rows.length, 4)
  assert.deepEqual(s.rows.map((r) => r.ref), ['e5F6g7H8', 'BBBB2222', 'AAAA1111', 'cs_live_old'.slice(-8)])
  assert.deepEqual(s.live, { orders: 2, cents: 2998, currency: 'usd' })
  assert.deepEqual(s.test, { orders: 1, cents: 499, currency: 'usd' })
  assert.deepEqual(s.unknown, { orders: 1, cents: 499, currency: 'usd' }, 'amount filled in from the price list')
  assert.match(s.rows[1].item, /Coin Chest|Coin Bag|Coin Sack|coins/)
  assert.equal(s.rows[0].status, 'paid')
})

test('9.30-u: an empty store gives clean zeros (the page says "No purchases yet")', async () => {
  const s = await P.loadPurchases(P.memoryPurchaseStore(), 30)
  assert.equal(s.rows.length, 0)
  assert.equal(s.live.orders + s.test.orders + s.unknown.orders, 0)
  assert.match(rd('../src/components/OwnerGifts.tsx'), /No purchases yet\./)
  assert.match(rd('../src/components/OwnerGifts.tsx'), /dashboard\.stripe\.com/)
})

test('9.30-u: owner-purchases needs the owner key, is read only, and confirm-checkout writes the record without Stripe changes', () => {
  const fn = rd('../netlify/functions/owner-purchases.ts')
  assert.match(fn, /await ownerGate\(req\)/) // 10.09: password or login token, checked on the server
  assert.doesNotMatch(fn, /stripeClient|readStripeKey|STRIPE_SECRET/)
  const cc = rd('../netlify/functions/confirm-checkout.ts')
  assert.match(cc, /buildPurchaseRecord\(session, pack\)/)
  assert.match(cc, /onlyIfNew: true/)
})
