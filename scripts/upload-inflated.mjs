#!/usr/bin/env node
const fs = require('fs')
const https = require('https')

const token = process.env.GH_TOKEN
const branch = process.env.BRANCH
const repo = process.env.REPO
if (!token || !branch || !repo) {
  console.error('GH_TOKEN, BRANCH, REPO required')
  process.exit(1)
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const r = https.request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'inflate-win-payload',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null })
          } catch (e) {
            reject(new Error(`${res.statusCode} ${buf}`))
          }
        })
      },
    )
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

async function put(path, message) {
  const content = fs.readFileSync(path).toString('base64')
  const get = await req('GET', `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`)
  const sha = get.status === 200 ? get.body.sha : undefined
  const body = { message, content, branch }
  if (sha) body.sha = sha
  const putRes = await req('PUT', `/repos/${repo}/contents/${path}`, body)
  if (putRes.status >= 300) {
    console.error(path, putRes.status, putRes.body)
    process.exit(1)
  }
  console.log(path, '->', putRes.body.commit?.sha)
}

;(async () => {
  await put('src/App.tsx', 'Add App.tsx with WinScreen integration')
  await put('src/App.css', 'Add App.css with win celebration styles')
})()
