#!/usr/bin/env node
/**
 * Pack src/App.tsx and src/App.css into binary gzip payloads.
 * Source of truth: binary .gz (+ sha256). Also writes single-file .gz.b64
 * for backwards compatibility. Deletes fragmented b64/txt shards.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const payloadDir = path.join(root, 'scripts', 'payload')
const bases = ['App.tsx', 'App.css']

function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function isFragment(name, base) {
  // Old fragmented gzip-b64 pieces: base.gz.b64.N or base.gz.b64.i.j
  if (name.startsWith(base + '.gz.b64.') && name !== base + '.gz.b64') return true
  // Old plaintext shards: base.N.txt
  if (name.startsWith(base + '.') && name.endsWith('.txt') && /^\d+(\.\d+)*$/.test(name.slice(base.length + 1, -4))) {
    return true
  }
  return false
}

function deleteFragments(base) {
  const deleted = []
  for (const f of fs.readdirSync(payloadDir)) {
    if (!isFragment(f, base)) continue
    fs.unlinkSync(path.join(payloadDir, f))
    deleted.push(f)
  }
  return deleted
}

fs.mkdirSync(payloadDir, { recursive: true })

const allDeleted = []

for (const base of bases) {
  const srcPath = path.join(root, 'src', base)
  const buf = fs.readFileSync(srcPath)
  const hash = sha256hex(buf)
  const gz = zlib.gzipSync(buf, { level: 9 })
  const b64 = gz.toString('base64')

  fs.writeFileSync(path.join(payloadDir, base + '.sha256'), hash + '\n')
  fs.writeFileSync(path.join(payloadDir, base + '.gz'), gz)
  fs.writeFileSync(path.join(payloadDir, base + '.gz.b64'), b64)

  const deleted = deleteFragments(base)
  allDeleted.push(...deleted)

  console.log(base)
  console.log('  src bytes:', buf.length)
  console.log('  gzip bytes:', gz.length)
  console.log('  b64 chars:', b64.length)
  console.log('  sha256:', hash)
  if (deleted.length) console.log('  deleted fragments:', deleted.join(', '))
}

if (allDeleted.length) {
  console.log('\ndeleted', allDeleted.length, 'fragment file(s)')
} else {
  console.log('\nno fragment files to delete')
}
