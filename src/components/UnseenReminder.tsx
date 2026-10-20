import { useEffect, useRef, useState } from 'react'
import { isComputerPlayer } from '../game/lineCaption'
import { playReminderLine } from '../game/reminderVoice'
import {
  bumpSessionSignIns,
  loadReminderMemory,
  loadSessionSignIns,
  markDismissed,
  markShown,
  pickReminder,
  reminderText,
  saveReminderMemory,
  type ReminderFacts,
  type ReminderId,
} from '../game/unseenReminders'

/**
 * Dev Strict Mode mounts Home, throws that render away, and mounts it again.
 * The first pass already wrote "shown" into storage. Reuse that choice so the
 * second pass does not burn the next reminder before the player ever sees it.
 */
let lastVisit: { at: number; id: ReminderId | null; text: string | null } | null = null

/**
 * One reminder for this Home visit. Leaving Home unmounts it, so the next visit can choose again.
 */
export function HomeUnseenReminder({ facts, onConsumed }: { facts: ReminderFacts; onConsumed: () => void }) {
  const [text, setText] = useState<string | null>(null)
  const idRef = useRef<ReminderId | null>(null)
  const factsRef = useRef(facts)
  factsRef.current = facts

  useEffect(() => {
    const now = Date.now()
    if (lastVisit && now - lastVisit.at < 500) {
      idRef.current = lastVisit.id
      setText(lastVisit.text)
      if (lastVisit.id) void playReminderLine(lastVisit.id)
      onConsumed()
      return
    }
    const current = { ...factsRef.current, sessionSignIns: loadSessionSignIns() }
    let memory = loadReminderMemory()
    const choice = pickReminder(current, memory)
    if (choice.rememberRemixSet != null) memory = { ...memory, remixSeen: choice.rememberRemixSet }
    if (choice.pick) {
      memory = markShown(memory, choice.pick.id, current.now, current.today, current.remixSet)
      if (choice.pick.id === 'signin') bumpSessionSignIns()
      idRef.current = choice.pick.id
      setText(reminderText(choice.pick.id, isComputerPlayer()))
    }
    lastVisit = { at: now, id: choice.pick?.id ?? null, text: choice.pick?.text ?? null }
    saveReminderMemory(memory)
    if (choice.pick) void playReminderLine(choice.pick.id)
    onConsumed()
    // One decision per visit. Later Home renders must not swap in a second reminder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!text) return null
  return (
    <UnseenReminder
      text={text}
      onDismiss={() => {
        const id = idRef.current
        const current = factsRef.current
        if (id) saveReminderMemory(markDismissed(loadReminderMemory(), id, current.now, current.today, current.remixSet))
        setText(null)
      }}
    />
  )
}

/**
 * A dismissible Unseen note on Home. It plays its recording here.
 * A live board never mounts this, and the corner pop-up stays off until the board is over.
 */
export function UnseenReminder({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <aside className="unseen-reminder" data-testid="unseen-reminder" aria-label="The Unseen">
      <img className="unseen-reminder-art" src="/images/unseen.png" alt="" draggable={false} />
      <div>
        <span className="unseen-reminder-name">The Unseen</span>
        <p>{text}</p>
        <button type="button" className="unseen-reminder-dismiss" data-testid="unseen-reminder-dismiss" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </aside>
  )
}
