#!/usr/bin/env node
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
function inflate(prefix, outPath) {
  const dir = path.dirname(prefix)
  const base = path.basename(prefix)
  const parts = fs.readdirSync(dir)
    .filter((f) => f.startsWith(base + '.'))
    .sort((a, b) => Number(a.split('.').pop()) - Number(b.split('.').pop()))
  const b64 = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim()).join('')
  const buf = zlib.gunzipSync(Buffer.from(b64, 'base64'))
  fs.writeFileSync(outPath, buf)
  console.log('wrote', outPath, buf.length)
}
inflate('scripts/payload/App.tsx.gz.b64', 'src/App.tsx')
inflate('scripts/payload/App.css.gz.b64', 'src/App.css')
