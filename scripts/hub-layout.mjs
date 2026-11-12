// Games Hub layout step — runs as `postbuild` after `npm run build`.
// The Vite output in dist/ is the game. Rearrange it into the hub layout:
//
//   dist/index.html       -> hub page (hub/hub.html) — the front door
//   dist/game/index.html  -> the game, with <base href="/"> injected so its
//                             ./assets, ./favicon, ./manifest references keep
//                             resolving from the site root (they are relative)
//   dist/rings/index.html -> the match game (hub/rings.html)
//
// The game's own files are untouched; only the /game/ copy is adapted.
// Fails loudly (exit 1) if any expected file or marker is missing, so a
// broken layout can never ship silently.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const fail = (msg) => {
  console.error(`[hub-layout] FAIL: ${msg}`)
  process.exit(1)
}

const gameIndex = join(dist, 'index.html')
if (!existsSync(gameIndex)) fail('dist/index.html missing — the Vite build did not produce the game entry')

const gameHtml = readFileSync(gameIndex, 'utf8')
if (gameHtml.includes('<base')) fail('dist/index.html already has a <base> tag — refusing to double-inject')
if (!gameHtml.includes('<head>')) fail('dist/index.html has no <head> to inject <base href="/"> into')
if (!gameHtml.includes('./assets/')) fail('dist/index.html does not look like the game entry (no ./assets/ reference)')

// 1. Game copy at /game/ — derive from the fresh build, never a stale copy.
const gameCopy = gameHtml.replace('<head>', '<head>\n    <base href="/" />')
if (!gameCopy.includes('<base href="/" />')) fail('base injection failed')
mkdirSync(join(dist, 'game'), { recursive: true })
writeFileSync(join(dist, 'game', 'index.html'), gameCopy)

// 2. Hub page at the root.
const hubSrc = join(root, 'hub', 'hub.html')
if (!existsSync(hubSrc)) fail('hub/hub.html missing')
cpSync(hubSrc, join(dist, 'index.html'))

// 3. Match game at /rings/.
const ringsSrc = join(root, 'hub', 'rings.html')
if (!existsSync(ringsSrc)) fail('hub/rings.html missing')
mkdirSync(join(dist, 'rings'), { recursive: true })
cpSync(ringsSrc, join(dist, 'rings', 'index.html'))

// 3b. Sign-in bridge at /auth-bridge.html (two-way sign-in, Nov 12, 2026).
const bridgeSrc = join(root, 'hub', 'auth-bridge.html')
if (!existsSync(bridgeSrc)) fail('hub/auth-bridge.html missing')
cpSync(bridgeSrc, join(dist, 'auth-bridge.html'))

// 4. Verify the result before the deploy can pick it up.
const checks = [
  [join(dist, 'index.html'), 'Rings of the Keeper', 'hub page must carry the Rings card'],
  [join(dist, 'index.html'), 'href="/game/"', 'hub page must link the game card to /game/'],
  [join(dist, 'index.html'), 'href="/rings/"', 'hub page must link the Rings card to /rings/'],
  [join(dist, 'index.html'), 'id="sponsor-credit"', 'hub page must carry the sponsor credit line'],
  [join(dist, 'index.html'), '/api/sponsors-feed', 'hub sponsor line must read the sponsors feed'],
  [join(dist, 'index.html'), 'id="hub-auth-sheet"', 'hub page must carry the sign-in sheet (not a bare link-out)'],
  [join(dist, 'index.html'), 'id="hub-signin-btn"', 'hub sign-in button must open the sheet'],
  [join(dist, 'index.html'), 'only saves your progress', 'hub sign-in panel must say plainly that signing in only saves progress'],
  [join(dist, 'index.html'), 'data-form="signin"', 'hub sign-in sheet must carry the sign-in form'],
  [join(dist, 'game', 'index.html'), '<base href="/" />', 'game copy must carry <base href="/">'],
  [join(dist, 'game', 'index.html'), "Roman's Game: free logic puzzle", 'game copy must be the game entry'],
  [join(dist, 'rings', 'index.html'), 'Rings of the Keeper', 'rings copy must be the match game'],
  [join(dist, 'rings', 'index.html'), 'ringsPauseAudio', 'rings page must stop its audio when the player leaves'],
  [join(dist, 'rings', 'index.html'), '100dvh', 'rings page must use dynamic viewport units (locked layout)'],
  [join(dist, 'rings', 'index.html'), 'overscroll-behavior: none', 'rings page must block overscroll'],
  [join(dist, 'rings', 'index.html'), 'container-type: size', 'rings board frame must size the board to the viewport'],
  [join(dist, 'rings', 'index.html'), 'touch-action: none', 'rings board must not scroll on swipe'],
  [join(dist, 'auth-bridge.html'), 'Signing you in', 'bridge page must show the signing-in message'],
  [join(dist, 'auth-bridge.html'), '/api/auth/handoff/mint', 'bridge page must mint a handoff code'],
]
for (const [file, marker, why] of checks) {
  if (!readFileSync(file, 'utf8').includes(marker)) fail(`${why} (missing ${JSON.stringify(marker)} in ${file})`)
}

// The game home screen renders from the JS bundle, not from index.html —
// check the built bundle for the home buttons.
const gameCopyHtml = readFileSync(join(dist, 'game', 'index.html'), 'utf8')
const bundleMatch = gameCopyHtml.match(/src="\.\/assets\/(index-[^"]+\.js)"/)
if (!bundleMatch) fail('game copy does not reference its main JS bundle')
const bundlePath = join(dist, 'assets', bundleMatch[1])
if (!existsSync(bundlePath)) fail(`game bundle missing: ${bundlePath}`)
const bundleChecks = [
  // JSX data-testid compiles to "data-testid":"…" in the minified bundle,
  // so check the values (they also appear in the class names).
  ['home-hub-link', 'game home must carry the Back to game hub button'],
  ['home-site-link', 'game home must still carry the Visit romansgame.com link'],
  // The sound module's hide wiring is the only pagehide/pageshow listener
  // in the game — the function names themselves are minified away.
  ['pagehide', 'game sound module must stop audio when the player leaves'],
  ['pageshow', 'game sound module must handle return from the back-forward cache'],
]
const bundleText = readFileSync(bundlePath, 'utf8')
for (const [marker, why] of bundleChecks) {
  if (!bundleText.includes(marker)) fail(`${why} (missing ${JSON.stringify(marker)} in the game bundle)`)
}

// Sponsor credit lives on the hub ONLY — the games must not carry it.
const forbidden = [
  [join(dist, 'index.html'), 'href="https://romansgame.com">Sign in', 'hub sign-in must open the sheet, not link out to romansgame.com'],
  [join(dist, 'game', 'index.html'), 'Sponsored by', 'game copy must not carry a sponsor credit'],
  [join(dist, 'game', 'index.html'), 'sponsors-feed', 'game copy must not fetch the sponsors feed'],
  [join(dist, 'game', 'index.html'), 'Northroom', 'game copy must not name the house sponsor'],
  [join(dist, 'rings', 'index.html'), 'Sponsored by', 'rings page must not carry a sponsor credit'],
  [join(dist, 'rings', 'index.html'), 'Northroom', 'rings page must not name the house sponsor'],
]
for (const [file, marker, why] of forbidden) {
  if (readFileSync(file, 'utf8').includes(marker)) fail(`${why} (found ${JSON.stringify(marker)} in ${file})`)
}

console.log('[hub-layout] OK: / = hub, /game/ = game (+ <base href="/">), /rings/ = match game')
