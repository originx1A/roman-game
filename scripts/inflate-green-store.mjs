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
  // Prefer explicit p0,p1,p2 only (ignore legacy p00/p3+/stale mono)
  const parts = []
  for (let i = 0; i < 32; i++) {
    const fp = path.join(payloadDir, `${base}.gz.b64.p${i}`)
    if (!fs.existsSync(fp)) break
    parts.push(fs.readFileSync(fp, 'utf8').replace(/\s+/g, ''))
  }
  if (parts.length === 0) throw new Error('no p0.. chunks for ' + base)
  return parts.join('')
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

const pkgPath = path.join(root, 'package.json')
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  if (typeof pkg.scripts?.build === 'string' && pkg.scripts.build.includes('assemble-appwired')) {
    pkg.scripts.build = 'tsc -b && vite build'
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log('fixed package.json build script')
  }
}
console.log('INFLATE_OK')
