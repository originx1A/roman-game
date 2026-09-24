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

function readPChunks(base) {
  const re = new RegExp('^' + base.replace(/\./g, '\\.') + '\\.gz\\.b64\\.p(\\d+)$')
  const parts = fs.readdirSync(payloadDir)
    .map((f) => {
      const m = f.match(re)
      return m ? { f, n: Number(m[1]) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n)
  if (parts.length === 0) throw new Error('no chunks for ' + base)
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].n !== i) throw new Error('non-contiguous chunks for ' + base)
  }
  return parts.map(({ f }) => fs.readFileSync(path.join(payloadDir, f), 'utf8').replace(/\s+/g, '')).join('')
}

for (const { base, out } of TARGETS) {
  const b64 = readPChunks(base)
  const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
  const expect = fs.readFileSync(path.join(payloadDir, base + '.sha256'), 'utf8').trim()
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
console.log('INFLATE_OK')
