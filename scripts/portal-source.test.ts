import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('default index.html still loads Google fonts and the site analytics snippet', () => {
  const html = read('../index.html')
  assert.match(html, /fonts\.googleapis\.com/)
  assert.match(html, /googletagmanager\.com\/gtag\/js/)
  assert.match(html, /G-9MYJE42RQ1/)
  assert.doesNotMatch(html, /game-cdn\.poki\.com/)
  assert.doesNotMatch(html, /sdk\.crazygames\.com/)
})

test('portal boot does not call ad breaks', () => {
  const boot = read('../src/portal/install.portal.ts').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(boot, /gameplayStart/)
  assert.match(boot, /gameplayStop/)
  assert.match(boot, /gameLoadingFinished/)
  assert.doesNotMatch(boot, /commercialBreak|rewardedBreak|requestAd|midgame/)
})

test('portal storage failures are swallowed only for portal builds', () => {
  const storage = read('../src/game/storage.ts')
  assert.match(storage, /if \(!portalBuild\(\)\) throw err/)
})
