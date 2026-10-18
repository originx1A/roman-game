import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const app = rd('../src/App.tsx')
const idx = rd('../index.html')
const llms = rd('../public/llms.txt')
const priv = rd('../public/privacy.html')

test('9.30-v: footer links to jrny.fun in a new tab, normal rel (passes link value), no tracking', () => {
  const foot = app.match(/<a[^>]*data-testid="jrny-link"[^>]*>[\s\S]*?<\/a>/)![0]
  assert.match(foot, /href="https:\/\/jrny\.fun"/)
  assert.match(foot, /target="_blank"/)
  assert.doesNotMatch(foot, /rel=|utm_|\?/, 'no rel=nofollow, no query/tracking')
  assert.match(foot, /A brand of Funderwood/)
  assert.doesNotMatch(foot, /JRNY/)
})

test('9.30-v: llms.txt and JSON-LD name Funderwood as the business, with jrny.fun as the brand site', () => {
  assert.match(llms, /brand of Funderwood/)
  assert.match(llms, /https:\/\/jrny\.fun/)
  assert.doesNotMatch(llms, /Made by JRNY/)
  const ld = JSON.parse(idx.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])
  for (const k of ['publisher', 'creator']) assert.deepEqual(ld[k], { '@type': 'Organization', name: 'Funderwood', url: 'https://jrny.fun' })
})

test('9.30-v: no personal name in the marketing files or the page head', () => {
  for (const t of [idx, llms, rd('../public/robots.txt'), rd('../public/sitemap.xml'), rd('../public/manifest.webmanifest')]) {
    assert.doesNotMatch(t, /D'Emilio|DEmilio|Tony|tonydemilio/i)
  }
  assert.doesNotMatch(app.match(/data-testid="jrny-link"[\s\S]*?<\/a>/)![0], /Tony|Emilio/)
  assert.match(priv, /Funderwood/)
  assert.match(priv, /Tony D'Emilio/)
  assert.doesNotMatch(priv, /made by JRNY|operating as JRNY|>JRNY</i)
})
