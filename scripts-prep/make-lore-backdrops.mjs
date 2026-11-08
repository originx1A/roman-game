// One-off prep (not part of the game build): crop the baked poster text out
// of the six approved Defender/Throne artworks on file and write dim-ready
// backdrop WebPs into public/images/lore/. Source art is the site's own
// published landscape posters + the Empty Throne wallpaper; no new art.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SITE = '/home/hatch/workspace/checkout-prod-build/site/assets/images'
const OUT = new URL('../public/images/lore/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// top/height are fractions of the source height; the kept band excludes the
// "ROMAN'S GAME" masthead (top) and the name/tagline block (bottom).
const JOBS = [
  { src: `${SITE}/wallpapers/desktop/throne-desktop.png`, name: 'throne', top: 0.16, height: 0.60 },
  { src: `${SITE}/leo-landscape.webp`, name: 'leo', top: 0.10, height: 0.54 },
  { src: `${SITE}/lupa-landscape.webp`, name: 'lupa', top: 0.10, height: 0.54 },
  { src: `${SITE}/aquila-landscape.webp`, name: 'aquila', top: 0.10, height: 0.56 },
  { src: `${SITE}/nox-landscape.webp`, name: 'nox', top: 0.10, height: 0.52 },
  { src: `${SITE}/invictus-landscape.webp`, name: 'invictus', top: 0.10, height: 0.58 },
]

for (const job of JOBS) {
  const meta = await sharp(job.src).metadata()
  const top = Math.round(meta.height * job.top)
  const height = Math.round(meta.height * job.height)
  const info = await sharp(job.src)
    .extract({ left: 0, top, width: meta.width, height })
    .resize({ width: 1600 })
    .webp({ quality: 72 })
    .toFile(`${OUT}${job.name}.webp`)
  console.log(job.name, `${meta.width}x${meta.height} -> ${info.width}x${info.height}`, `${Math.round(info.size / 1024)}KB`)
}
