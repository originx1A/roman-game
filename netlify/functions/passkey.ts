import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { json } from '../lib/http.ts'
import { bearer, supabaseAdmin, supabaseAsUser } from '../lib/supabaseAdmin.ts'

function ticketSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function signTicket(challenge: string, playerId: string): string {
  const exp = Date.now() + 5 * 60_000
  const body = Buffer.from(JSON.stringify({ challenge, playerId, exp })).toString('base64url')
  const mac = createHmac('sha256', ticketSecret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

function readTicket(ticket: string): { challenge: string; playerId: string } | null {
  const [body, mac] = ticket.split('.')
  if (!body || !mac || !ticketSecret()) return null
  const expected = createHmac('sha256', ticketSecret()).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as { challenge?: string; playerId?: string; exp?: number }
  if (!data.challenge || !data.playerId || !data.exp || data.exp < Date.now()) return null
  return { challenge: data.challenge, playerId: data.playerId }
}

function originOf(req: Request): { origin: string; rpID: string } {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || 'play.romansgame.com').split(',')[0].trim()
  const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim()
  const hostname = host.split(':')[0]
  return { origin: `${proto}://${host}`, rpID: hostname }
}

async function mint(admin: NonNullable<ReturnType<typeof supabaseAdmin>>, playerId: string) {
  const { data: userData } = await admin.auth.admin.getUserById(playerId)
  let email = userData.user?.email || ''
  if (!email || email.endsWith('@link.romansgame.invalid')) {
    email = `p${playerId.replace(/-/g, '')}@link.romansgame.invalid`
    await admin.auth.admin.updateUserById(playerId, { email, email_confirm: true })
  }
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !link?.properties?.hashed_token) return null
  return link.properties.hashed_token
}

/** Passkeys for the device owner. Hidden when the service role is unset. */
export default async function passkey(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = supabaseAdmin()
  if (!admin) return json({ ok: false, configured: false }, 503)
  const { origin, rpID } = originOf(req)

  let body: { action?: string; ticket?: string; response?: unknown; credentialId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ ok: false }, 400)
  }

  if (body.action === 'register-options') {
    const token = bearer(req)
    const uid = token ? (await supabaseAsUser(token).auth.getUser(token)).data.user?.id : ''
    if (!uid) return json({ ok: false }, 401)
    const options = await generateRegistrationOptions({
      rpName: "Roman's Game",
      rpID,
      userName: uid,
      userID: new TextEncoder().encode(uid),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred', authenticatorAttachment: 'platform' },
    })
    return json({ ok: true, options, ticket: signTicket(options.challenge, uid) })
  }

  if (body.action === 'register-verify') {
    const ticket = readTicket(body.ticket || '')
    const token = bearer(req)
    const uid = token ? (await supabaseAsUser(token).auth.getUser(token)).data.user?.id : ''
    if (!ticket || !uid || ticket.playerId !== uid) return json({ ok: false }, 401)
    const verified = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: ticket.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
    if (!verified.verified) return json({ ok: false }, 400)
    const cred = verified.registrationInfo.credential
    const { error } = await admin.from('passkeys').upsert({
      credential_id: cred.id,
      player_id: uid,
      public_key: Buffer.from(cred.publicKey).toString('base64url'),
      counter: cred.counter,
    })
    if (error) return json({ ok: false }, 502)
    return json({ ok: true })
  }

  if (body.action === 'login-options') {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' })
    return json({ ok: true, options, ticket: signTicket(options.challenge, 'login') })
  }

  if (body.action === 'login-verify') {
    const ticket = readTicket(body.ticket || '')
    const response = body.response as AuthenticationResponseJSON | undefined
    if (!ticket || ticket.playerId !== 'login' || !response?.id) return json({ ok: false }, 400)
    const { data: row } = await admin.from('passkeys').select('player_id, public_key, counter').eq('credential_id', response.id).maybeSingle()
    if (!row) return json({ ok: false }, 404)
    const verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: ticket.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: response.id,
        publicKey: Buffer.from(row.public_key, 'base64url'),
        counter: Number(row.counter) || 0,
      },
    })
    if (!verified.verified) return json({ ok: false }, 400)
    await admin.from('passkeys').update({ counter: verified.authenticationInfo.newCounter }).eq('credential_id', response.id)
    const tokenHash = await mint(admin, row.player_id)
    if (!tokenHash) return json({ ok: false }, 502)
    return json({ ok: true, token_hash: tokenHash })
  }

  return json({ ok: false }, 400)
}
