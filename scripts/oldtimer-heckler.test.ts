import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const read = (rel: string) => readFileSync(new URL(rel, root), 'utf8')

const LINES: Record<string, string> = {
  old_aside_smell: 'I smell something funny. Was that you?',
  old_aside_heat: 'Who turned the heat up in here?',
  old_aside_glasses: 'Did somebody move my glasses?',
  old_aside_stove: 'Hold on, I think I left the stove on.',
  old_aside_tuesday: 'Is it Tuesday? Feels like a Tuesday.',
  old_aside_tea: "My tea's gone cold again. Story of my life.",
  old_aside_knees: "My knees just predicted rain. They're never wrong.",
  old_aside_remote: "Where'd I put the remote? Don't you move, I'm still talking.",
  old_aside_cat: "The cat's on the board again. Mentally. She's very judgmental.",
  old_aside_socks: "One sock's missing. I blame the squares.",
  old_jab_mitts: "You play like you're wearing oven mitts.",
  old_jab_bingo: "I've seen better moves at a bingo hall.",
  old_jab_phone: 'Is this your first time holding a phone?',
  old_jab_backday: "Back in my day we didn't tap. We committed.",
  old_jab_buddy: 'That buddy looks as confused as you do.',
  old_jab_square: 'Pick a square, any square. Preferably a different one.',
  old_jab_thinking: "I can hear you thinking. It's very quiet.",
  old_jab_patience: "I've got patience. You've got... something else.",
  old_jab_map: 'You need a map for a five-by-five? Bless your heart.',
  old_jab_shoes: 'Tie your shoes and try that square again.',
  old_good_fine: "Fine. That one was fine. Don't get excited.",
  old_good_accident: "A correct buddy. I'll assume it was an accident.",
  old_good_tea: "Not bad. I'll allow a sip of tea.",
  old_good_knees: 'My knees approve. High praise, from them.',
  old_good_once: 'You got one right. Write it down, it might not happen again.',
  old_good_square: 'That square can stay. The rest of them are still nervous.',
  old_good_grumble: "Hmm. Adequate. That's the nicest word I've got.",
  old_good_day: "Back in my day that would've been a Tuesday. Still, not terrible.",
}

test('old-timer plays a little faster with pitch left alone', () => {
  const sound = read('src/game/sound.ts')
  assert.match(sound, /const OLDTIMER_PLAYBACK_RATE = 1\.15/)
  assert.match(sound, /media\.preservesPitch = true/)
  assert.match(sound, /media\.webkitPreservesPitch = true/)
  assert.match(sound, /media\.playbackRate = OLDTIMER_PLAYBACK_RATE/)
  const roman = sound.slice(sound.indexOf("if (role === 'roman')"), sound.indexOf("} else if (role === 'oldtimer')"))
  const coach = sound.slice(sound.indexOf('} else {', sound.indexOf("role === 'oldtimer'")))
  assert.match(roman, /playbackRate = Math\.min\(0\.94, Math\.max\(0\.82, rate \* 0\.88\)\)/)
  assert.match(coach, /playbackRate = Math\.min\(1\.2, Math\.max\(0\.85, rate\)\)/)
  assert.equal(roman.includes('OLDTIMER_PLAYBACK_RATE'), false)
  assert.equal(coach.includes('OLDTIMER_PLAYBACK_RATE'), false)
})

test('new heckler lines use the William rasp recipe and stay in one pool each', () => {
  const voices = read('src/game/voiceLines.ts')
  const sound = read('src/game/sound.ts')
  const comments = read('src/game/comments.ts')
  const recipe = read('scripts/generate-voices.py')
  const manifest = JSON.parse(read('scripts/voice-manifest.json')) as Record<
    string,
    { voice: string; rate: string; pitch: string; post?: string; text: string }
  >
  const aside = block(comments, 'export const OLDTIMER_ASIDE_CLIPS = [', '] as const')
  const wrong = block(comments, 'export const OLDTIMER_WRONG_CLIPS = [', '] as const')
  const good = block(comments, 'export const OLDTIMER_GOOD_CLIPS = [', '] as const')
  assert.equal(Object.keys(LINES).length, 28)
  for (const [id, text] of Object.entries(LINES)) {
    assert.match(voices, new RegExp(`${id}: '/voices/${id}\\.mp3'`))
    assert.ok(sound.includes(`Old-timer: ${text}`), `${id} caption`)
    assert.match(recipe, new RegExp(`"${id}": "${escapeReg(text)}"`))
    assert.match(comments, new RegExp(`'${id}'`))
    const entry = manifest[id]
    assert.ok(entry, `${id} missing from voice-manifest.json`)
    assert.equal(entry.voice, 'en-AU-WilliamMultilingualNeural')
    assert.equal(entry.rate, '-20%')
    assert.equal(entry.pitch, '-16Hz')
    assert.equal(entry.post, 'rasp-v1')
    assert.equal(entry.text, text)
    const pools = [aside.includes(`'${id}'`), wrong.includes(`'${id}'`), good.includes(`'${id}'`)].filter(Boolean)
    assert.equal(pools.length, 1, `${id} should live in exactly one new pool`)
  }
  assert.match(comments, /export const OLDTIMER_SHARE = 0\.36/)
  assert.match(comments, /event === 'aside'/)
  assert.match(comments, /oldtimerTurn\(1\)/)
  assert.match(sound, /export function voiceQuietMs/)
  const app = read('src/App.tsx')
  assert.match(app, /40_000 \+ Math\.random\(\) \* 50_000/)
  assert.match(app, /pushBanter\('aside'\)/)
  assert.match(app, /resetVoiceQuietClock\(\)/)
})

function block(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  assert.ok(from >= 0, start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(to >= 0, end)
  return source.slice(from, to)
}

function escapeReg(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
