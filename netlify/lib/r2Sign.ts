import { createHash, createHmac } from 'node:crypto'

/** Presigned download links last 15 minutes. */
export const R2_PRESIGN_SECONDS = 900
export const DEFAULT_R2_BUCKET = 'romansgame-audiobooks'

type Env = Record<string, string | undefined>

export type R2Settings = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function encodeObjectKey(key: string): string {
  return key.split('/').filter((part) => part.length > 0).map(encodeRfc3986).join('/')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function amzDate(now: Date): string {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

export function r2Settings(env: Env = process.env): R2Settings | null {
  const accountId = env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket: env.R2_BUCKET?.trim() || DEFAULT_R2_BUCKET,
  }
}

/**
 * SigV4 query-string presign (S3 GET). Host and URI are passed in so the
 * AWS documentation example and the R2 path-style URL share one signer.
 */
export function presignGetUrl(opts: {
  host: string
  canonicalUri: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  now: Date
  expiresSeconds: number
  service?: string
}): string {
  const service = opts.service ?? 's3'
  const stamp = amzDate(opts.now)
  const dateStamp = stamp.slice(0, 8)
  const scope = `${dateStamp}/${opts.region}/${service}/aws4_request`
  const credential = `${opts.accessKeyId}/${scope}`
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', stamp],
    ['X-Amz-Expires', String(opts.expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ]
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .sort()
    .join('&')
  const canonicalHeaders = `host:${opts.host}\n`
  const canonicalRequest = ['GET', opts.canonicalUri, query, canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256Hex(canonicalRequest)].join('\n')
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${opts.secretAccessKey}`, dateStamp), opts.region), service), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex')
  return `https://${opts.host}${opts.canonicalUri}?${query}&X-Amz-Signature=${signature}`
}

/** Path-style Cloudflare R2 URL. The object key comes from the catalog map, never from the query string. */
export function presignR2Get(opts: R2Settings & { key: string; now?: Date; expiresSeconds?: number }): string {
  return presignGetUrl({
    host: `${opts.accountId}.r2.cloudflarestorage.com`,
    canonicalUri: `/${encodeObjectKey(opts.bucket)}/${encodeObjectKey(opts.key)}`,
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    region: 'auto',
    now: opts.now ?? new Date(),
    expiresSeconds: opts.expiresSeconds ?? R2_PRESIGN_SECONDS,
  })
}
