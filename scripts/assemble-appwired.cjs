#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')
const partsDir = path.join(root, 'src', 'appwired-parts')
const out = path.join(root, 'src', 'AppWired.tsx')
const parts = [0, 1, 2, 3].map((i) => {
  const b64 = fs.readFileSync(path.join(partsDir, `p${i}.b64`), 'utf8').trim()
  return Buffer.from(b64, 'base64')
})
const body = Buffer.concat(parts).toString('utf8')
fs.writeFileSync(out, body)
console.log('assembled AppWired.tsx', body.length, 'chars')
