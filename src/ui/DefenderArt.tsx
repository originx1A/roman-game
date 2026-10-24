import type { ReactNode } from 'react'

/**
 * Cartoon defenders from the live game's SVG art (the same drawings as
 * design/final-v3 sheets 03, 05 and 09). Clothing overlays are the sheet 09
 * pieces. No bitmap pet art.
 */
const INK = '#07122a'
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type DefenderId = 'lupa' | 'aquila' | 'leo' | 'invictus' | 'nox'
export type ClothPiece = 'top-hat' | 'sunglasses' | 'scarf' | 'badge' | 'laurel' | 'crown'

/** How each defender is drawn on the approved sheets. */
const ROW: Record<DefenderId, ClothPiece | null> = {
  lupa: 'top-hat',
  aquila: 'sunglasses',
  leo: 'laurel',
  invictus: 'badge',
  nox: null,
}

export function defenderIdFor(id: string | null | undefined): DefenderId | null {
  const key = (id ?? '').toLowerCase()
  if (key === 'lupa' || key === 'for-lupa') return 'lupa'
  if (key === 'aquila' || key === 'eagle' || key === 'for-aquila') return 'aquila'
  if (key === 'leo' || key === 'for-leo') return 'leo'
  if (key === 'invictus' || key === 'war-horse') return 'invictus'
  if (key === 'nox' || key === 'night-owl') return 'nox'
  return null
}

function Eye({ x, y, r = 6, iris }: { x: number; y: number; r?: number; iris?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" {...S} strokeWidth={2.5} />
      {iris ? <circle cx={x} cy={y + 0.5} r={r * 0.62} fill={iris} /> : null}
      <circle cx={x + 0.6} cy={y + 0.8} r={r * 0.45} fill={INK} />
      <circle cx={x + 2} cy={y - 1.6} r={r * 0.2} fill="#fff" />
    </g>
  )
}

function Wolf() {
  return (
    <>
      <path d="M22 44 L26 14 L44 32 Z" fill="#8391b3" {...S} />
      <path d="M78 44 L74 14 L56 32 Z" fill="#8391b3" {...S} />
      <path d="M28 36 L29 22 L38 31 Z" fill="#ffb3c1" />
      <path d="M72 36 L71 22 L62 31 Z" fill="#ffb3c1" />
      <ellipse cx="50" cy="52" rx="31" ry="27" fill="#9aa8c7" {...S} />
      <path d="M22 58 Q30 50 36 60 Q30 66 22 58 Z" fill="#b8c3dc" />
      <path d="M78 58 Q70 50 64 60 Q70 66 78 58 Z" fill="#b8c3dc" />
      <ellipse cx="50" cy="64" rx="16" ry="12" fill="#eef2fa" {...S} />
      <ellipse cx="50" cy="57.5" rx="5.5" ry="3.8" fill={INK} />
      <path d="M44 66 Q50 71 56 66" fill="none" {...S} strokeWidth={2.5} />
      <Eye x={38} y={47} />
      <Eye x={62} y={47} />
      <path d="M24 78 Q50 90 76 78 L74 86 Q50 97 26 86 Z" fill="#e63946" {...S} />
      <circle cx="50" cy="90" r="5" fill="#ffd166" {...S} strokeWidth={2.5} />
    </>
  )
}

function Eagle() {
  return (
    <>
      <path d="M26 50 Q6 56 10 80 Q22 70 32 72 Z" fill="#7a4a22" {...S} />
      <path d="M74 50 Q94 56 90 80 Q78 70 68 72 Z" fill="#7a4a22" {...S} />
      <ellipse cx="50" cy="62" rx="24" ry="26" fill="#8b5a2b" {...S} />
      <path d="M40 72 Q50 78 60 72" fill="none" stroke="#b07a45" strokeWidth={3} strokeLinecap="round" />
      <path d="M42 80 Q50 85 58 80" fill="none" stroke="#b07a45" strokeWidth={3} strokeLinecap="round" />
      <circle cx="50" cy="36" r="21" fill="#f4fbff" {...S} />
      <path d="M43 40 Q50 36 57 40 Q56 51 50 55 Q44 51 43 40 Z" fill="#ffc233" {...S} strokeWidth={2.5} />
      <path d="M36 26.5 L45 27.5" {...S} strokeWidth={2.5} />
      <path d="M64 26.5 L55 27.5" {...S} strokeWidth={2.5} />
      <Eye x={41} y={34} r={5} />
      <Eye x={59} y={34} r={5} />
      <rect x="28" y="84" width="44" height="12" rx="4" fill="#ffd166" {...S} strokeWidth={2.5} />
      <text x="50" y="93.5" textAnchor="middle" fontSize="9" fontWeight="900" fill={INK} fontFamily="Titan One, Nunito, system-ui, sans-serif">SPQR</text>
    </>
  )
}

function Lion() {
  const mane = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return <circle key={i} cx={50 + Math.cos(a) * 27} cy={55 + Math.sin(a) * 26} r={11} fill="#d9661f" {...S} />
  })
  const leaves = Array.from({ length: 5 }, (_, i) => {
    const t = (i - 2) / 2
    const lx = 50 + t * 20
    const ly = 22 + Math.abs(t) * 7
    return <ellipse key={i} cx={lx - 3} cy={ly} rx="5.5" ry="3" fill="#3fbf6f" stroke={INK} strokeWidth={1.8} transform={`rotate(${-30 + t * 25} ${lx - 3} ${ly})`} />
  })
  return (
    <>
      {mane}
      <circle cx="50" cy="55" r="25" fill="#e8812a" />
      <circle cx="32" cy="36" r="7" fill="#ffc15e" {...S} />
      <circle cx="68" cy="36" r="7" fill="#ffc15e" {...S} />
      <circle cx="50" cy="56" r="23" fill="#ffc15e" {...S} />
      <ellipse cx="50" cy="66" rx="13" ry="9.5" fill="#fff1d0" {...S} strokeWidth={2.5} />
      <path d="M45 60 L55 60 L50 65.5 Z" fill="#b5523b" {...S} strokeWidth={2} />
      <path d="M44 69 Q50 73 56 69" fill="none" {...S} strokeWidth={2.2} />
      <Eye x={41} y={51} r={5.5} />
      <Eye x={59} y={51} r={5.5} />
      <circle cx="35" cy="62" r="3.5" fill="#ff9b8a" opacity="0.7" />
      <circle cx="65" cy="62" r="3.5" fill="#ff9b8a" opacity="0.7" />
      {leaves}
      <circle cx="50" cy="22" r="3.2" fill="#ffd166" stroke={INK} strokeWidth={1.8} />
    </>
  )
}

function Horse() {
  return (
    <>
      <path d="M34 26 L30 6 L44 20 Z" fill="#6b4226" {...S} />
      <path d="M66 26 L70 6 L56 20 Z" fill="#6b4226" {...S} />
      <path d="M50 4 Q30 4 28 20 Q40 14 50 14 Q60 14 72 20 Q70 4 50 4 Z" fill="#e63946" {...S} />
      <path d="M24 34 Q18 50 22 70 L32 62 Z" fill="#2b1a10" {...S} />
      <path d="M76 34 Q82 50 78 70 L68 62 Z" fill="#2b1a10" {...S} />
      <path d="M30 34 Q30 18 50 18 Q70 18 70 34 L68 70 Q66 90 50 94 Q34 90 32 70 Z" fill="#7b4a2a" {...S} />
      <path d="M34 26 Q50 20 66 26 L64 34 Q50 29 36 34 Z" fill="#ffd166" {...S} strokeWidth={2.5} />
      <circle cx="50" cy="29" r="2.8" fill="#e63946" stroke={INK} strokeWidth={1.6} />
      <path d="M46 38 Q50 34 54 38 L52 58 L48 58 Z" fill="#f4fbff" />
      <ellipse cx="50" cy="78" rx="17" ry="13" fill="#d9b08c" {...S} />
      <ellipse cx="43" cy="78" rx="2.8" ry="3.8" fill={INK} />
      <ellipse cx="57" cy="78" rx="2.8" ry="3.8" fill={INK} />
      <path d="M44 86 Q50 89 56 86" fill="none" {...S} strokeWidth={2.2} />
      <Eye x={39} y={48} r={5.5} />
      <Eye x={61} y={48} r={5.5} />
    </>
  )
}

function Owl() {
  return (
    <>
      <path d="M26 46 Q12 62 22 84 Q28 70 34 66 Z" fill="#4b2fa3" {...S} />
      <path d="M74 46 Q88 62 78 84 Q72 70 66 66 Z" fill="#4b2fa3" {...S} />
      <ellipse cx="50" cy="60" rx="28" ry="32" fill="#6c4bd1" {...S} />
      <ellipse cx="50" cy="74" rx="15" ry="14" fill="#c9b8ff" />
      <path d="M43 70 l3 3 l3 -3 M51 70 l3 3 l3 -3 M47 78 l3 3 l3 -3" fill="none" stroke="#8e76e8" strokeWidth={2} strokeLinecap="round" />
      <circle cx="39" cy="50" r="12" fill="#e6ddff" {...S} strokeWidth={2.5} />
      <circle cx="61" cy="50" r="12" fill="#e6ddff" {...S} strokeWidth={2.5} />
      <Eye x={39} y={50} r={8} iris="#ff9f1c" />
      <Eye x={61} y={50} r={8} iris="#ff9f1c" />
      <path d="M46 58 L54 58 L50 65 Z" fill="#ffc233" {...S} strokeWidth={2} />
      <path d="M26 30 L50 2 L74 30 Z" fill="#1d1340" {...S} />
      <rect x="31" y="22" width="38" height="7" rx="2" fill="#ff8c1a" stroke={INK} strokeWidth={2} />
      <ellipse cx="50" cy="31" rx="32" ry="5.5" fill="#1d1340" {...S} />
      <path d="M40 92 l-3 5 M46 93 l0 5 M54 93 l0 5 M60 92 l3 5" stroke="#ffc233" strokeWidth={3} strokeLinecap="round" />
    </>
  )
}

const BODY: Record<DefenderId, () => ReactNode> = { lupa: Wolf, aquila: Eagle, leo: Lion, invictus: Horse, nox: Owl }

function Hat({ id }: { id: DefenderId }) {
  const place: Record<DefenderId, string> = {
    lupa: 'translate(50 27) scale(0.95)',
    aquila: 'translate(50 14) scale(0.78)',
    leo: 'translate(50 20) scale(0.95)',
    invictus: 'translate(50 8) scale(0.72)',
    nox: 'translate(50 6) scale(0.55)',
  }
  return (
    <g transform={place[id]}>
      <rect x={-11} y={-26} width={22} height={24} rx={2} fill="#1b1b2b" stroke={INK} strokeWidth={2.2} />
      <rect x={-11} y={-9} width={22} height={6} fill="#e63946" stroke={INK} strokeWidth={1.6} />
      <rect x={-1.8} y={-9} width={3.6} height={6} fill="#ffd166" />
      <ellipse cx={0} cy={-2} rx={19} ry={4.5} fill="#1b1b2b" stroke={INK} strokeWidth={2.2} />
    </g>
  )
}

function Sunglasses({ id }: { id: DefenderId }) {
  if (id === 'aquila') {
    return (
      <g>
        <path d="M33.5 33 L28.5 31 M66.5 33 L71.5 31" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M47.5 34 Q50 31 52.5 34" fill="none" stroke={INK} strokeWidth={2.6} />
        <rect x={33.5} y={28} width={15} height={12.75} rx={5.25} fill="#10131f" stroke={INK} strokeWidth={2} />
        <rect x={51.5} y={28} width={15} height={12.75} rx={5.25} fill="#10131f" stroke={INK} strokeWidth={2} />
        <path d="M37.25 31 l4.5 0 M55.25 31 l4.5 0" stroke="#7fd0ff" strokeWidth={1.8} strokeLinecap="round" />
      </g>
    )
  }
  if (id === 'invictus') {
    return (
      <g>
        <path d="M30.5 47 L25.5 45 M69.5 47 L74.5 45" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M46.5 48 Q50 45 53.5 48" fill="none" stroke={INK} strokeWidth={2.6} />
        <rect x={30.5} y={41.2} width={17} height={14.45} rx={5.95} fill="#10131f" stroke={INK} strokeWidth={2} />
        <rect x={52.5} y={41.2} width={17} height={14.45} rx={5.95} fill="#10131f" stroke={INK} strokeWidth={2} />
        <path d="M34.75 44.6 l5.1 0 M56.75 44.6 l5.1 0" stroke="#7fd0ff" strokeWidth={1.8} strokeLinecap="round" />
      </g>
    )
  }
  const shift = id === 'leo' ? 'translate(0 4)' : id === 'nox' ? 'translate(0 3) scale(1.05)' : undefined
  return (
    <g transform={shift}>
      <path d="M28.5 46 L23.5 44 M71.5 46 L76.5 44" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M46.5 47 Q50 44 53.5 47" fill="none" stroke={INK} strokeWidth={2.6} />
      <rect x={28.5} y={39.4} width={19} height={16.15} rx={6.65} fill="#10131f" stroke={INK} strokeWidth={2} />
      <rect x={52.5} y={39.4} width={19} height={16.15} rx={6.65} fill="#10131f" stroke={INK} strokeWidth={2} />
      <path d="M33.25 43.2 l5.7 0 M57.25 43.2 l5.7 0" stroke="#7fd0ff" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  )
}

function Scarf({ id }: { id: DefenderId }) {
  if (id === 'invictus') {
    return (
      <g>
        <path d="M33 64 Q50 77 67 64 L67 72 Q50 85 33 72 Z" fill="#e63946" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
        <path d="M37 68 Q50 80 63 68" fill="none" stroke="#ffd166" strokeWidth={2.2} />
        <path d="M57.65 77 l8 14 l-8 3 l-6 -12 Z" fill="#e63946" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M60.65 89 l-2 5" stroke="#ffd166" strokeWidth={2} />
      </g>
    )
  }
  const shift = id === 'aquila' ? 'translate(0 -6) scale(0.9)' : id === 'leo' ? 'translate(0 2)' : id === 'nox' ? 'translate(0 -2) scale(0.92)' : undefined
  return (
    <g transform={shift}>
      <path d="M22 76 Q50 89 78 76 L78 84 Q50 97 22 84 Z" fill="#e63946" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M26 80 Q50 92 74 80" fill="none" stroke="#ffd166" strokeWidth={2.2} />
      <path d="M62.6 89 l8 14 l-8 3 l-6 -12 Z" fill="#e63946" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M65.6 101 l-2 5" stroke="#ffd166" strokeWidth={2} />
    </g>
  )
}

function Badge({ id }: { id: DefenderId }) {
  const place: Record<DefenderId, string> = {
    lupa: 'translate(70 89) scale(0.75)',
    aquila: 'translate(72 68) scale(0.6)',
    leo: 'translate(68 72) scale(0.7)',
    invictus: 'translate(60 62) scale(0.65)',
    nox: 'translate(70 78) scale(0.7)',
  }
  return (
    <g transform={place[id]}>
      <circle r={8} fill="#ffd166" stroke={INK} strokeWidth={2.2} />
      <path d="M0 -5 L1.5 -1.5 L5 -1.2 L2.3 1.2 L3.1 4.8 L0 2.9 L-3.1 4.8 L-2.3 1.2 L-5 -1.2 L-1.5 -1.5 Z" fill="#e63946" stroke={INK} strokeWidth={1} />
    </g>
  )
}

function Laurel({ id }: { id: DefenderId }) {
  const place: Record<DefenderId, string> = {
    lupa: 'translate(50 29) scale(0.95)',
    aquila: 'translate(50 16) scale(0.78)',
    leo: 'translate(50 22) scale(0.95)',
    invictus: 'translate(50 10) scale(0.72)',
    nox: 'translate(50 8) scale(0.55)',
  }
  const leaves = [-24, -16, -8, 8, 16, 24].map((x) => (
    <ellipse key={x} cx={x} cy={Math.abs(x) * 0.18} rx={6} ry={3.2} fill="#3fbf6f" stroke={INK} strokeWidth={1.8} transform={`rotate(${x * 1.6} ${x} ${Math.abs(x) * 0.18})`} />
  ))
  return (
    <g transform={place[id]}>
      {leaves}
      <circle cx={0} cy={-1} r={3} fill="#e63946" stroke={INK} strokeWidth={1.6} />
    </g>
  )
}

function Crown({ id }: { id: DefenderId }) {
  const place: Record<DefenderId, string> = {
    lupa: 'translate(50 31) scale(0.9975)',
    aquila: 'translate(50 18) scale(0.82)',
    leo: 'translate(50 24) scale(0.95)',
    invictus: 'translate(50 12) scale(0.756)',
    nox: 'translate(50 10) scale(0.58)',
  }
  return (
    <g transform={place[id]}>
      <path d="M-14 0 L-16 -16 L-8 -9 L0 -22 L8 -9 L16 -16 L14 0 Z" fill="#ffd166" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={0} cy={-6} r={2.6} fill="#e63946" stroke={INK} strokeWidth={1.2} />
    </g>
  )
}

function Pieces({ id, pieces }: { id: DefenderId; pieces: ClothPiece[] }) {
  return (
    <>
      {pieces.includes('scarf') ? <Scarf id={id} /> : null}
      {pieces.includes('badge') ? <Badge id={id} /> : null}
      {pieces.includes('sunglasses') ? <Sunglasses id={id} /> : null}
      {pieces.includes('laurel') ? <Laurel id={id} /> : null}
      {pieces.includes('top-hat') ? <Hat id={id} /> : null}
      {pieces.includes('crown') ? <Crown id={id} /> : null}
    </>
  )
}

export function DefenderArt({
  id,
  size = 64,
  pieces = 'row',
  title,
}: {
  id: string | null | undefined
  size?: number
  /** 'row' uses the outfit drawn on that defender in the sheets. */
  pieces?: 'row' | ClothPiece[]
  title?: string
}) {
  const who = defenderIdFor(id)
  if (!who) return null
  const Draw = BODY[who]
  const worn = pieces === 'row' ? (ROW[who] ? [ROW[who]] : []) : pieces
  return (
    <svg className="defender-art" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? who}>
      <Draw />
      <Pieces id={who} pieces={worn} />
    </svg>
  )
}
