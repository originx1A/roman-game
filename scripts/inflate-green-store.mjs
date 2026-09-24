#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const payloadDir = path.join(__dirname, 'payload')
const root = path.join(__dirname, '..')

const TARGETS = [
  { base: 'App.tsx', out: 'src/App.tsx' },
  { base: 'App.css', out: 'src/App.css' },
  { base: 'comments.ts', out: 'src/game/comments.ts' },
  { base: 'sound.ts', out: 'src/game/sound.ts' },
]

function readB64(base) {
  const mono = path.join(payloadDir, base + '.gz.b64')
  if (fs.existsSync(mono)) {
    return fs.readFileSync(mono, 'utf8').replace(/\s+/g, '')
  }
  const re = new RegExp('^' + base.replace(/\./g, '\\.') + '\\.gz\\.b64\\.p(\\d+)$')
  const parts = fs.readdirSync(payloadDir)
    .map((f) => {
      const m = f.match(re)
      return m ? { f, n: Number(m[1]) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n)
  if (parts.length === 0) throw new Error('no payload for ' + base)
  return parts.map(({ f }) => fs.readFileSync(path.join(payloadDir, f), 'utf8').replace(/\s+/g, '')).join('')
}

for (const { base, out } of TARGETS) {
  const shaPath = path.join(payloadDir, base + '.sha256')
  if (!fs.existsSync(shaPath)) {
    console.log('skip', base, '(no sha)')
    continue
  }
  const b64 = readB64(base)
  const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
  const expect = fs.readFileSync(shaPath, 'utf8').trim()
  const got = crypto.createHash('sha256').update(buf).digest('hex')
  if (expect !== got) {
    console.error('sha mismatch', base, expect, got)
    process.exit(1)
  }
  const dest = path.join(root, out)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
  console.log('wrote', out, buf.length)
}
// Always remove probe artifacts after inflate
for (const p of ['src/AppWired.tsx', 'src/.restore-probe.txt', 'scripts/assemble-appwired.cjs']) {
  const fp = path.join(root, p)
  if (fs.existsSync(fp)) fs.rmSync(fp, { force: true })
}
const partsDir = path.join(root, 'src/appwired-parts')
if (fs.existsSync(partsDir)) fs.rmSync(partsDir, { recursive: true, force: true })
console.log('INFLATE_OK')
