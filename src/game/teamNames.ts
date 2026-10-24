/** Team names are adjective + noun + #number. No free text. Enforced on the server. */

export const ADJECTIVES = [
  'Golden', 'Swift', 'Bright', 'Quiet', 'Brave', 'Calm', 'Lucky', 'Amber', 'Silver', 'Merry',
  'Noble', 'Rapid', 'Sunny', 'Gentle', 'Bold', 'Clear', 'Happy', 'Kind', 'Steady', 'Cosy',
] as const

export const NOUNS = [
  'Owls', 'Foxes', 'Otters', 'Herons', 'Pines', 'Rivers', 'Lanterns', 'Comets', 'Maples', 'Sparrows',
  'Badgers', 'Finches', 'Clovers', 'Beacons', 'Cedars', 'Quills', 'Trails', 'Embers', 'Robins', 'Fawns',
] as const

export interface TeamNamePick {
  adjective: string
  noun: string
  number: number
}

export function formatTeamName(pick: TeamNamePick): string {
  return `${pick.adjective} ${pick.noun} #${pick.number}`
}

export function parseTeamName(name: string): TeamNamePick | null {
  const match = /^([A-Za-z]+) ([A-Za-z]+) #(\d{1,3})$/.exec(name.trim())
  if (!match) return null
  const adjective = ADJECTIVES.find((word) => word.toLowerCase() === match[1].toLowerCase())
  const noun = NOUNS.find((word) => word.toLowerCase() === match[2].toLowerCase())
  const number = Number(match[3])
  if (!adjective || !noun || number < 1 || number > 999) return null
  return { adjective, noun, number }
}
