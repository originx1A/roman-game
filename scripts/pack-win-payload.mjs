#!/usr/bin/env node
/**
 * Pack src/App.tsx and src/App.css into gzip payloads + MCP-safe p-chunks.
 *
 * Writes:
 *  - base.sha256
 *  - base.gz (binary)
 *  - base.gz.b64 (single file, local convenience)
 *  - base.gz.b64.p00, .p01, ... (exactly 4000 chars each except last)
 *
 * Deletes legacy fragments: .gz.b64.N, nested, .suffix, .txt shards.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const payloadDir = path.join(root, 'scripts', 'payload')
const bases = ['App.tsx', 'App.css']
const CHUNK = 4000

function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function isLegacyFragment(name, base) {
  // Keep MCP-safe p-chunks; delete everything else under base.gz.b64.*
  if (name.startsWith(base + '.gz.b64.')) {
    if (/^p\d+$/.test(name.slice((base + '.gz.b64.').length))) return false
    return true
  }
  // Old plaintext shards: base.N.txt / base.N.M.txt
  if (
    name.startsWith(base + '.') &&
    name.endsWith('.txt') &&
    /^\d+(\.\d+)*$/.test(name.slice(base.length + 1, -4))
  ) {
    return true
  }
  if (name === '_size_test.txt') return true
  return false
}

function deleteLegacy(base) {
  const deleted = []
  for (const f of fs.readdirSync(payloadDir)) {
    if (!isLegacyFragment(f, base) && f !== '_size_test.txt') continue
    if (f === '_size_test.txt' && base !== bases[0]) continue
    fs.unlinkSync(path.join(payloadDir, f))
    deleted.push(f)
  }
  return deleted
}

function writePChunks(base, b64) {
  // Remove prior p-chunks for this base
  const re = new RegExp('^' + base.replace(/\./g, '\\.') + '\\.gz\\.b64\\.p\\d+$')
  for (const f of fs.readdirSync(payloadDir)) {
    if (re.test(f)) fs.unlinkSync(path.join(payloadDir, f))
  }
  const names = []
  for (let i = 0; i < b64.length; i += CHUNK) {
    const part = b64.slice(i, i + CHUNK)
    const idx = String(Math.floor(i / CHUNK)).padStart(2, '0')
    const name = base + '.gz.b64.p' + idx
    fs.writeFileSync(path.join(payloadDir, name), part)
    names.push(name)
  }
  // Verify join
  const joined = names.map((n) => fs.readFileSync(path.join(payloadDir, n), 'utf8')).join('')
  if (joined !== b64) {
    console.error('p-chunk join mismatch for', base)
    process.exit(1)
  }
  return names
}

fs.mkdirSync(payloadDir, { recursive: true })

const allDeleted = []

for (const base of bases) {
  const srcPath = path.join(root, 'src', base)
  const buf = fs.readFileSync(srcPath)
  const hash = sha256hex(buf)
  const gz = zlib.gzipSync(buf, { level: 9 })
  const b64 = gz.toString('base64')

  const deleted = deleteLegacy(base)
  allDeleted.push(...deleted)

  fs.writeFileSync(path.join(payloadDir, base + '.sha256'), hash + '\n')
  fs.writeFileSync(path.join(payloadDir, base + '.gz'), gz)
  fs.writeFileSync(path.join(payloadDir, base + '.gz.b64'), b64)
  const chunks = writePChunks(base, b64)

  console.log(base)
  console.log('  src bytes:', buf.length)
  console.log('  gzip bytes:', gz.length)
  console.log('  b64 chars:', b64.length)
  console.log('  p-chunks:', chunks.join(', '))
  console.log('  sha256:', hash)
  if (deleted.length) console.log('  deleted legacy:', deleted.join(', '))
}

fs.writeFileSync(path.join(payloadDir, 'INFLATE_READY.txt'), 'inflate-ready-pchunks-v1\n')

if (allDeleted.length) {
  console.log('\ndeleted', allDeleted.length, 'legacy fragment file(s)')
} else {
  console.log('\nno legacy fragment files to delete')
}
