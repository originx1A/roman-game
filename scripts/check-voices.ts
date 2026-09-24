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
for (const [name, ids] of Object.entries(pools)) {
  if (ids.length < 3) throw new Error(`${name} pool has only ${ids.length} clips`)
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`${name} pool uses unknown clip ${id}`)
    if (!fallbackIds.has(id)) throw new Error(`${name} pool clip ${id} has no fallback text`)
  }
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

assertBag('cheers', pools.cheers)
assertBag('wrong', pools.wrong)
assertBag('idle', pools.idle)

console.log(
  `voices ok: ${voiceIds.length} clips, cheers ${pools.cheers.length}, wrong ${pools.wrong.length}, idle ${pools.idle.length}`,
)
