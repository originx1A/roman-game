import type { CSSProperties } from 'react'
import { PETS, hasPet, type PetId, type PetState } from '../game/pets'
import { callsFor, DEFENDER_THEME } from '../game/defenders'
import { PetArt } from './PetArt'

/**
 * 9.33-a: the Defender icon column on the play screen. One framed plate per Defender
 * with its calls-left badge; the branded Defender's plate is lit in its colour, and a
 * Defender with no calls (or not yet in the Stable) sleeps greyed. Tap a plate to open
 * The Stable (stock up / adopt).
 */
export function DefenderRail({
  pets,
  now,
  brand,
  leoShield,
  onOpenStable,
}: {
  pets: PetState
  now: number
  brand: PetId | null
  leoShield: boolean
  onOpenStable: () => void
}) {
  return (
    <div className="defender-rail" role="group" aria-label="Your Defenders">
      {PETS.map((p) => {
        const owned = hasPet(pets, p.id, now)
        const calls = callsFor(pets, p.id)
        const awake = owned && calls > 0
        const isBrand = brand === p.id
        return (
          <button
            key={p.id}
            type="button"
            className={`defender-plate ${isBrand ? 'is-brand' : ''} ${awake ? '' : 'is-asleep'}`}
            data-defender={p.id}
            style={isBrand ? ({ '--brand-accent': DEFENDER_THEME[p.id].accent } as CSSProperties) : undefined}
            onClick={onOpenStable}
            title={
              !owned
                ? `${p.name} is not in your Stable yet`
                : calls > 0
                  ? `${p.name}: ${calls} call${calls === 1 ? '' : 's'} left`
                  : `${p.name} has no calls left — stock up in The Stable`
            }
            aria-label={`${p.name}: ${owned ? `${calls} calls left` : 'not in your Stable'}`}
          >
            <PetArt id={p.id} size={40} locked={!owned} />
            <span className="defender-plate-name">{p.name}</span>
            <span className="defender-plate-count" aria-hidden>
              {owned ? calls : '—'}
            </span>
            {p.id === 'leo' && leoShield && <span className="defender-plate-shield" aria-hidden>🛡️</span>}
          </button>
        )
      })}
    </div>
  )
}
