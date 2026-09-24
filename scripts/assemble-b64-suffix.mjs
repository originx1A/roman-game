#!/usr/bin/env node
/**
 * One-shot: append *.gz.b64.suffix onto *.gz.b64 (MCP size workaround),
 * verify gunzip+sha256, then delete the suffix files.
 * Does not join historical .gz.b64.N corruption shards.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'payload')
const bases = ['App.tsx', 'App.css']

for (const base of bases) {
  const main = path.join(dir, base + '.gz.b64')
  const suffix = path.join(dir, base + '.gz.b64.suffix')
  if (!fs.existsSync(suffix)) {
    console.log('no suffix for', base)
    continue
  }
  if (!fs.existsSync(main)) {
    console.error('missing main', main)
    process.exit(1)
  }
  const joined = fs.readFileSync(main, 'utf8').replace(/\s+/g, '') + fs.readFileSync(suffix, 'utf8').replace(/\s+/g, '')
  const buf = zlib.gunzipSync(Buffer.from(joined, 'base64'))
  const shaFile = path.join(dir, base + '.sha256')
  if (fs.existsSync(shaFile)) {
    const expect = fs.readFileSync(shaFile, 'utf8').trim()
    const got = crypto.createHash('sha256').update(buf).digest('hex')
    if (expect !== got) {
      console.error('sha256 mismatch after assemble', base, expect, got)
      process.exit(1)
    }
  }
  fs.writeFileSync(main, joined)
  fs.unlinkSync(suffix)
  console.log('assembled', base, 'b64', joined.length, 'plain', buf.length)
}
