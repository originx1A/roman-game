import { useEffect, useRef, useState } from 'react'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { CloudScoresButton } from '../cloud/CloudScores'
import { getSupabase, holdAnonymous, linkGoogle, resumePlayAccount, signOut } from '../cloud/cloud'
import { useTurnstile } from '../cloud/useTurnstile'
import { AUTH_LABEL, availableAuthMethods, deviceCodeDigits, deviceCodeReady, type AuthMethod } from '../game/authMethods'
import { publicPlayUrl } from '../game/publicUrl'
import { withInviteRef } from '../game/friendRef'
import { setQuietMuted } from '../game/quietQueue'
import { loadProfiles, PROFILE_CAP, removeProfile, setActiveProfileId, upsertProfile, type LocalProfile } from '../game/profiles'
import { onSocial, redeemDeviceLink, socialSnapshot, startDeviceLink } from '../social/hub'
import { enablePush, loadAuthConfig } from '../social/push'

const LAST = 'rg.auth.last'
const MUTE = 'rg.quiet.muted'
const PICTURES = ['🐶', '🐱', '🦁', '🐸', '🐙', '🦉']

function remember(method: AuthMethod) {
  try { localStorage.setItem(LAST, method) } catch { /* ignore */ }
}

async function cameraPresent(): Promise<boolean> {
  try {
    const list = await navigator.mediaDevices?.enumerateDevices?.()
    return !!list?.some((device) => device.kind === 'videoinput')
  } catch {
    return false
  }
}

export function PlayerChip({ onOpen }: { onOpen: () => void }) {
  const [count, setCount] = useState(() => loadProfiles().length)
  useEffect(() => onSocial(() => setCount(loadProfiles().length)), [])
  if (count < 2) return null
  return (
    <button type="button" className="btn ghost btn-sm" data-testid="switch-player-chip" onClick={onOpen}>
      Switch player
    </button>
  )
}

export function AccountSocial() {
  const [code, setCode] = useState(() => socialSnapshot().code)
  const [methods, setMethods] = useState<AuthMethod[]>(['code'])
  const [device, setDevice] = useState<{ code: string; token: string } | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [note, setNote] = useState('')
  const [profiles, setProfiles] = useState<LocalProfile[]>(() => loadProfiles())
  const [pinFor, setPinFor] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([])
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE) === '1' } catch { return false }
  })
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanStop = useRef<(() => void) | null>(null)
  const captcha = useTurnstile(true)

  async function takeCaptcha(): Promise<string | null> {
    const token = await captcha.takeToken()
    if (!token) setNote(captcha.reason() || "This page couldn't complete the check. Try again.")
    captcha.reset()
    return token
  }

  useEffect(() => onSocial(() => setCode(socialSnapshot().code)), [])

  useEffect(() => {
    let cancel = false
    void (async () => {
      const [cfg, camera, passkeyHere] = await Promise.all([
        loadAuthConfig(),
        cameraPresent(),
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false) ?? Promise.resolve(false),
      ])
      if (cancel) return
      let last: AuthMethod | null = null
      try {
        const saved = localStorage.getItem(LAST)
        if (saved === 'passkey' || saved === 'google' || saved === 'qr' || saved === 'scan' || saved === 'code' || saved === 'email') last = saved
      } catch { /* ignore */ }
      setMethods(availableAuthMethods({
        passkey: !!passkeyHere && cfg.passkey,
        google: cfg.google,
        camera,
        largeScreen: window.matchMedia('(min-width: 900px)').matches,
        last,
      }))
    })()
    return () => { cancel = true }
  }, [])

  useEffect(() => {
    void (async () => {
      const sb = await getSupabase()
      if (!sb) return
      const { data } = await sb.from('linked_devices').select('id, label').order('created_at', { ascending: false })
      if (Array.isArray(data)) setDevices(data as { id: string; label: string }[])
    })()
  }, [device])

  useEffect(() => () => scanStop.current?.(), [])

  async function showLink() {
    const started = await startDeviceLink()
    if (!started) {
      setNote('Connect when you are online. You can keep playing.')
      return
    }
    setDevice(started)
    setNote('This code works once, for about 5 minutes.')
  }

  async function useMethod(method: AuthMethod) {
    remember(method)
    if (method === 'code') return
    if (method === 'qr') {
      await showLink()
      return
    }
    if (method === 'scan') {
      await startScan()
      return
    }
    if (method === 'email') return
    if (method === 'google') {
      const captchaToken = await takeCaptcha()
      if (!captchaToken) return
      const redirect = `${window.location.origin}${window.location.pathname}`
      const linked = await linkGoogle(redirect, captchaToken)
      captcha.reset()
      if (!linked.ok) setNote(linked.error || "The captcha check didn't go through. Try again.")
      return
    }
    if (method === 'passkey') await registerPasskey()
  }

  async function registerPasskey() {
    const sb = await getSupabase()
    const token = (await sb?.auth.getSession())?.data.session?.access_token
    if (!token) return
    const opt = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'register-options' }),
    })
    const data = (await opt.json()) as { ok?: boolean; options?: Parameters<typeof startRegistration>[0]['optionsJSON']; ticket?: string }
    if (!data.ok || !data.options || !data.ticket) {
      setNote('Passkey is not available on this device.')
      return
    }
    const response = await startRegistration({ optionsJSON: data.options })
    const verified = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'register-verify', ticket: data.ticket, response }),
    })
    const done = (await verified.json()) as { ok?: boolean }
    if (!done.ok) {
      setNote('Passkey was not saved.')
      return
    }
    const uid = (await sb?.auth.getSession())?.data.session?.user.id
    if (uid) {
      const current = loadProfiles().find((row) => row.userId === uid)
      if (current) upsertProfile({ ...current, passkey: true })
    }
    setProfiles(loadProfiles())
    setNote('Passkey saved on this device.')
  }

  async function loginPasskey() {
    const opt = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login-options' }),
    })
    const data = (await opt.json()) as { ok?: boolean; options?: Parameters<typeof startAuthentication>[0]['optionsJSON']; ticket?: string }
    if (!data.ok || !data.options || !data.ticket) return
    const response = await startAuthentication({ optionsJSON: data.options })
    const verified = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login-verify', ticket: data.ticket, response }),
    })
    const done = (await verified.json()) as { ok?: boolean; token_hash?: string }
    if (!done.token_hash) {
      setNote('That passkey did not match.')
      return
    }
    const sb = await getSupabase()
    const captchaToken = await takeCaptcha()
    if (!sb || !captchaToken) return
    const { error } = await sb.auth.verifyOtp({
      token_hash: done.token_hash,
      type: 'email',
      options: { captchaToken },
    } as Parameters<typeof sb.auth.verifyOtp>[0])
    captcha.reset()
    setNote(error ? (/captcha/i.test(error.message ?? '') ? "The captcha check didn't go through. Try again." : 'Could not switch devices.') : 'You are on your player.')
  }

  async function submitDeviceCode() {
    if (!deviceCodeReady(joinCode)) return
    const captchaToken = await takeCaptcha()
    if (!captchaToken) return
    const result = await redeemDeviceLink(deviceCodeDigits(joinCode), captchaToken)
    captcha.reset()
    setNote(result.ok ? 'You are on that player.' : result.error || 'That code did not work.')
    if (result.ok) setProfiles(loadProfiles())
  }

  async function startScan() {
    scanStop.current?.()
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch {
      setNote('Camera stayed off. Enter the device code instead.')
      return
    }
    const video = videoRef.current
    if (!video) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    video.srcObject = stream
    await video.play()
    let stop = false
    scanStop.current = () => {
      stop = true
      stream.getTracks().forEach((track) => track.stop())
    }
    const detector = 'BarcodeDetector' in window ? new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] }) : null
    const canvas = document.createElement('canvas')
    const tick = async () => {
      if (stop || !video.videoWidth) {
        if (!stop) requestAnimationFrame(() => void tick())
        return
      }
      let raw = ''
      if (detector) {
        const codes = await detector.detect(video).catch(() => [])
        raw = codes[0]?.rawValue || ''
      } else {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const jsQR = (await import('jsqr')).default
          const hit = jsQR(image.data, image.width, image.height)
          raw = hit?.data || ''
        }
      }
      const token = raw.match(/[?&]link=([a-f0-9]{32})/i)?.[1]
      if (token) {
        scanStop.current?.()
        const captchaToken = await takeCaptcha()
        const result = captchaToken
          ? await redeemDeviceLink(token, captchaToken)
          : { ok: false, error: "This page couldn't complete the check. Try again." }
        captcha.reset()
        setNote(result.ok ? 'You are on that player.' : result.error || 'That code did not work.')
        return
      }
      requestAnimationFrame(() => void tick())
    }
    void tick()
  }

  async function addPlayer() {
    if (profiles.length >= PROFILE_CAP) {
      setNote('This device already has 6 players.')
      return
    }
    const sb = await getSupabase()
    const captchaToken = await takeCaptcha()
    if (!sb || !captchaToken) return
    holdAnonymous(true)
    await signOut()
    const { error } = await sb.auth.signInAnonymously({ options: { captchaToken } })
    captcha.reset()
    holdAnonymous(false)
    if (error) {
      resumePlayAccount()
      setNote('Could not add a player. You are still in the game.')
      return
    }
    setProfiles(loadProfiles())
    setNote('New player added. No email needed.')
  }

  async function switchTo(profile: LocalProfile, secret?: string) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false && (profile.hasPin || profile.hasPicture)) {
      setNote('Connect to open a locked player. You can keep playing.')
      return
    }
    if ((profile.hasPin || profile.hasPicture) && !secret) {
      setPinFor(profile.userId)
      setPin('')
      return
    }
    if (secret) {
      const sb = await getSupabase()
      const kind = profile.hasPin ? 'pin' : 'picture'
      const { data } = await sb!.rpc('check_profile_secret', { target: profile.userId, kind, secret })
      const result = (data ?? {}) as { ok?: boolean }
      if (!result.ok) {
        setNote('That did not match. You are still on this player.')
        return
      }
    }
    holdAnonymous(true)
    const sb = await getSupabase()
    const { error } = await sb!.auth.setSession({ access_token: profile.accessToken, refresh_token: profile.refreshToken })
    holdAnonymous(false)
    if (error) {
      resumePlayAccount()
      setNote('Could not switch. You are still in the game.')
      return
    }
    setActiveProfileId(profile.userId)
    setPinFor(null)
    setProfiles(loadProfiles())
    setNote(`Playing as ${profile.name}`)
  }

  async function savePin(kind: 'pin' | 'picture', secret: string) {
    const sb = await getSupabase()
    const uid = (await sb?.auth.getSession())?.data.session?.user.id
    if (!sb || !uid) return
    const { data } = await sb.rpc('set_profile_secret', { kind, secret })
    const result = (data ?? {}) as { ok?: boolean }
    if (!result.ok) {
      setNote(kind === 'pin' ? 'Use 4 digits.' : 'Pick a picture password.')
      return
    }
    const current = loadProfiles().find((row) => row.userId === uid)
    if (current) upsertProfile({ ...current, hasPin: kind === 'pin' || current.hasPin, hasPicture: kind === 'picture' || current.hasPicture })
    setProfiles(loadProfiles())
    setNote(kind === 'pin' ? 'PIN saved for this player.' : 'Picture password saved.')
  }

  const friendUrl = code ? withInviteRef(publicPlayUrl(), code) : ''
  const linkUrl = device ? `https://play.romansgame.com/?link=${device.token}` : ''

  return (
    <section className="account-social" data-testid="account-social">
      <div className="cloud-turnstile" ref={captcha.box} />
      <h3>Friends</h3>
      {code ? (
        <p className="friend-code" data-testid="friend-code">
          Your code <strong>{code}</strong>
          <button type="button" className="btn ghost btn-sm" onClick={() => void navigator.clipboard?.writeText(code)}>
            Copy
          </button>
        </p>
      ) : (
        <p className="sub">Your friend code shows when you are online.</p>
      )}
      {friendUrl ? <Qr text={friendUrl} label="Friend code QR" /> : null}

      <h3>Keep my account</h3>
      <p className="sub">Optional. Play does not wait on this.</p>
      <MethodList methods={methods} onPick={(method) => void useMethod(method)} />

      <h3>Connect another device</h3>
      <button type="button" className="btn primary" data-testid="connect-device" onClick={() => void showLink()}>
        Show QR and device code
      </button>
      {device ? (
        <div className="device-link" data-testid="device-link">
          <p>Device code <strong>{device.code}</strong></p>
          <p className="sub">This is the device code, not the code from your email. It works once.</p>
          <Qr text={linkUrl} label="Device link QR" />
        </div>
      ) : null}
      <label className="name-setting">
        Enter device code
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          aria-label="device code"
          value={joinCode}
          onChange={(e) => setJoinCode(deviceCodeDigits(e.target.value))}
        />
      </label>
      <button type="button" className="btn ghost btn-sm" disabled={!deviceCodeReady(joinCode)} onClick={() => void submitDeviceCode()}>
        Connect with device code
      </button>
      <video ref={videoRef} className="scan-video" muted playsInline />

      <h3>Who's playing</h3>
      <ul className="profile-list">
        {profiles.map((profile) => (
          <li key={profile.userId}>
            <button type="button" className="btn ghost btn-sm" onClick={() => void switchTo(profile)}>
              {profile.name}
            </button>
            <button
              type="button"
              className="btn ghost btn-sm"
              onClick={() => {
                setProfiles(removeProfile(profile.userId))
              }}
            >
              Remove from this device
            </button>
          </li>
        ))}
      </ul>
      {pinFor ? (
        <label className="name-setting">
          PIN or pictures
          <input inputMode="numeric" maxLength={4} aria-label="profile pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <button
            type="button"
            className="btn primary btn-sm"
            onClick={() => {
              const profile = profiles.find((row) => row.userId === pinFor)
              if (profile) void switchTo(profile, pin)
            }}
          >
            Open
          </button>
        </label>
      ) : null}
      <button type="button" className="btn ghost btn-sm" data-testid="add-player" onClick={() => void addPlayer()}>
        Add player
      </button>
      <div className="picture-row" aria-label="Picture password">
        {PICTURES.map((pic) => (
          <button key={pic} type="button" className="btn ghost btn-sm" onClick={() => void savePin('picture', pic + pic + pic)}>
            {pic}
          </button>
        ))}
      </div>
      <button type="button" className="btn ghost btn-sm" disabled={pin.length !== 4} onClick={() => void savePin('pin', pin)}>
        Save 4-digit PIN
      </button>

      <h3>This device</h3>
      <ul>
        {devices.map((row) => (
          <li key={row.id}>
            {row.label}
            <button
              type="button"
              className="btn ghost btn-sm"
              onClick={() => {
                void getSupabase().then((sb) => sb?.from('linked_devices').delete().eq('id', row.id))
                setDevices((cur) => cur.filter((item) => item.id !== row.id))
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn ghost btn-sm" onClick={() => void enablePush().then((ok) => setNote(ok ? 'Pings are on.' : 'Pings stay off until they are set up.'))}>
        Pings
      </button>
      <button
        type="button"
        className="btn ghost btn-sm"
        onClick={() => {
          const next = !muted
          setMuted(next)
          setQuietMuted(next)
          try { localStorage.setItem(MUTE, next ? '1' : '0') } catch { /* ignore */ }
        }}
      >
        {muted ? 'Unmute notices' : 'Mute notices'}
      </button>
      {methods.includes('passkey') ? (
        <button type="button" className="btn ghost btn-sm" onClick={() => void loginPasskey()}>
          Use passkey
        </button>
      ) : null}
      {note ? <p className="sub" role="status">{note}</p> : null}
    </section>
  )
}

function MethodList({ methods, onPick }: { methods: AuthMethod[]; onPick: (method: AuthMethod) => void }) {
  if (!methods.length) return null
  const [first, ...rest] = methods
  return (
    <div className="auth-methods" data-testid="auth-methods">
      {first === 'email' ? (
        <CloudScoresButton buttonLabel="Email code" />
      ) : (
        <button type="button" className="btn primary" data-testid={`auth-${first}`} onClick={() => onPick(first)}>
          {first === 'code' ? 'Enter device code' : AUTH_LABEL[first]}
        </button>
      )}
      {rest.length ? (
        <details>
          <summary>Other ways</summary>
          {rest.map((method) =>
            method === 'email' ? (
              <CloudScoresButton key={method} buttonLabel="Email code" />
            ) : (
              <button key={method} type="button" className="btn ghost btn-sm" data-testid={`auth-${method}`} onClick={() => onPick(method)}>
                {method === 'code' ? 'Enter device code' : AUTH_LABEL[method]}
              </button>
            ),
          )}
        </details>
      ) : null}
    </div>
  )
}

function Qr({ text, label }: { text: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    void import('qrcode').then((mod) => mod.toCanvas(canvas, text, { width: 180, margin: 1 })).catch(() => undefined)
  }, [text])
  return <canvas ref={ref} className="friend-qr" role="img" aria-label={label} />
}
