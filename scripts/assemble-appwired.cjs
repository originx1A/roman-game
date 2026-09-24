const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const root = path.join(__dirname, '..')
const partsDir = path.join(root, 'src', 'appwired-parts')
const out = path.join(root, 'src', 'AppWired.tsx')
const half0 = path.join(partsDir, 'App.tsx.gz.b64.0')
const half1 = path.join(partsDir, 'App.tsx.gz.b64.1')
const gz = path.join(partsDir, 'App.tsx.gz.b64')
function writeFromB64(b64) {
  const buf = Buffer.from(b64, 'base64')
  fs.writeFileSync(out, zlib.gunzipSync(buf))
  console.log('assembled AppWired.tsx', fs.statSync(out).size)
}
if (fs.existsSync(half0) && fs.existsSync(half1)) {
  writeFromB64(fs.readFileSync(half0, 'utf8').trim() + fs.readFileSync(half1, 'utf8').trim())
  process.exit(0)
}
if (fs.existsSync(gz)) {
  writeFromB64(fs.readFileSync(gz, 'utf8').trim())
  process.exit(0)
}
const parts = [0,1,2,3].map((i) => {
  const p = path.join(partsDir, `p${i}.b64`)
  if (!fs.existsSync(p)) throw new Error('missing ' + p)
  return Buffer.from(fs.readFileSync(p, 'utf8'), 'base64').toString('utf8')
})
fs.writeFileSync(out, parts.join(''))
console.log('assembled AppWired.tsx', fs.statSync(out).size)
