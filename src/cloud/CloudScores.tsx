import { useEffect, useState } from 'react'
import { onCloud, type CloudState } from './cloud'

/**
 * "Save my scores" link — NOT a sign-in sheet (Tony Nov 12, 2026, ~10:46, his
 * direct word, overriding the earlier sheet work): sign-in lives on the hub
 * and the main website ONLY, NEVER in the game. The game just reads the hub
 * session (same origin, shared localStorage): signed in, scores save to the
 * cloud account; signed out, progress saves on this device (the local cache).
 *
 * So this component is a status line + a link, nothing more:
 * - Signed out: "Save my scores" takes the player to the hub root, which
 *   auto-opens its sign-in sheet on ?signin=1. No code is needed — the hub
 *   and the game share one origin and one session, so the moment the player
 *   signs in on the hub they are signed in here too.
 * - Signed in: "Scores saving as <name>" links to the hub, where the account
 *   lives (name, sign out, manage). The game never signs anyone out either.
 *
 * The local save is never wiped by signing in: when a player signs in on the
 * hub, loadPlayer (cloud.ts) merges this device's queued scores into the
 * account, and the game's own progress (clears, total score) lives in its own
 * localStorage keys, untouched by auth. Signing in carries the local save
 * over; it never replaces it.
 *
 * The cross-origin handoff (website <-> hub/game) still lives in cloud.ts —
 * mintHandoffCode / redeemHandoffCode / openWebsite — and initCloud redeems a
 * ?sso= code on boot, so a player arriving from romansgame.com is signed in
 * here without ever seeing a sheet. That is the handoff, not a sign-in.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

/** Hub sign-in entry: the hub auto-opens its sheet when it sees ?signin=1. */
const HUB_SIGNIN = '/?signin=1'

export function CloudScoresButton({ compact }: { compact?: boolean }) {
  const cloud = useCloud()
  const cls = `btn ghost cloud-btn${compact ? ' is-compact' : ''}`
  if (cloud.status === 'signed-in' && cloud.name) {
    return (
      <a href="/" className={cls}>
        {`☁ Scores saving as ${cloud.publicName ?? cloud.name}${cloud.pending ? ` (${cloud.pending} waiting)` : ''}`}
      </a>
    )
  }
  return (
    <a href={HUB_SIGNIN} className={cls}>
      {cloud.pending ? `☁ Save my scores (${cloud.pending} waiting)` : '☁ Save my scores'}
    </a>
  )
}
