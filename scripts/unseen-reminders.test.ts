import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REMINDER_LINES,
  emptyReminderMemory,
  markDismissed,
  pickReminder,
  type ReminderFacts,
  type ReminderMemory,
} from '../src/game/unseenReminders.ts'

const NOW = Date.parse('2026-10-20T16:00:00.000Z')

function facts(partial: Partial<ReminderFacts> = {}): ReminderFacts {
  return {
    now: NOW,
    today: '2026-10-20',
    cloudKnown: true,
    signedIn: true,
    afterGame: false,
    sessionSignIns: 0,
    hungryPet: false,
    canSpend: false,
    dailyPlayed: true,
    streakAtRisk: false,
    remixSet: 7,
    ...partial,
  }
}

test('a streak at risk beats the daily line, and the daily line is for a day with no streak', () => {
  const both = pickReminder(facts({ streakAtRisk: true, dailyPlayed: false }), emptyReminderMemory())
  assert.equal(both.pick?.text, REMINDER_LINES.streak)
  const quiet = pickReminder(facts({ dailyPlayed: false }), emptyReminderMemory())
  assert.equal(quiet.pick?.text, REMINDER_LINES.daily)
})

test('each reminder waits out its cooldown', () => {
  const memory: ReminderMemory = {
    ...emptyReminderMemory(),
    remixSeen: 7,
    shownOn: { streak: '2026-10-20', daily: '2026-10-20' },
    shownAt: { pets: NOW - 60_000, coins: NOW - 60_000 },
  }
  const none = pickReminder(facts({ streakAtRisk: true, dailyPlayed: false, hungryPet: true, canSpend: true }), memory)
  assert.equal(none.pick, null)
  const later = pickReminder(
    facts({ hungryPet: true, now: NOW + 21 * 3_600_000 }),
    memory,
  )
  assert.equal(later.pick?.id, 'pets')
})

test('the first remix visit is remembered quietly, the next set is announced once', () => {
  const first = pickReminder(facts({ remixSet: 4 }), emptyReminderMemory())
  assert.equal(first.pick, null)
  assert.equal(first.rememberRemixSet, 4)
  const same = pickReminder(facts({ remixSet: 4 }), { ...emptyReminderMemory(), remixSeen: 4 })
  assert.equal(same.pick, null)
  const next = pickReminder(facts({ remixSet: 5 }), { ...emptyReminderMemory(), remixSeen: 4 })
  assert.equal(next.pick?.text, REMINDER_LINES.remix)
})

test('sign-in is after a game, twice a session, and stops after two dismissals', () => {
  const base = facts({ signedIn: false, afterGame: true, dailyPlayed: true })
  assert.equal(pickReminder(base, emptyReminderMemory()).pick?.text, REMINDER_LINES.signin)
  assert.equal(pickReminder(facts({ signedIn: false, afterGame: false }), emptyReminderMemory()).pick, null)
  assert.equal(pickReminder({ ...base, sessionSignIns: 2 }, emptyReminderMemory()).pick, null)
  let memory = emptyReminderMemory()
  memory = markDismissed(memory, 'signin', NOW, '2026-10-20', 7)
  assert.equal(pickReminder(base, memory).pick?.id, 'signin')
  memory = markDismissed(memory, 'signin', NOW, '2026-10-20', 7)
  assert.equal(pickReminder(base, memory).pick, null)
  assert.equal(pickReminder(facts({ signedIn: false, cloudKnown: false, afterGame: true }), emptyReminderMemory()).pick, null)
})

test('coins and a hungry buddy have their own lines, and only one is chosen', () => {
  const choice = pickReminder(facts({ hungryPet: true, canSpend: true, remixSet: 3 }), { ...emptyReminderMemory(), remixSeen: 3 })
  assert.equal(choice.pick?.text, REMINDER_LINES.pets)
  const coins = pickReminder(facts({ canSpend: true, remixSet: 3 }), { ...emptyReminderMemory(), remixSeen: 3 })
  assert.equal(coins.pick?.text, REMINDER_LINES.coins)
})
