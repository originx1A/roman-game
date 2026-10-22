import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const app = rd('../src/App.tsx')
const idx = rd('../index.html')
const llms = rd('../public/llms.txt')
const priv = rd('../public/privacy.html')

test('9.30-v: privacy page links to jrny.fun in a new tab, normal rel (passes link value), no tracking', () => {
  // Footer bar (which carried the in-app jrny-link) removed 2026-10-22 on Tony's order — screen space.
  assert.doesNotMatch(app, /data-testid="jrny-link"/)
  const pv = priv.match(/<a href="https:\/\/jrny\.fun"[^>]*>JRNY<\/a>/)![0]
  assert.match(pv, /target="_blank"/)
  assert.doesNotMatch(pv, /rel=|utm_/)
})

test('9.30-v: llms.txt and JSON-LD name JRNY (Organization, https://jrny.fun) as maker', () => {
  assert.match(llms, /Made by JRNY \(https:\/\/jrny\.fun\)/)
  const ld = JSON.parse(idx.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])
  for (const k of ['publisher', 'creator']) assert.deepEqual(ld[k], { '@type': 'Organization', name: 'JRNY', url: 'https://jrny.fun' })
})

test('9.30-v: no personal name in the public files or the page head', () => {
  for (const t of [idx, llms, priv, rd('../public/robots.txt'), rd('../public/sitemap.xml'), rd('../public/manifest.webmanifest')]) {
    assert.doesNotMatch(t, /D'Emilio|DEmilio|Tony|tonydemilio/i)
  }
})
