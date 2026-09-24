#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'

function checkSha(buf, base, dir) {
  const shaFile = path.join(dir, base + '.sha256')
  if (!fs.existsSync(shaFile)) return
  const expect = fs.readFileSync(shaFile, 'utf8').trim()
  const got = crypto.createHash('sha256').update(buf).digest('hex')
  if (expect !== got) {
    console.error('sha256 mismatch', base, expect, got)
    process.exit(1)
  }
}

/** Parts after `${base}.gz.b64.` — works when base contains dots (e.g. App.tsx). */
function gzSuffix(f, base) {
  const prefix = base + '.gz.b64.'
  if (!f.startsWith(prefix)) return null
  return f.slice(prefix.length)
}

function readGzB64(dir, base) {
  const single = path.join(dir, base + '.gz.b64')
  if (fs.existsSync(single)) return fs.readFileSync(single, 'utf8')

  // Prefer nested micro-chunks: base.gz.b64.i.j
  const nested = fs
    .readdirSync(dir)
    .map((f) => ({ f, suf: gzSuffix(f, base) }))
    .filter((x) => x.suf != null && /^\d+\.\d+$/.test(x.suf))
    .sort((a, b) => {
      const [ai, aj] = a.suf.split('.').map(Number)
      const [bi, bj] = b.suf.split('.').map(Number)
      return ai - bi || aj - bj
    })
  if (nested.length) return nested.map((x) => fs.readFileSync(path.join(dir, x.f), 'utf8')).join('')

  // Flat parts: base.gz.b64.N
  const gzParts = fs
    .readdirSync(dir)
    .map((f) => ({ f, suf: gzSuffix(f, base) }))
    .filter((x) => x.suf != null && /^\d+$/.test(x.suf))
    .sort((a, b) => Number(a.suf) - Number(b.suf))
  if (gzParts.length) return gzParts.map((x) => fs.readFileSync(path.join(dir, x.f), 'utf8')).join('')
  return null
}

function assemble(prefix, outPath) {
  const dir = path.dirname(prefix)
  const base = path.basename(prefix)
  const b64 = readGzB64(dir, base)
  if (b64 != null) {
    const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
    checkSha(buf, base, dir)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)
    console.log('wrote', outPath, buf.length, 'from gzip b64')
    return
  }
  const parts = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(base + '.') && f.endsWith('.txt'))
    .sort((a, b) => Number(a.split('.').slice(-2, -1)[0]) - Number(b.split('.').slice(-2, -1)[0]))
  const text = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('')
  checkSha(Buffer.from(text, 'utf8'), base, dir)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, text)
  console.log('wrote', outPath, text.length, 'from', parts.length, 'txt parts')
}

assemble('scripts/payload/App.tsx', 'src/App.tsx')
assemble('scripts/payload/App.css', 'src/App.css')
