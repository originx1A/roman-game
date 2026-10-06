/**
 * Build the store icon and splash sources from the game's existing mark:
 * navy field (#07122a), green stone (#1f6f5b), orange center (#d97745).
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function markSvg(size) {
  const c = size / 2
  const outer = size * 0.34
  const inner = size * 0.16
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${c}" cy="${c}" r="${outer}" fill="#1f6f5b"/>
  <circle cx="${c}" cy="${c}" r="${inner}" fill="#d97745"/>
</svg>`
}

function fullBleedSvg(size, markScale) {
  const c = size / 2
  const outer = size * markScale
  const inner = outer * 0.47
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#07122a"/>
  <circle cx="${c}" cy="${c}" r="${outer}" fill="#1f6f5b"/>
  <circle cx="${c}" cy="${c}" r="${inner}" fill="#d97745"/>
</svg>`
}

async function png(svg, file, size) {
  await mkdir(dirname(file), { recursive: true })
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
}

await png(markSvg(1024), join(root, 'assets/logo.png'), 1024)
await png(fullBleedSvg(1024, 0.28), join(root, 'assets/icon-only.png'), 1024)
await png(fullBleedSvg(2732, 0.16), join(root, 'assets/splash.png'), 2732)
await png(fullBleedSvg(2732, 0.16), join(root, 'assets/splash-dark.png'), 2732)
await png(fullBleedSvg(192, 0.3), join(root, 'public/icons/icon-192.png'), 192)
await png(fullBleedSvg(512, 0.3), join(root, 'public/icons/icon-512.png'), 512)
await png(fullBleedSvg(512, 0.22), join(root, 'public/icons/icon-maskable-512.png'), 512)
await png(fullBleedSvg(180, 0.3), join(root, 'public/icons/apple-touch-icon.png'), 180)
console.log('Wrote icon and splash sources')
