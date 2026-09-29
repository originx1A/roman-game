/**
 * 9.30-r: tiny anonymous analytics (client side). One random anonymous id is made once and kept on the device.
 * Pings go to /api/ping and FAIL SILENTLY (offline, blocked, no server). No names, no emails, no browser location:
 * the place comes from the server (Netlify request geo). Players can switch it off in Save & settings.
 */
export const ANON_KEY = 'roman.anon.v1'

export interface AnonState {
  id: string
  /** Toronto day of the last app open, so a later day counts as a return visit */
  lastDay: string | null
}

export function makeAnonId(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...rand(16)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function loadAnon(store: Pick<Storage, 'getItem' | 'setItem'> | null, rand?: (n: number) => Uint8Array): AnonState {
  try {
    const raw = store?.getItem(ANON_KEY)
    const j = raw ? (JSON.parse(raw) as Partial<AnonState>) : null
    if (j && typeof j.id === 'string' && /^[a-f0-9]{32}$/.test(j.id)) return { id: j.id, lastDay: typeof j.lastDay === 'string' ? j.lastDay : null }
  } catch {
    /* fall through: make a fresh id */
  }
  const fresh: AnonState = { id: makeAnonId(rand), lastDay: null }
  try {
    store?.setItem(ANON_KEY, JSON.stringify(fresh))
  } catch {
    /* blocked storage: the id lasts for this visit only */
  }
  return fresh
}

/** Which events an app open sends: always app_open, plus return_visit when an earlier day was seen */
export function openEvents(state: AnonState, today: string): { events: ('app_open' | 'return_visit')[]; next: AnonState } {
  const events: ('app_open' | 'return_visit')[] = ['app_open']
  if (state.lastDay && state.lastDay !== today) events.push('return_visit')
  return { events, next: { ...state, lastDay: today } }
}

export interface PingBody {
  id: string
  ev: 'app_open' | 'level_clear' | 'return_visit' | 'feedback'
  size?: number
  ms?: number
  vote?: 'up' | 'down'
  note?: string
}

/** Fire and forget. Never throws, never waits on the game. */
export function sendPing(body: PingBody, enabled = true): void {
  if (!enabled || typeof fetch !== 'function') return
  try {
    void fetch('/api/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {})
  } catch {
    /* offline or blocked: ignore */
  }
}

export const PRIVACY_NOTE =
  'We count how the game is used, without knowing who you are. Each time the game opens, a level is cleared (with its board size and time), someone comes back another day, or you tap 👍/👎 (with a note if you write one), it sends that with a random number made on this device and a rough place (city/region/country) worked out by the server. We do not collect your name, email or exact location, and we do not keep your IP address. You can switch this off below.'
