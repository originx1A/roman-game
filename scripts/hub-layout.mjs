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

// 4. Verify the result before the deploy can pick it up.
const checks = [
  [join(dist, 'index.html'), 'Rings of the Keeper', 'hub page must carry the Rings card'],
  [join(dist, 'index.html'), 'href="/game/"', 'hub page must link the game card to /game/'],
  [join(dist, 'index.html'), 'href="/rings/"', 'hub page must link the Rings card to /rings/'],
  [join(dist, 'game', 'index.html'), '<base href="/" />', 'game copy must carry <base href="/">'],
  [join(dist, 'game', 'index.html'), "Roman's Game: free logic puzzle", 'game copy must be the game entry'],
  [join(dist, 'rings', 'index.html'), 'Rings of the Keeper', 'rings copy must be the match game'],
]
for (const [file, marker, why] of checks) {
  if (!readFileSync(file, 'utf8').includes(marker)) fail(`${why} (missing ${JSON.stringify(marker)} in ${file})`)
}

console.log('[hub-layout] OK: / = hub, /game/ = game (+ <base href="/">), /rings/ = match game')
