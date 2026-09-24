const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const root = path.join(__dirname, '..')
const partsDir = path.join(root, 'src', 'appwired-parts')
const out = path.join(root, 'src', 'AppWired.tsx')
// Prefer gzip-single if present
const gz = path.join(partsDir, 'App.tsx.gz.b64')
if (fs.existsSync(gz)) {
  const buf = Buffer.from(fs.readFileSync(gz, 'utf8'), 'base64')
  fs.writeFileSync(out, zlib.gunzipSync(buf))
  console.log('assembled AppWired.tsx from gzip', fs.statSync(out).size)
  process.exit(0)
}
const parts = [0,1,2,3].map((i) => {
  const p = path.join(partsDir, `p${i}.b64`)
  if (!fs.existsSync(p)) throw new Error('missing ' + p)
  return Buffer.from(fs.readFileSync(p, 'utf8'), 'base64').toString('utf8')
})
fs.writeFileSync(out, parts.join(''))
console.log('assembled AppWired.tsx', fs.statSync(out).size)
