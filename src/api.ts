export class ApiError extends Error {
  status: number
  code: string
  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new ApiError(data.error || 'error', res.status)
  return data
}

export interface Me {
  id: string
  playerName: string
  email: string | null
  emailVerified: boolean
  ageGate: 'over' | 'under' | null
  wins: number
  winsByBoard: Record<string, number>
  perfects: number
  coins: number
  starterOwned: boolean
  buyingStopped: boolean
  holder: boolean
  holderId: string | null
  pets: string[]
  clothes: string[]
  hostPet: string | null
  charges: Record<string, number>
  hearts: number
  bestRun: Record<string, number>
  streak: number
  weekWins?: number
  teamId: string | null
  language: 'en' | 'fr' | null
  throne: { id: number; name: string; nameFr: string } | null
  deleteAfter: string | null
  build: string
}
