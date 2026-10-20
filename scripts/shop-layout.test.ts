import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatPackCoins, coinStackDiscs } from '../src/game/coinPackDisplay.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const how = readFileSync(new URL('../src/components/HowToPlay.tsx', import.meta.url), 'utf8')
const iap = readFileSync(new URL('../src/game/iap.ts', import.meta.url), 'utf8')
const starter = readFileSync(new URL('../src/game/starterPack.ts', import.meta.url), 'utf8')
const pets = readFileSync(new URL('../src/game/pets.ts', import.meta.url), 'utf8')

test('coin packs keep their prices and show a stacked amount', () => {
  for (const pair of [
    ["id: 'coins_100'", "priceHint: '≈ $0.99'"],
    ["id: 'coins_500'", "priceHint: '≈ $4.99'"],
    ["id: 'coins_1200'", "priceHint: '≈ $9.99'"],
    ["id: 'coins_3000'", "priceHint: '≈ $19.99'"],
  ]) {
    const at = iap.indexOf(pair[0])
    assert.ok(at >= 0, pair[0])
    assert.match(iap.slice(at, at + 180), new RegExp(pair[1].replace(/[$.]/g, '\\$&')))
  }
  assert.equal(formatPackCoins(1200), '+1,200')
  assert.equal(formatPackCoins(3000), '+3,000')
  assert.equal(coinStackDiscs(500), 2)
  assert.equal(coinStackDiscs(1200), 3)
  assert.equal(coinStackDiscs(3000), 5)
  assert.match(starter, /STARTER_PACK_PRICE = 'TBD'/)
  const offers = readFileSync(new URL('../src/game/shopOffers.ts', import.meta.url), 'utf8')
  assert.match(offers, /cadCents: 199/)
  assert.match(offers, /cadCents: 299/)
  assert.match(offers, /Funderwood, 6-2160 Highway 7/)
})

test('shop splits real money from coin spending and confirms treat conversion', () => {
  const shop = app.slice(app.indexOf('data-testid="shop"'), app.indexOf('<h2>Rewards</h2>'))
  assert.match(shop, /data-testid="real-money"/)
  assert.match(shop, /data-testid="spend-coins"/)
  assert.match(shop, /Coins are earned by playing or bought here/)
  assert.match(shop, /They are not real money/)
  assert.match(shop, /data-testid="starter-buy"/)
  assert.match(shop, /formatCad/)
  assert.match(shop, /SHOP_OFFERS/)
  assert.match(shop, /data-testid="shop-proposed"/)
  assert.match(shop, /LegalLine/)
  assert.doesNotMatch(shop, /Coming soon/)
  assert.match(shop, /SNACK_COIN_RATE/)
  assert.match(shop, /data-testid="convert-confirm"/)
  assert.match(shop, /data-testid="convert-yes"/)
  assert.match(shop, /No cash-out/)
  assert.match(shop, /data-testid="balance-coins"/)
  assert.match(shop, /data-testid="balance-treats"/)
  assert.match(app, /swapTreatsToCoins\(/)
  assert.doesNotMatch(shop, /Purchases are unavailable/)
  assert.match(css, /\.reward-row[\s\S]*flex-wrap:\s*wrap/)
  assert.match(css, /\.reward-row[\s\S]*justify-content:\s*center/)
  assert.match(css, /white-space:\s*nowrap/)
  assert.match(pets, /export const SNACK_COIN_RATE = 15/)
  assert.match(pets, /Field treats and feasts can't be swapped/)
})

test('how to play covers the current features without a story spoiler', () => {
  const plain = how.slice(how.indexOf('className="how-plain"'), how.indexOf('className="how-stage"'))
  for (const line of [
    'Playing a board',
    'Daily and Remix',
    'Hints, Undo, and Rescue',
    'Buddies and the Stable',
    'Coins and Treats',
    'Shop',
    'Rewards',
    'Leaderboard',
    'Share',
    'Account and saving',
    'Offline play',
    'not real money',
    'confirm',
    'turns back into cash',
  ]) {
    assert.match(plain, new RegExp(line))
  }
  assert.doesNotMatch(how, /Unseen is Roman/i)
  assert.doesNotMatch(how, /empty throne/i)
})
