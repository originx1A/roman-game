/** Passkeys are registered for the parent domain so play. and any future *.romansgame.com share them. */
export const PASSKEY_RP_ID = 'romansgame.com'
export const PASSKEY_RP_NAME = "Roman's Game"

/**
 * The browser origin must be romansgame.com or a subdomain of it.
 * The relying party id stays the parent domain either way.
 * Returns null for any other host, including localhost.
 */
export function passkeyRequest(req: Request): { origin: string; rpID: string } | null {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim()
  const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim()
  const hostname = host.split(':')[0].toLowerCase()
  if (!hostname || (hostname !== PASSKEY_RP_ID && !hostname.endsWith(`.${PASSKEY_RP_ID}`))) return null
  if (proto !== 'https' && proto !== 'http') return null
  return { origin: `${proto}://${host}`, rpID: PASSKEY_RP_ID }
}
