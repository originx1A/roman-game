import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const app = rd('../src/App.tsx')
const css = rd('../src/App.css')
const tag = rd('../src/buildTag.ts')

test('9.32-j: home screen carries a way back to romansgame.com before any run starts', () => {
  // Tony 2026-11-07: inside the game there was NO link back to romansgame.com
  // except through the win screen — a dead end. The home screen (the screen a
  // player lands on, before Play) now carries the link in its hero button row.
  const link = app.match(/<a[^>]*data-testid="home-site-link"[^>]*>[\s\S]*?<\/a>/)![0]
  assert.match(link, /className="btn ghost home-site-link"/)
  assert.match(link, /href="https:\/\/romansgame\.com\/"/)
  assert.match(link, /target="_blank"/)
  assert.match(link, /rel="noopener noreferrer"/)
  assert.match(link, /Visit romansgame\.com/)
  // The home screen renders before any puzzle starts; the link sits in that block.
  const homeBlock = app.slice(app.indexOf("{screen === 'home'"), app.indexOf("{screen === 'how'"))
  assert.match(homeBlock, /data-testid="home-site-link"/, 'link must render on the home screen')
  // Web only: store (native app) builds keep players inside the app.
  assert.match(app, /!isStoreBuild\(\) && \(\s*<a[^>]*data-testid="home-site-link"/)
})

test('9.32-j: home return link introduces no footer bar and no new pill chrome', () => {
  // The footer bar stays out (Tony 2026-10-22, asserted in fixv.test.ts), and the
  // link wears the existing .btn ghost styling — the only new CSS is the anchor
  // reset + icon sizing, with no border-radius or background of its own.
  assert.doesNotMatch(app, /<footer/)
  const rule = css.match(/\.home-site-link \{[\s\S]*?\}/)![0]
  assert.doesNotMatch(rule, /border-radius|background/)
  assert.match(rule, /text-decoration: none/)
  assert.match(css, /\.home-site-icon \{/)
})

test('9.32-j: build tag bumped so a phone can tell the preview from live 9.32-i', () => {
  assert.match(tag, /build 9\.32-j/)
})
