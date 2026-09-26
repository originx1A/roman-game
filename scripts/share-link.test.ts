import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { SHARE_LINK_QUERY, publicLinkWithHash, publicPlayUrl } from '../src/game/publicUrl.ts'

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
  const duelAt = app.indexOf('parseDuelFromHash(window.location.hash)')
  const challengeAt = app.indexOf('parseChallengeFromHash(window.location.hash)')
  assert.ok(duelAt > 0)
  assert.ok(challengeAt > duelAt)
  const duelReplace = app.indexOf("window.history.replaceState(null, '', window.location.pathname)", duelAt)
  assert.ok(duelReplace > duelAt)
  assert.ok(challengeAt < app.indexOf("window.history.replaceState(null, '', window.location.pathname)", challengeAt))
  assert.match(app, /const next = window\.location\.pathname \+ window\.location\.hash/)
  assert.match(app, /params\.get\('checkout'\)/)
  assert.equal(app.includes("params.get('s')"), false)
})

test('index.html og:url matches the shared play link and the spa rewrite does not redirect', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /property="og:url" content="https:\/\/romans-game\.netlify\.app\/\?s=2"/)
  assert.match(html, /property="og:image" content="https:\/\/romans-game\.netlify\.app\/og-image\.png"/)
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
  assert.match(toml, /from = "\/\*"\s+to = "\/index.html"\s+status = 200/)
  assert.equal(toml.includes('status = 301'), false)
  assert.equal(toml.includes('status = 302'), false)
})
