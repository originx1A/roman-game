#!/usr/bin/env node
/**
 * Inflate App.tsx / App.css from scripts/payload.
 *
 * Resolution order per base:
 *  1. binary `base.gz` if present
 *  2. single `base.gz.b64` if present AND gunzip succeeds
 *  3. join ONLY `base.gz.b64.pNN` parts (MCP-safe chunks), sorted by NN
 *  4. fail clearly
 *
 * Never joins legacy `.gz.b64.0` / `.1` / nested / `.suffix` / `.txt` shards.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import zlib from 'zlib'

function checkSha(buf, base, dir) {
  const shaFile = path.join(dir, base + '.sha256')
  if (!fs.existsSync(shaFile)) {
    console.error('missing sha256 file for', base)
    process.exit(1)
  }
  const expect = fs.readFileSync(shaFile, 'utf8').trim()
  const got = crypto.createHash('sha256').update(buf).digest('hex')
  if (expect !== got) {
    console.error('sha256 mismatch', base)
    console.error('  expected:', expect)
    console.error('  got:     ', got)
    process.exit(1)
  }
}

function tryGunzipB64(b64, label) {
  try {
    return zlib.gunzipSync(Buffer.from(b64, 'base64'))
  } catch (err) {
    console.error('gunzip failed for', label + ':', err.message)
    process.exit(1)
  }
}

function readPChunks(dir, base) {
  // Exactly: base.gz.b64.p00, .p01, ... — nothing else
  const re = new RegExp('^' + base.replace(/\./g, '\\.') + '\\.gz\\.b64\\.p(\\d+)$')
  const parts = fs
    .readdirSync(dir)
    .map((f) => {
      const m = f.match(re)
      return m ? { f, n: Number(m[1]) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n)

  if (parts.length === 0) return null

  // Require contiguous numbering from 0
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].n !== i) {
      console.error(
        'non-contiguous p-chunks for',
        base + ':',
        'expected p' + String(i).padStart(2, '0') + ', got',
        parts[i].f,
      )
      process.exit(1)
    }
  }

  return parts.map(({ f }) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\s+/g, '')).join('')
}

function assemble(prefix, outPath) {
  const dir = path.dirname(prefix)
  const base = path.basename(prefix)

  // 1. Prefer binary gzip
  const gzPath = path.join(dir, base + '.gz')
  if (fs.existsSync(gzPath)) {
    let buf
    try {
      buf = zlib.gunzipSync(fs.readFileSync(gzPath))
    } catch (err) {
      console.error('gunzip failed for', gzPath + ':', err.message)
      process.exit(1)
    }
    checkSha(buf, base, dir)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)
    console.log('wrote', outPath, buf.length, 'from binary gzip')
    return
  }

  // 2. Single-file base64 gzip — only if length is plausible AND gunzip works
  const single = path.join(dir, base + '.gz.b64')
  if (fs.existsSync(single)) {
    const b64 = fs.readFileSync(single, 'utf8').replace(/\s+/g, '')
    if (b64.length >= 16) {
      try {
        const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
        checkSha(buf, base, dir)
        fs.mkdirSync(path.dirname(outPath), { recursive: true })
        fs.writeFileSync(outPath, buf)
        console.log('wrote', outPath, buf.length, 'from single gzip b64 (' + b64.length + ' chars)')
        return
      } catch (err) {
        console.error(
          'single',
          single,
          'present but gunzip failed (' + err.message + '); falling through to p-chunks',
        )
      }
    } else {
      console.error('single', single, 'too short (' + b64.length + ' chars); falling through to p-chunks')
    }
  }

  // 3. Join ONLY .gz.b64.pNN chunks
  const joined = readPChunks(dir, base)
  if (joined != null) {
    const buf = tryGunzipB64(joined, base + '.gz.b64.pNN')
    checkSha(buf, base, dir)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, buf)
    console.log('wrote', outPath, buf.length, 'from p-chunks (' + joined.length + ' chars)')
    return
  }

  console.error(
    'no usable payload for',
    base + ':',
    'need ' + base + '.gz, or ' + base + '.gz.b64, or ' + base + '.gz.b64.pNN chunks',
  )
  process.exit(1)
}

assemble('scripts/payload/App.tsx', 'src/App.tsx')
assemble('scripts/payload/App.css', 'src/App.css')
