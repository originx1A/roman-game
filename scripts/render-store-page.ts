import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderStorePage } from '../src/store/renderStorePage.ts'

const out = join(dirname(fileURLToPath(import.meta.url)), '../public/store/index.html')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, renderStorePage())
console.log('wrote', out)
