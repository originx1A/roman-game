/**
 * Build check: every VOICE_LINES id has a real mp3, Roman pools have several,
 * and the shuffle bag does not repeat one of the last 3 picks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createShuffleBag } from '../src/game/lineBag.ts'

const root = path.resolve(import.meta.dirname, '..')
const voiceSrc = fs.readFileSync(path.join(root, 'src/game/voiceLines.ts'), 'utf8')
const commentSrc = fs.readFileSync(path.join(root, 'src/game/comments.ts'), 'utf8')
const soundSrc = fs.readFileSync(path.join(root, 'src/game/sound.ts'), 'utf8')

function block(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`missing ${start}`)
  const to = source.indexOf(end, from + start.length)
  if (to < 0) throw new Error(`missing end after ${start}`)
  return source.slice(from, to)
}

function keys(source: string): string[] {
  return [...source.matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)].map((match) => match[1])
}

function quoted(source: string): string[] {
  return [...source.matchAll(/'([A-Za-z0-9_]+)'/g)].map((match) => match[1])
}

function isMp3(file: string): boolean {
  const bytes = fs.readFileSync(file)
  if (bytes.length < 64) return false
  const head = bytes.subarray(0, 48).toString('latin1').trimStart().toLowerCase()
  if (head.startsWith('<') || head.includes('<!doctype') || head.includes('<html')) return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
}

const voiceIds = keys(block(voiceSrc, 'export const VOICE_LINES = {', '} as const'))
const fallbackIds = new Set(keys(block(soundSrc, 'const FALLBACK_TEXT', '\n}')))
const pools: Record<string, string[]> = {
  cheers: quoted(block(commentSrc, 'export const ROMAN_CHEER_CLIPS = [', '] as const')),
  wrong: quoted(block(commentSrc, 'export const ROMAN_WRONG_CLIPS = [', '] as const')),
  idle: quoted(block(commentSrc, 'export const ROMAN_IDLE_CLIPS = [', '] as const')),
  lose: quoted(block(commentSrc, 'export const ROMAN_LOSE_CLIPS = [', '] as const')),
  hint: quoted(block(commentSrc, 'export const ROMAN_HINT_CLIPS = [', '] as const')),
  badge: quoted(block(commentSrc, 'export const ROMAN_BADGE_CLIPS = [', '] as const')),
  prize: quoted(block(commentSrc, 'export const ROMAN_PRIZE_CLIPS = [', '] as const')),
  stash: quoted(block(commentSrc, 'export const ROMAN_STASH_CLIPS = [', '] as const')),
}
const oldPools: Record<string, string[]> = {
  oldWrong: quoted(block(commentSrc, 'export const OLDTIMER_WRONG_CLIPS = [', '] as const')),
  oldIdle: quoted(block(commentSrc, 'export const OLDTIMER_IDLE_CLIPS = [', '] as const')),
  oldHint: quoted(block(commentSrc, 'export const OLDTIMER_HINT_CLIPS = [', '] as const')),
  oldUndo: quoted(block(commentSrc, 'export const OLDTIMER_UNDO_CLIPS = [', '] as const')),
  oldLose: quoted(block(commentSrc, 'export const OLDTIMER_LOSE_CLIPS = [', '] as const')),
  oldWin: quoted(block(commentSrc, 'export const OLDTIMER_WIN_CLIPS = [', '] as const')),
  oldRescue: quoted(block(commentSrc, 'export const OLDTIMER_RESCUE_CLIPS = [', '] as const')),
}

if (voiceIds.length < 100) throw new Error(`expected the voice catalog, found ${voiceIds.length}`)

const missing: string[] = []
for (const id of voiceIds) {
  const file = path.join(root, 'public/voices', `${id}.mp3`)
  if (!fs.existsSync(file) || !isMp3(file)) missing.push(id)
}
if (missing.length) {
  throw new Error(`voice clips missing or not mp3: ${missing.join(' ')}`)
}

const known = new Set(voiceIds)
for (const [name, ids] of Object.entries({ ...pools, ...oldPools })) {
  if (ids.length < 3) throw new Error(`${name} pool has only ${ids.length} clips`)
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`${name} pool uses unknown clip ${id}`)
    if (!fallbackIds.has(id)) throw new Error(`${name} pool clip ${id} has no fallback text`)
  }
}

// Roman must only ever be the deeper Brian voice: every roman_* clip is recorded in the manifest
// (written by scripts/generate-voices.py) as en-US-BrianNeural with the Roman settings.
const manifest: Record<string, { voice: string; rate: string; pitch: string; post?: string }> = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/voice-manifest.json'), 'utf8'),
)
const notBrian: string[] = []
const notOld: string[] = []
for (const id of voiceIds) {
  const entry = manifest[id]
  if (!entry) throw new Error(`voice clip ${id} is missing from scripts/voice-manifest.json`)
  if (id.startsWith('roman_') && (entry.voice !== 'en-US-BrianNeural' || entry.rate !== '-8%' || entry.pitch !== '-6Hz')) {
    notBrian.push(`${id} (${entry.voice} ${entry.rate} ${entry.pitch})`)
  }
  // Old-timer heckler: William, slower + lower, with the rasp post-process
  if (
    id.startsWith('old_') &&
    (entry.voice !== 'en-AU-WilliamMultilingualNeural' || entry.rate !== '-20%' || entry.pitch !== '-16Hz' || entry.post !== 'rasp-v1')
  ) {
    notOld.push(`${id} (${entry.voice} ${entry.rate} ${entry.pitch} ${entry.post ?? 'no post'})`)
  }
}
if (notBrian.length) throw new Error(`Roman clips not in the deeper Brian voice: ${notBrian.join(', ')}`)
if (notOld.length) throw new Error(`Old-timer clips not in the old-timer voice: ${notOld.join(', ')}`)
for (const [name, ids] of Object.entries(oldPools)) {
  const stray = ids.filter((id) => !id.startsWith('old_'))
  if (stray.length) throw new Error(`${name} old-timer pool has other clips: ${stray.join(' ')}`)
}
for (const [name, ids] of Object.entries(pools)) {
  const stray = ids.filter((id) => !id.startsWith('roman_'))
  if (stray.length) throw new Error(`${name} Roman pool has non-Roman clips: ${stray.join(' ')}`)
}

function assertBag(label: string, items: string[]) {
  const next = createShuffleBag(items, 3)
  const draws = Array.from({ length: items.length * 3 }, () => next())
  const first = draws.slice(0, items.length)
  if (new Set(first).size !== items.length) {
    throw new Error(`${label} did not walk the whole pool before repeating`)
  }
  for (let i = 0; i < draws.length; i++) {
    const recent = draws.slice(Math.max(0, i - 3), i)
    if (recent.includes(draws[i])) {
      throw new Error(`${label} repeated "${draws[i]}" within the last 3 lines`)
    }
  }
}

for (const [name, ids] of Object.entries({ ...pools, ...oldPools })) assertBag(name, ids)

console.log(
  `voices ok: ${voiceIds.length} clips (Roman all Brian, old-timer all William+rasp), ` +
    Object.entries({ ...pools, ...oldPools })
      .map(([name, ids]) => `${name} ${ids.length}`)
      .join(', '),
)
