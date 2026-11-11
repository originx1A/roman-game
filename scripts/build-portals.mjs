/**
 * Build the two portal packages. Does not deploy, and does not write the default dist/.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = process.env.PORTAL_ARTIFACTS || '/opt/cursor/artifacts'
const source = 'eaa7d13096f5514e20482618cfa5f5ae27942afa'

const sharedForbidden = [
  'supabase.co',
  'sb_publishable',
  'googletagmanager',
  'fonts.googleapis',
  'fonts.gstatic',
  'challenges.cloudflare.com',
  'app.kit.com',
  'checkout.stripe.com',
  'G-9MYJE42RQ1',
  '0x4AAAAAAFfTs2hm1baT01HK',
  'play.romansgame.com',
  'jrny.fun',
  'facebook.com/romansgame',
  'twitter.com/intent',
  'wa.me/',
  'commercialBreak',
  'rewardedBreak',
  'sdk.crazygames.com',
]

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name)
    const stat = statSync(file)
    if (stat.isDirectory()) walk(file, out)
    else out.push(file)
  }
  return out
}

function trimFonts(dist) {
  const assets = path.join(dist, 'assets')
  for (const name of readdirSync(assets)) {
    if (!name.endsWith('.css')) continue
    const file = path.join(assets, name)
    let css = readFileSync(file, 'utf8')
    css = css.replace(/@font-face\{[^}]*\}/g, (block) => {
      const urls = [...block.matchAll(/url\(\.\/([^)]+)\)/g)].map((match) => match[1])
      const keep = urls.filter((url) => /(?:nunito|cinzel)-latin-\d/.test(url) && url.endsWith('.woff2') && !url.includes('latin-ext'))
      if (keep.length === 0) return ''
      return block.replace(/src:[^;]+;/, `src:${keep.map((url) => `url(./${url})format("woff2")`).join(',')};`)
    })
    writeFileSync(file, css)
  }
  const referenced = new Set()
  for (const name of readdirSync(assets)) {
    if (!/\.(css|js|html)$/.test(name)) continue
    const text = readFileSync(path.join(assets, name), 'utf8')
    for (const match of text.matchAll(/[\w.-]+\.(?:woff2?|ttf|otf)/g)) referenced.add(match[0])
  }
  for (const name of readdirSync(assets)) {
    if (/\.(woff2?|ttf|otf)$/.test(name) && !referenced.has(name)) rmSync(path.join(assets, name))
  }
}

function scrub(dist) {
  for (const extra of ['news', 'sitemap.xml', 'robots.txt', 'llms.txt', '_redirects', 'owner.webmanifest']) {
    rmSync(path.join(dist, extra), { recursive: true, force: true })
  }
  trimFonts(dist)
  const privacy = path.join(dist, 'privacy.html')
  const html = readFileSync(privacy, 'utf8').replace(
    /<p><small>Made by <a href="https:\/\/jrny\.fun" target="_blank">JRNY<\/a> \(https:\/\/jrny\.fun\)<\/small><\/p>/,
    '<p><small>Made by JRNY.</small></p>',
  )
  writeFileSync(privacy, html)
}

function audit(dist, portal) {
  const files = walk(dist)
  const textExt = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.txt', '.svg'])
  const hits = []
  for (const file of files) {
    if (!textExt.has(path.extname(file))) continue
    const text = readFileSync(file, 'utf8')
    for (const needle of sharedForbidden) {
      if (text.includes(needle)) hits.push(`${path.relative(dist, file)}: ${needle}`)
    }
    if (portal === 'crazygames' && text.includes('game-cdn.poki.com')) hits.push(`${path.relative(dist, file)}: poki sdk`)
    if (portal === 'poki' && file.endsWith('index.html') && !text.includes('https://game-cdn.poki.com/scripts/v2/poki-sdk.js')) {
      hits.push('index.html missing official Poki SDK script')
    }
  }
  const index = readFileSync(path.join(dist, 'index.html'), 'utf8')
  if (!index.includes('kid-friendly') && !index.includes('kids and grown-ups')) hits.push('index.html dropped the audience description')
  if (!/src="\.\/assets\//.test(index)) hits.push('index.html script is not a relative asset')
  if (hits.length) {
    console.error(hits.join('\n'))
    process.exit(1)
  }
  return files
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function pack(portal) {
  const dist = path.join(root, `dist-${portal}`)
  rmSync(dist, { recursive: true, force: true })
  run('npx', ['vite', 'build', '--mode', portal, '--outDir', `dist-${portal}`, '--emptyOutDir'])
  scrub(dist)
  const files = audit(dist, portal)
  const zipName = `romans-game-${portal}.zip`
  const zipPath = path.join(artifacts, zipName)
  const tmpZip = path.join('/tmp', zipName)
  rmSync(tmpZip, { force: true })
  rmSync(zipPath, { force: true })
  const zipped = spawnSync(
    'python3',
    [
      '-c',
      `import os, zipfile
src, dst = ${JSON.stringify(dist)}, ${JSON.stringify(tmpZip)}
with zipfile.ZipFile(dst, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for dirpath, _, names in os.walk(src):
        for name in names:
            full = os.path.join(dirpath, name)
            z.write(full, os.path.relpath(full, src))
`,
    ],
    { stdio: 'inherit' },
  )
  if (zipped.status !== 0) process.exit(zipped.status ?? 1)
  const copied = spawnSync('cp', [tmpZip, zipPath], { stdio: 'inherit' })
  if (copied.status !== 0) process.exit(copied.status ?? 1)
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0)
  const manifest = {
    portal,
    source,
    buildTag: 'build 9.33-a18-halo',
    files: files.length,
    unpackedBytes: bytes,
    zip: zipPath,
    zipSha256: sha256(zipPath),
    zipBytes: statSync(zipPath).size,
    indexHtml: readFileSync(path.join(dist, 'index.html'), 'utf8').includes('portal-' + portal),
  }
  writeFileSync(path.join(artifacts, `romans-game-${portal}-manifest.json`), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify(manifest, null, 2))
  return manifest
}

mkdirSync(artifacts, { recursive: true })
const crazy = pack('crazygames')
const poki = pack('poki')
writeFileSync(path.join(artifacts, 'romans-game-portals-manifest.json'), JSON.stringify({ source, crazy, poki }, null, 2) + '\n')
