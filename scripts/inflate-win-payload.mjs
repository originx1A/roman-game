#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
function assemble(prefix, outPath) {
  const dir = path.dirname(prefix)
  const base = path.basename(prefix)
  const parts = fs.readdirSync(dir)
    .filter((f) => f.startsWith(base + '.') && f.endsWith('.txt'))
    .sort((a, b) => Number(a.split('.').slice(-2, -1)[0]) - Number(b.split('.').slice(-2, -1)[0]))
  const text = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('')
  const shaFile = path.join(dir, base + '.sha256')
  if (fs.existsSync(shaFile)) {
    const expect = fs.readFileSync(shaFile, 'utf8').trim()
    const got = crypto.createHash('sha256').update(text).digest('hex')
    if (expect !== got) {
      console.error('sha256 mismatch', base, expect, got)
      process.exit(1)
    }
  }
  fs.writeFileSync(outPath, text)
  console.log('wrote', outPath, text.length, 'from', parts.length, 'parts')
}
assemble('scripts/payload/App.tsx', 'src/App.tsx')
assemble('scripts/payload/App.css', 'src/App.css')
