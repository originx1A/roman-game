#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'

execSync('python3 scripts/apply-viewport-fix.py', { stdio: 'inherit' })
for (const f of ['src/App.tsx', 'src/App.css']) {
  if (!fs.existsSync(f)) {
    console.error('missing', f)
    process.exit(1)
  }
  console.log('ready', f, fs.statSync(f).size)
}
