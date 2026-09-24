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

function readGzB64(dir, base) {
  // Only the single combined file — never join .gz.b64.N shards
  // (partial/corrupt joins caused Z_DATA_ERROR: invalid distance too far back).
  const single = path.join(dir, base + '.gz.b64')
  if (fs.existsSync(single)) return fs.readFileSync(single, 'utf8').replace(/\s+/g, '')
  return null
}

function assemble(prefix, outPath) {
  const dir = path.dirname(prefix)
  const base = path.basename(prefix)

  // 1. Prefer binary gzip (source of truth)
  const gzPath = path.join(dir, base + '.gz')
  if (fs.existsSync(gzPath)) {
    const buf = zlib.gunzipSync(fs.readFileSync(gzPath))
    checkSha(buf, base, dir)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)
    console.log('wrote', outPath, buf.length, 'from binary gzip')
    return
  }

  // 2. Single-file base64 gzip
  const b64 = readGzB64(dir, base)
  if (b64 != null) {
    const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
    checkSha(buf, base, dir)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)
    console.log('wrote', outPath, buf.length, 'from gzip b64')
    return
  }

  // 3. Plaintext shards
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
