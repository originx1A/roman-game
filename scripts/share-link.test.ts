import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildShareLinks, mailBody } from '../src/game/share.ts'
import { SHARE_LINK_QUERY, publicLinkWithHash, publicPlayUrl, publicShortLink, shareIdFromPath } from '../src/game/publicUrl.ts'

const PLAY = 'https://romans-game.netlify.app/?s=2'

test('shared play link carries the cache-bust query', () => {
  assert.equal(SHARE_LINK_QUERY, 's=2')
  assert.equal(publicPlayUrl(), PLAY)
})

test('challenge and duel links keep the query in front of the hash', () => {
  const challenge = publicLinkWithHash('challenge=abc_XYZ-1')
  const duel = publicLinkWithHash('#duel=xyz')
  assert.equal(challenge, `${PLAY}#challenge=abc_XYZ-1`)
  assert.equal(duel, `${PLAY}#duel=xyz`)
  for (const link of [challenge, duel]) {
    const url = new URL(link)
    assert.equal(url.searchParams.get('s'), '2')
    assert.equal(url.searchParams.get('checkout'), null)
    assert.equal([...url.searchParams.keys()].join(','), 's')
    assert.equal(url.hash.includes('?'), false)
    assert.equal(url.hash.includes('s=2'), false)
  }
})

test('the app reads the hash and does not treat the share query as navigation', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const shortAt = app.indexOf('shareIdFromPath(window.location.pathname)')
  const duelAt = app.indexOf('parseDuelFromHash(window.location.hash)')
  const challengeAt = app.indexOf('parseChallengeFromHash(window.location.hash)')
  assert.ok(shortAt > 0)
  assert.ok(duelAt > shortAt)
  assert.ok(challengeAt > duelAt)
  const keep = "window.history.replaceState(null, '', window.location.pathname + window.location.search)"
  assert.ok(challengeAt < app.indexOf(keep, challengeAt))
  assert.match(app, /const next = window\.location\.pathname \+ window\.location\.hash/)
  assert.match(app, /params\.get\('checkout'\)/)
  assert.equal(app.includes("params.get('s')"), false)
})

test('short links keep the card query and mail puts https on its own line', () => {
  const id = 'abcd2345'
  const link = publicShortLink(id)
  assert.equal(link, 'https://romans-game.netlify.app/c/abcd2345?s=2')
  assert.equal(shareIdFromPath(new URL(link).pathname), id)
  assert.equal(shareIdFromPath('/'), null)
  const body = mailBody('Beat me on Dawn', link)
  assert.match(body, /\n\nhttps:\/\/romans-game\.netlify\.app\/c\/abcd2345\?s=2\n$/)
  const mailto = buildShareLinks({ url: link, text: 'Beat me on Dawn', title: "Roman's Game" }).mailto
  const decoded = decodeURIComponent(mailto.split('body=')[1] || '')
  assert.match(decoded, /\nhttps:\/\/romans-game\.netlify\.app\/c\/abcd2345\?s=2\n/)
  assert.ok(mailto.length < 500, `mailto length ${mailto.length}`)
})

test('index.html og:url matches the shared play link and the spa rewrite does not redirect', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /property="og:url" content="https:\/\/romans-game\.netlify\.app\/\?s=2"/)
  assert.match(html, /property="og:image" content="https:\/\/romans-game\.netlify\.app\/og-image\.png"/)
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
  const shortRule = toml.indexOf('from = "/c/*"')
  const spaRule = toml.indexOf('from = "/*"')
  assert.ok(shortRule > 0)
  assert.ok(spaRule > shortRule)
  assert.match(toml, /from = "\/c\/\*"\s+to = "\/index.html"\s+status = 200/)
  assert.match(toml, /from = "\/\*"\s+to = "\/index.html"\s+status = 200/)
  assert.equal(toml.includes('status = 301'), false)
  assert.equal(toml.includes('status = 302'), false)
})
