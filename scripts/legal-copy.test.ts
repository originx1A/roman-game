import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

register('./ts-resolve.mjs', import.meta.url)
const L = await import('../src/game/legalCopy.ts')

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const pin = readFileSync(new URL('../src/components/PurchasePinSheet.tsx', import.meta.url), 'utf8')
const agree = readFileSync(new URL('../src/components/LegalPurchases.tsx', import.meta.url), 'utf8')
const card = readFileSync(new URL('../src/components/CoinPackCard.tsx', import.meta.url), 'utf8')
const shortfall = readFileSync(new URL('../src/components/ShortfallSheet.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../public/legal.html', import.meta.url), 'utf8')
const privacy = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8')

test('legal draft covers purchases, refunds, privacy, parents, and the company', () => {
  assert.match(L.LEGAL_DRAFT_BANNER, /DRAFT for owner review/)
  assert.equal(L.LEGAL_CONTACT_EMAIL, 'hello@jrny.fun')
  assert.equal(L.LEGAL_COMPANY_URL, 'https://jrny.fun')
  assert.equal(L.PURCHASE_AGREE, 'By buying you agree to the Terms and Refund Policy')
  const text = L.LEGAL_BLOCKS.map((b) => b.paragraphs.join(' ')).join('\n')
  assert.match(text, /no cash value/)
  assert.match(text, /Canadian dollars \(CAD\)/)
  assert.match(text, /US dollars \(USD\)/)
  assert.match(text, /including taxes/)
  assert.match(text, /14 days/)
  assert.match(text, /unspent/)
  assert.match(text, /Quebec/)
  assert.match(text, /chargeback/i)
  assert.match(text, /Google Analytics stays off/)
  assert.match(text, /purchase PIN/)
  assert.match(text, /Face ID/)
  assert.match(text, /CA\$50/)
  assert.match(text, /hello@jrny\.fun/)
  for (const file of [page, privacy]) {
    assert.match(file, /DRAFT for owner review/)
    assert.doesNotMatch(file, /Tony|D'Emilio|tonydemilio/i)
  }
  assert.match(page, /hello@jrny\.fun/)
  assert.match(page, /14 days/)
})

test('Legal & Purchases is in the menu, settings, buy buttons, and the PIN screen', () => {
  assert.match(app, /Legal & Purchases/)
  assert.match(app, /setLegalSection\('terms'\)/)
  assert.match(app, /LegalPurchases/)
  assert.match(card, /LegalBuyLink/)
  assert.match(shortfall, /LegalBuyLink/)
  assert.match(pin, /PurchaseAgreeLine/)
  assert.match(pin, /LegalBuyLink/)
  assert.match(agree, /By buying you agree to the/)
  assert.match(agree, /Refund Policy/)
  assert.match(pin, /email is verified/)
})
