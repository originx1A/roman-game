import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Stripe from 'stripe'
import {
  AUDIO_BUNDLE,
  AUDIO_FILES,
  AUDIO_PRODUCTS,
  audioFiles,
  formatCad,
  paidAudioProducts,
  purchaseBySlug,
} from '../src/store/catalog.ts'
import {
  claimDownload,
  fulfillPaidSession,
  makeDownloadToken,
  MAX_DOWNLOADS_PER_PRODUCT,
  memoryBlobStore,
  recordDownload,
  TOKEN_TTL_MS,
  tokenKey,
  type AudioGrant,
  type PaidSession,
} from '../netlify/lib/audioGrant.ts'
import { audiobookCheckoutParams, audioSalesEnabled, automaticTaxEnabled, publicAudioBase } from '../netlify/lib/audioSales.ts'
import { handleAudiobookWebhook } from '../netlify/lib/audioWebhook.ts'
import { thankYouMessage } from '../netlify/lib/resendMail.ts'
import { presignGetUrl, presignR2Get, R2_PRESIGN_SECONDS, r2Settings } from '../netlify/lib/r2Sign.ts'

const PRICES: Record<string, number> = {
  'tales-of-the-empty-throne': 0,
  'the-first-five': 599,
  'many-thrones-1-carvings': 599,
  'many-thrones-2-root': 599,
  'many-thrones-3-diver': 599,
  'many-thrones-4-hollow': 599,
  'many-thrones-5-map': 599,
  'many-thrones-6-wont-go': 599,
  'many-thrones-7-invite': 599,
  'the-unseen': 799,
  'the-face-of-the-unseen': 799,
  'the-lost-keeper': 799,
  'the-choice': 799,
}

test('catalog prices are the 13 audiobooks plus the all-13 bundle', () => {
  assert.equal(AUDIO_PRODUCTS.length, 13)
  assert.deepEqual(
    Object.fromEntries(AUDIO_PRODUCTS.map((product) => [product.slug, product.priceCents])),
    PRICES,
  )
  assert.equal(AUDIO_PRODUCTS.filter((product) => product.group === 'many-thrones').length, 7)
  assert.equal(paidAudioProducts().length, 12)
  assert.equal(AUDIO_BUNDLE.priceCents, 2999)
  assert.equal(formatCad(0), 'Free')
  assert.equal(formatCad(599), 'CA$5.99')
  assert.equal(formatCad(799), 'CA$7.99')
  assert.equal(formatCad(2999), 'CA$29.99')
  assert.equal(AUDIO_PRODUCTS.find((product) => product.slug === 'tales-of-the-empty-throne')?.runtime, '1h 31m')
  assert.equal(AUDIO_PRODUCTS.find((product) => product.slug === 'the-choice')?.runtime, '1h 06m')
  assert.equal(AUDIO_PRODUCTS.find((product) => product.slug === 'many-thrones-1-carvings')?.title, 'Many Thrones, Book 1: Carvings')

  const bundle = purchaseBySlug('all-13')
  assert.ok(bundle)
  assert.equal(bundle.priceCents, 2999)
  assert.equal(bundle.slugs.length, 12)
  assert.equal(bundle.slugs.includes('tales-of-the-empty-throne'), false)
  assert.equal(purchaseBySlug('tales-of-the-empty-throne'), null)
  assert.equal(purchaseBySlug('not-a-book'), null)

  for (const product of AUDIO_PRODUCTS) {
    assert.deepEqual(audioFiles(product.slug), {
      master: `${product.slug}.mp3`,
      sample: `samples/${product.slug}-sample.mp3`,
      cover: `covers/${product.slug}.jpg`,
    })
  }
  assert.equal(Object.keys(AUDIO_FILES).length, 14)
  assert.equal(audioFiles('all-13')?.master, 'all-13.mp3')
})

function paid(slug: string, amount = purchaseBySlug(slug)?.priceCents ?? 0, extra: Partial<PaidSession> = {}): PaidSession {
  return {
    id: 'cs_test_audiobooksession',
    payment_status: 'paid',
    status: 'complete',
    currency: 'cad',
    amount_subtotal: amount,
    email: 'buyer@example.com',
    store: 'audiobook',
    slug,
    ...extra,
  }
}

test('a download token lasts 48 hours and allows 10 downloads per story', async () => {
  const now = Date.parse('2026-10-18T12:00:00.000Z')
  const token = makeDownloadToken()
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  const store = memoryBlobStore()
  const grant = await fulfillPaidSession(store, paid('the-first-five'), now, token)
  assert.ok(grant)
  assert.equal(grant.token, token)
  assert.equal(grant.expiresAt - grant.createdAt, TOKEN_TTL_MS)
  assert.deepEqual(grant.slugs, ['the-first-five'])

  const again = await fulfillPaidSession(store, paid('the-first-five'), now + 1000, 'b'.repeat(43))
  assert.equal(again?.token, token)

  const open = claimDownload(grant, 'the-first-five', now + TOKEN_TTL_MS - 1)
  assert.equal(open.ok, true)
  assert.equal(grant.downloads['the-first-five'], undefined)
  assert.equal(claimDownload(grant, 'the-first-five', now + TOKEN_TTL_MS).ok, false)
  assert.equal(claimDownload(grant, 'the-unseen', now).ok, false)
  assert.equal(claimDownload(grant, 'tales-of-the-empty-throne', now).ok, false)

  let latest: AudioGrant = grant
  for (let n = 1; n <= MAX_DOWNLOADS_PER_PRODUCT; n++) {
    const claimed = await recordDownload(store, token, 'the-first-five', now)
    assert.equal(claimed.ok, true)
    if (claimed.ok) {
      assert.equal(claimed.grant.downloads['the-first-five'], n)
      latest = claimed.grant
    }
  }
  const capped = await recordDownload(store, token, 'the-first-five', now)
  assert.deepEqual(capped, { ok: false, reason: 'limit' })
  const saved = await store.get(tokenKey(token), { type: 'json' }) as AudioGrant
  assert.equal(saved.downloads['the-first-five'], 10)
  assert.equal(latest.downloads['the-first-five'], 10)

  const expired = await recordDownload(store, token, 'the-first-five', now + TOKEN_TTL_MS)
  assert.deepEqual(expired, { ok: false, reason: 'expired' })
})

test('the bundle grants the 12 paid stories and ignores a mismatched subtotal', async () => {
  const store = memoryBlobStore()
  const grant = await fulfillPaidSession(store, paid('all-13', 2999), 1_700_000_000_000, 'c'.repeat(43))
  assert.ok(grant)
  assert.equal(grant.slugs.length, 12)
  assert.equal(grant.slugs.includes('tales-of-the-empty-throne'), false)
  assert.equal(claimDownload(grant, 'all-13', 1_700_000_000_000).ok, false)
  assert.equal(await fulfillPaidSession(memoryBlobStore(), paid('the-unseen', 799, { amount_subtotal: 899 })), null)
  assert.equal(await fulfillPaidSession(memoryBlobStore(), paid('the-unseen', 799, { currency: 'usd' })), null)
  assert.equal(await fulfillPaidSession(memoryBlobStore(), paid('the-unseen', 799, { store: 'coins' })), null)
})

const WEBHOOK_SECRET = 'whsec_test_secret_for_audiobooks'
const AWS_URL =
  'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'

test('R2 presign matches the AWS query-string example and expires in 15 minutes', () => {
  const signed = presignGetUrl({
    host: 'examplebucket.s3.amazonaws.com',
    canonicalUri: '/test.txt',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    now: new Date('2013-05-24T00:00:00.000Z'),
    expiresSeconds: 86400,
  })
  assert.equal(signed, AWS_URL)

  const r2 = presignR2Get({
    accountId: 'account123',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    bucket: 'romansgame-audiobooks',
    key: 'the-first-five.mp3',
    now: new Date('2026-10-18T00:00:00.000Z'),
  })
  const url = new URL(r2)
  assert.equal(url.host, 'account123.r2.cloudflarestorage.com')
  assert.equal(url.pathname, '/romansgame-audiobooks/the-first-five.mp3')
  assert.equal(url.searchParams.get('X-Amz-Expires'), String(R2_PRESIGN_SECONDS))
  assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
  assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/)
  assert.equal(r2Settings({
    R2_ACCOUNT_ID: 'account123',
    R2_ACCESS_KEY_ID: 'access',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: '   ',
  })?.bucket, 'romansgame-audiobooks')
})

function sessionEvent(session: Record<string, unknown>, type = 'checkout.session.completed'): string {
  return JSON.stringify({
    id: 'evt_test_audio',
    object: 'event',
    type,
    data: { object: session },
  })
}

const SESSION = {
  id: 'cs_test_audiobooksession',
  object: 'checkout.session',
  payment_status: 'paid',
  status: 'complete',
  currency: 'cad',
  amount_subtotal: 599,
  amount_total: 678,
  customer_details: { email: 'buyer@example.com' },
  metadata: { store: 'audiobook', slug: 'the-first-five' },
}

test('the webhook verifies the Stripe signature, then records the purchase', async () => {
  const payload = sessionEvent(SESSION)
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  const env = { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, RESEND_API_KEY: 're_test', URL: 'https://play.romansgame.com' }
  const bodies: string[] = []
  const fetchImpl: typeof fetch = async (_url, init) => {
    bodies.push(String(init?.body ?? ''))
    return new Response('{}', { status: 200 })
  }
  const store = memoryBlobStore()
  const ok = await handleAudiobookWebhook({ payload, signature: header, store, env, fetchImpl, now: 1_700_000_000_000 })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.email, 'sent')
  assert.equal(bodies.length, 1)
  const mail = JSON.parse(bodies[0]) as { text: string; from: string; subject: string }
  assert.equal(mail.from, "Roman's Game <support@romansgame.com>")
  assert.match(mail.text, /https:\/\/play\.romansgame\.com\/store\/thanks\?session_id=cs_test_audiobooksession/)
  assert.doesNotMatch(mail.text, /amazon/i)
  assert.doesNotMatch(mail.subject, /amazon/i)
  assert.doesNotMatch(thankYouMessage({ title: 'The First Five', url: 'https://play.romansgame.com/store/thanks?session_id=cs_test_x' }).text, /amazon/i)

  const again = await handleAudiobookWebhook({ payload, signature: header, store, env, fetchImpl, now: 1_700_000_000_000 })
  assert.equal(again.status, 200)
  assert.equal(bodies.length, 1)

  const bad = await handleAudiobookWebhook({
    payload,
    signature: Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_other' }),
    store,
    env,
    fetchImpl,
  })
  assert.equal(bad.status, 400)

  const stale = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
    timestamp: Math.floor(Date.now() / 1000) - 600,
  })
  const expired = await handleAudiobookWebhook({ payload, signature: stale, store, env, fetchImpl })
  assert.equal(expired.status, 400)

  const coins = sessionEvent({ ...SESSION, metadata: { packId: 'coins-small' } })
  const coinHeader = Stripe.webhooks.generateTestHeaderString({ payload: coins, secret: WEBHOOK_SECRET })
  const ignored = await handleAudiobookWebhook({ payload: coins, signature: coinHeader, store: memoryBlobStore(), env, fetchImpl })
  assert.equal(ignored.status, 200)
  assert.equal(ignored.body.ignored, true)
  assert.equal(bodies.length, 1)

  const failedFetch: typeof fetch = async () => new Response('no', { status: 500 })
  const retry = await handleAudiobookWebhook({
    payload,
    signature: header,
    store: memoryBlobStore(),
    env,
    fetchImpl: failedFetch,
    now: 1_700_000_000_000,
  })
  assert.equal(retry.status, 500)
})

test('checkout uses catalog cents in CAD and adds tax only behind the flag', () => {
  const plain = audiobookCheckoutParams({ slug: 'the-unseen', siteBase: 'https://play.romansgame.com', automaticTax: false })
  assert.ok(plain)
  assert.equal(plain.automatic_tax, undefined)
  assert.equal(plain.line_items?.[0]?.price_data && typeof plain.line_items[0].price_data !== 'string' ? plain.line_items[0].price_data.currency : '', 'cad')
  assert.equal(plain.line_items?.[0]?.price_data && typeof plain.line_items[0].price_data !== 'string' ? plain.line_items[0].price_data.unit_amount : 0, 799)
  assert.equal(plain.line_items?.[0]?.price_data && typeof plain.line_items[0].price_data !== 'string' ? plain.line_items[0].price_data.tax_behavior : '', undefined)
  assert.equal(plain.success_url, 'https://play.romansgame.com/store/thanks?session_id={CHECKOUT_SESSION_ID}')
  assert.equal(plain.metadata?.store, 'audiobook')
  assert.equal(audiobookCheckoutParams({ slug: 'tales-of-the-empty-throne', siteBase: 'https://play.romansgame.com', automaticTax: false }), null)

  const taxed = audiobookCheckoutParams({ slug: 'all-13', siteBase: 'https://play.romansgame.com', automaticTax: true })
  assert.deepEqual(taxed?.automatic_tax, { enabled: true })
  assert.equal(taxed?.billing_address_collection, 'required')
  const price = taxed?.line_items?.[0]?.price_data
  assert.equal(price && typeof price !== 'string' ? price.unit_amount : 0, 2999)
  assert.equal(price && typeof price !== 'string' ? price.tax_behavior : '', 'exclusive')

  assert.equal(automaticTaxEnabled({ STRIPE_AUTOMATIC_TAX: 'true' }), true)
  assert.equal(automaticTaxEnabled({}), false)
  assert.equal(audioSalesEnabled({ STORE_AUDIO_SALES_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_123' }), false)
  assert.equal(audioSalesEnabled({
    STORE_AUDIO_SALES_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_123',
    R2_ACCOUNT_ID: 'acc',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
  }), true)
  assert.equal(publicAudioBase({ R2_PUBLIC_BASE_URL: 'https://audio.example.com/' }), 'https://audio.example.com')
  assert.equal(publicAudioBase({ R2_PUBLIC_BASE_URL: 'http://audio.example.com' }), null)
})

test('the thank-you rewrite stays ahead of the single-page fallback', () => {
  const redirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
  const thanks = redirects.indexOf('/store/thanks ')
  const splat = redirects.indexOf('/* /index.html')
  assert.ok(thanks >= 0 && thanks < splat)
  assert.doesNotMatch(redirects, /stories\/audio/)
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
  assert.ok(toml.indexOf('/store/thanks') < toml.indexOf('from = "/*"'))
})
