#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const payloadDir = path.join(__dirname, 'payload')
const root = path.join(__dirname, '..')

function readB64(base) {
  const mono = path.join(payloadDir, base + '.gz.b64')
  if (fs.existsSync(mono) && fs.statSync(mono).size > 100) {
    return fs.readFileSync(mono, 'utf8').replace(/\s+/g, '')
  }
  const re = new RegExp('^' + base.replace(/\./g, '\\.') + '\\.gz\\.b64\\.p(\\d+)$')
  const parts = fs.readdirSync(payloadDir)
    .map((f) => {
      const m = f.match(re)
      return m ? { f, n: Number(m[1]) } : null
    })
    .filter(Boolean)
    .filter(({ f }) => !/p0\d/.test(f)) // prefer p0,p1,p2 over p00,p01
    .sort((a, b) => a.n - b.n)
  if (parts.length === 0) throw new Error('no payload for ' + base)
  return parts.map(({ f }) => fs.readFileSync(path.join(payloadDir, f), 'utf8').replace(/\s+/g, '')).join('')
}

const base = 'App.tsx'
const out = 'src/App.tsx'
const b64 = readB64(base)
const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
const expect = fs.readFileSync(path.join(payloadDir, base + '.sha256'), 'utf8').trim()
const got = crypto.createHash('sha256').update(buf).digest('hex')
if (expect !== got) {
  console.error('sha mismatch', expect, got)
  process.exit(1)
}
fs.writeFileSync(path.join(root, out), buf)
console.log('wrote', out, buf.length)

for (const p of ['src/AppWired.tsx', 'src/.restore-probe.txt', 'scripts/assemble-appwired.cjs']) {
  const fp = path.join(root, p)
  if (fs.existsSync(fp)) fs.rmSync(fp, { force: true })
}
const partsDir = path.join(root, 'src/appwired-parts')
if (fs.existsSync(partsDir)) fs.rmSync(partsDir, { recursive: true, force: true })

// Ensure package.json build does not call assemble-appwired
const pkgPath = path.join(root, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
if (typeof pkg.scripts?.build === 'string' && pkg.scripts.build.includes('assemble-appwired')) {
  pkg.scripts.build = 'tsc -b && vite build'
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log('fixed package.json build script')
}
console.log('INFLATE_OK')
