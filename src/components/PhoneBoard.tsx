import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloudScoresButton, useCloud } from '../cloud/CloudScores'
import { NAME_MAX } from '../cloud/cloud'
import {
  acceptFriend,
  acceptJoin,
  cancelFriend,
  cancelJoin,
  createGroup,
  declineFriend,
  declineJoin,
  leaveGroup,
  loadEveryone,
  loadFriends,
  loadGroupBoard,
  loadGroupCard,
  loadInbox,
  loadMembers,
  loadMyCard,
  loadPlayerCard,
  lockRosters,
  removeMember,
  requestJoin,
  sendFriend,
  unfriend,
  type GroupCard,
  type GroupRow,
  type InboxRow,
  type MemberRow,
  type MyCard,
  type PlayerCard,
  type PlayerRow,
} from '../cloud/friendsGroups'
import { isProfane } from '../cloud/profanity'

type Tab = 'everyone' | 'friends' | 'groups'
type Period = 'week' | 'month'
type Open =
  | null
  | { kind: 'me' }
  | { kind: 'player'; name: string; score: number; place: number; groupName: string | null }
  | { kind: 'group'; name: string; average: number; seasonPoints: number }
  | { kind: 'inbox' }

function fmt(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('en-US')
}

function statusLine(card: PlayerCard): string {
  const parts: string[] = []
  if (card.friendStatus === 'friends') parts.push('Friends')
  else if (card.friendStatus === 'pending' || card.friendStatus === 'incoming') parts.push('Pending')
  if (card.joinStatus === 'founder') parts.push('Founder')
  else if (card.joinStatus === 'member') parts.push('Member')
  else if (card.joinStatus === 'pending' && !parts.includes('Pending')) parts.push('Pending')
  return parts.join(' · ')
}

/** Phone leaderboard. Guests can look. Signed-in players can rank, add friends, and join groups. */
export function PhoneBoard({ playerName, onInfo }: { playerName: string; onInfo?: () => void }) {
  const cloud = useCloud()
  const guest = cloud.status !== 'signed-in'
  const signed = cloud.status === 'signed-in' && !!cloud.publicName
  const [tab, setTab] = useState<Tab>('everyone')
  const [period, setPeriod] = useState<Period>('week')
  const [rows, setRows] = useState<PlayerRow[] | null>(null)
  const [groups, setGroups] = useState<GroupRow[] | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(0)
  const [open, setOpen] = useState<Open>(null)
  const [rev, setRev] = useState(0)
  const changed = useCallback(() => setRev((n) => n + 1), [])
  const openMine = useCallback(() => setOpen({ kind: 'me' }), [])

  useEffect(() => {
    if (!signed) return
    void lockRosters()
  }, [signed])

  useEffect(() => {
    if (!signed) {
      setPending(0)
      return
    }
    let gone = false
    void loadMyCard().then((result) => {
      if (!gone && result.ok) setPending(result.data.pendingCount)
    })
    return () => {
      gone = true
    }
  }, [signed, rev, cloud.lastSync])

  useEffect(() => {
    let gone = false
    setNote('')
    if (tab === 'groups') {
      setGroups(null)
      void loadGroupBoard(period).then((result) => {
        if (gone) return
        if (!result.ok) {
          setGroups([])
          setNote(result.error)
          return
        }
        setGroups(result.data)
      })
    } else if (tab === 'friends') {
      setRows(null)
      if (!signed) {
        setRows([])
        return
      }
      void loadFriends().then((result) => {
        if (gone) return
        if (!result.ok) {
          setRows([])
          setNote(result.error)
          return
        }
        setRows(result.data)
      })
    } else {
      setRows(null)
      void loadEveryone().then((result) => {
        if (gone) return
        if (!result.ok) {
          setRows([])
          setNote(result.error)
          return
        }
        setRows(result.data)
      })
    }
    return () => {
      gone = true
    }
  }, [tab, period, signed, rev, cloud.lastSync, cloud.publicName])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const you = signed ? cloud.publicName : ''
  const list = tab === 'groups' ? groups : rows
  const empty =
    tab === 'friends' ? (signed ? 'No friends yet.' : 'Sign in to see friends.') : tab === 'groups' ? (period === 'month' ? 'No groups this month.' : 'No groups this week.') : 'No scores yet.'

  return (
    <main className="phone-board scroll-pane" data-testid="phone-board">
      <div className="board-head">
        <h2>Leaderboard</h2>
        {signed ? (
          <button type="button" className="board-inbox" data-testid="board-inbox" onClick={() => setOpen({ kind: 'inbox' })}>
            Requests
            {pending > 0 ? <span className="badge">{pending}</span> : null}
          </button>
        ) : null}
      </div>
      <div className="mode-picker" role="tablist" aria-label="Leaderboard">
        <button type="button" role="tab" data-testid="board-tab-everyone" aria-selected={tab === 'everyone'} className={tab === 'everyone' ? 'on' : undefined} onClick={() => setTab('everyone')}>Everyone</button>
        <button type="button" role="tab" data-testid="board-tab-friends" aria-selected={tab === 'friends'} className={tab === 'friends' ? 'on' : undefined} onClick={() => setTab('friends')}>Friends</button>
        <button type="button" role="tab" data-testid="board-tab-groups" aria-selected={tab === 'groups'} className={tab === 'groups' ? 'on' : undefined} onClick={() => setTab('groups')}>Groups</button>
      </div>
      {tab === 'groups' ? (
        <div className="mode-picker" role="group" aria-label="Group period">
          <button type="button" data-testid="board-period-week" aria-pressed={period === 'week'} className={period === 'week' ? 'on' : undefined} onClick={() => setPeriod('week')}>Week</button>
          <button type="button" data-testid="board-period-month" aria-pressed={period === 'month'} className={period === 'month' ? 'on' : undefined} onClick={() => setPeriod('month')}>Month</button>
        </div>
      ) : null}
      {list === null ? null : note ? (
        <p className="cloud-err" role="alert">{note}</p>
      ) : list.length === 0 ? (
        <p className="phone-board-empty">{empty}</p>
      ) : tab === 'groups' ? (
        <ol aria-label="Groups">
          {groups?.map((row) => (
            <li key={row.groupName}>
              <button type="button" className="board-row" data-testid="board-row" onClick={() => setOpen({ kind: 'group', name: row.groupName, average: row.average, seasonPoints: row.seasonPoints })}>
                <span className="place">{row.place}</span>
                <span className="name"><span className="who">{row.groupName}</span></span>
                <span className="score">
                  {fmt(row.average)}
                  <small>Season {fmt(row.seasonPoints)}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <ol aria-label={tab === 'friends' ? 'Friends' : 'Everyone'}>
          {rows?.map((row) => {
            const mine = !!you && row.name.toLowerCase() === you.toLowerCase()
            return (
              <li key={row.name} className={mine ? 'is-you' : undefined}>
                <button
                  type="button"
                  className="board-row"
                  data-testid="board-row"
                  onClick={() => setOpen(mine ? { kind: 'me' } : { kind: 'player', name: row.name, score: row.score, place: row.place, groupName: row.groupName })}
                >
                  <span className="place">{row.place}</span>
                  <span className="name">
                    <span className="who">{row.name}</span>
                    {row.groupName ? <small className="group-tag">{row.groupName}</small> : null}
                  </span>
                  <span className="score">{fmt(row.score)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {guest ? <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" onInfo={onInfo} /> : null}
      {open?.kind === 'me' ? <MySheet onClose={() => setOpen(null)} onChanged={changed} onInbox={() => setOpen({ kind: 'inbox' })} onGroup={(name) => setOpen({ kind: 'group', name, average: 0, seasonPoints: 0 })} rev={rev} /> : null}
      {open?.kind === 'player' ? (
        <PlayerSheet
          seed={open}
          signed={signed}
          playerName={playerName}
          onInfo={onInfo}
          rev={rev}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onMine={openMine}
        />
      ) : null}
      {open?.kind === 'group' ? (
        <GroupSheet
          seed={open}
          period={period}
          signed={signed}
          playerName={playerName}
          onInfo={onInfo}
          rev={rev}
          onClose={() => setOpen(null)}
          onChanged={changed}
        />
      ) : null}
      {open?.kind === 'inbox' ? <InboxSheet rev={rev} onClose={() => setOpen(null)} onChanged={changed} /> : null}
    </main>
  )
}

function Sheet({ title, label, onClose, children }: { title: string; label: string; onClose: () => void; children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="phone-sheet board-sheet" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="phone-sheet-card" data-testid="board-sheet">
        <header>
          <strong>{title}</strong>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function Err({ text }: { text: string }) {
  if (!text) return null
  return <p className="cloud-err" role="alert">{text}</p>
}

function MySheet({ onClose, onChanged, onInbox, onGroup, rev }: { onClose: () => void; onChanged: () => void; onInbox: () => void; onGroup: (name: string) => void; rev: number }) {
  const [card, setCard] = useState<MyCard | null>(null)
  const [note, setNote] = useState('')
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    void loadMyCard().then((result) => {
      if (gone) return
      if (!result.ok) {
        setCard(null)
        setNote(result.error)
        return
      }
      setNote('')
      setCard(result.data)
    })
    return () => {
      gone = true
    }
  }, [rev])

  async function makeGroup(event: FormEvent) {
    event.preventDefault()
    const name = groupName.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
    if (!name) {
      setNote('Enter a name.')
      return
    }
    if (isProfane(name)) {
      setNote('Pick another name.')
      return
    }
    setBusy(true)
    const result = await createGroup(name)
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    setGroupName('')
    onChanged()
    onGroup(name)
  }

  async function leave() {
    setBusy(true)
    const result = await leaveGroup()
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    onChanged()
  }

  return (
    <Sheet title={card?.name || 'You'} label="Your place" onClose={onClose}>
      <Err text={note} />
      {card ? (
        <>
          <dl className="player-stats">
            <div><dt>Score</dt><dd>{fmt(card.score)}</dd></div>
            <div><dt>Rank</dt><dd>{fmt(card.place)}</dd></div>
            <div><dt>Friends</dt><dd>{card.friendsCount}</dd></div>
            <div><dt>Requests</dt><dd>{card.pendingCount}</dd></div>
          </dl>
          <p className="board-line">
            Group
            {card.groupName ? (
              <button type="button" className="board-link" onClick={() => onGroup(card.groupName!)}>{card.groupName}</button>
            ) : (
              <span>None</span>
            )}
            {card.founder ? <small className="group-tag">Founder</small> : null}
          </p>
          <div className="board-actions">
            <button type="button" className="btn ghost" onClick={onInbox}>Requests</button>
            {card.groupName ? (
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void leave()}>Leave group</button>
            ) : null}
          </div>
          {card.groupName ? null : (
            <form className="board-create" onSubmit={(event) => void makeGroup(event)}>
              <input className="name-input" aria-label="Group name" placeholder="Group name" maxLength={NAME_MAX} value={groupName} onChange={(event) => setGroupName(event.target.value)} />
              <button type="submit" className="btn primary" disabled={busy}>Create group</button>
            </form>
          )}
        </>
      ) : null}
    </Sheet>
  )
}

function PlayerSheet({
  seed,
  signed,
  playerName,
  onInfo,
  rev,
  onClose,
  onChanged,
  onMine,
}: {
  seed: { name: string; score: number; place: number; groupName: string | null }
  signed: boolean
  playerName: string
  onInfo?: () => void
  rev: number
  onClose: () => void
  onChanged: () => void
  onMine: () => void
}) {
  const [card, setCard] = useState<PlayerCard | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    void loadPlayerCard(seed.name).then((result) => {
      if (gone) return
      if (!result.ok) {
        setCard(null)
        setNote(result.error)
        return
      }
      if (result.data.isYou) {
        onMine()
        return
      }
      setNote('')
      setCard(result.data)
    })
    return () => {
      gone = true
    }
  }, [seed.name, rev, onMine])

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    setNote('')
    onChanged()
  }

  const view = card ?? {
    name: seed.name,
    score: seed.score,
    place: seed.place,
    groupName: seed.groupName,
    friendStatus: 'none' as const,
    joinStatus: (seed.groupName ? 'none' : 'no_group') as PlayerCard['joinStatus'],
    isYou: false,
  }
  const line = statusLine(view)
  const bothPending = view.friendStatus === 'pending' && view.joinStatus === 'pending'

  return (
    <Sheet title={view.name} label={view.name} onClose={onClose}>
      <Err text={!signed && !card ? '' : note} />
      {view ? (
        <>
          <dl className="player-stats">
            <div><dt>Score</dt><dd>{fmt(view.score)}</dd></div>
            <div><dt>Rank</dt><dd>{fmt(view.place)}</dd></div>
            <div><dt>Group</dt><dd>{view.groupName ? <span className="group-tag">{view.groupName}</span> : 'None'}</dd></div>
          </dl>
          {line ? <p className="board-status">{line}</p> : null}
          {signed ? (
            <div className="board-actions">
              {view.friendStatus === 'none' ? <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => sendFriend(view.name))}>Add friend</button> : null}
              {view.friendStatus === 'pending' ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => cancelFriend(view.name))}>{bothPending ? 'Cancel friend request' : 'Cancel request'}</button> : null}
              {view.friendStatus === 'incoming' ? <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => acceptFriend(view.name))}>Accept</button> : null}
              {view.friendStatus === 'incoming' ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => declineFriend(view.name))}>Decline</button> : null}
              {view.friendStatus === 'friends' ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => unfriend(view.name))}>Unfriend</button> : null}
              {view.joinStatus === 'none' && view.groupName ? <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => requestJoin(view.groupName || ''))}>Request to join</button> : null}
              {view.joinStatus === 'pending' && view.groupName ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => cancelJoin(view.groupName || ''))}>{bothPending ? 'Cancel join request' : 'Cancel request'}</button> : null}
              {view.joinStatus === 'member' || view.joinStatus === 'founder' ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(leaveGroup)}>Leave group</button> : null}
            </div>
          ) : (
            <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" onInfo={onInfo} />
          )}
        </>
      ) : null}
    </Sheet>
  )
}

function GroupSheet({
  seed,
  period,
  signed,
  playerName,
  onInfo,
  rev,
  onClose,
  onChanged,
}: {
  seed: { name: string; average: number; seasonPoints: number }
  period: Period
  signed: boolean
  playerName: string
  onInfo?: () => void
  rev: number
  onClose: () => void
  onChanged: () => void
}) {
  const [card, setCard] = useState<GroupCard | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    void loadGroupCard(seed.name).then((result) => {
      if (gone) return
      if (!result.ok) {
        setCard(null)
        setNote(result.error)
        return
      }
      setNote('')
      setCard(result.data)
    })
    void loadMembers(seed.name).then((result) => {
      if (!gone && result.ok) setMembers(result.data)
    })
    return () => {
      gone = true
    }
  }, [seed.name, rev])

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    setNote('')
    onChanged()
  }

  const view = card ?? {
    groupName: seed.name,
    weekAverage: period === 'week' ? seed.average : null,
    monthAverage: period === 'month' ? seed.average : null,
    seasonPoints: seed.seasonPoints,
    activeWeek: 0,
    activeMonth: 0,
    joinStatus: 'none' as const,
  }
  const mine = view.joinStatus === 'member' || view.joinStatus === 'founder'
  const active = period === 'month' ? view.activeMonth : view.activeWeek

  return (
    <Sheet title={view.groupName} label={view.groupName} onClose={onClose}>
      <Err text={!signed && !card ? '' : note} />
      {view ? (
        <>
          <dl className="player-stats">
            <div><dt>Week</dt><dd>{fmt(view.weekAverage)}</dd></div>
            <div><dt>Month</dt><dd>{fmt(view.monthAverage)}</dd></div>
            <div><dt>Season</dt><dd>{fmt(view.seasonPoints)}</dd></div>
            <div><dt>Active</dt><dd>{active}</dd></div>
          </dl>
          {view.joinStatus === 'founder' ? <p className="board-status">Founder</p> : null}
          {view.joinStatus === 'member' ? <p className="board-status">Member</p> : null}
          {view.joinStatus === 'pending' ? <p className="board-status">Pending</p> : null}
          {signed ? (
            <div className="board-actions">
              {view.joinStatus === 'none' ? <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => requestJoin(view.groupName))}>Request to join</button> : null}
              {view.joinStatus === 'pending' ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => cancelJoin(view.groupName))}>Cancel request</button> : null}
              {mine ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(leaveGroup)}>Leave group</button> : null}
            </div>
          ) : (
            <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" onInfo={onInfo} />
          )}
          {members.length > 0 ? (
            <ul className="member-list" aria-label="Members">
              {members.map((member) => (
                <li key={member.name}>
                  <span className="name">{member.name}</span>
                  <span className="state">{member.status === 'inactive' ? 'Inactive' : 'Active'}</span>
                  {member.canRemove ? (
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => removeMember(member.name))}>Remove</button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </Sheet>
  )
}

function InboxSheet({ rev, onClose, onChanged }: { rev: number; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<InboxRow[] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    void loadInbox().then((result) => {
      if (gone) return
      if (!result.ok) {
        setRows([])
        setNote(result.error)
        return
      }
      setNote('')
      setRows(result.data)
    })
    return () => {
      gone = true
    }
  }, [rev])

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    setNote('')
    onChanged()
  }

  return (
    <Sheet title="Requests" label="Requests" onClose={onClose}>
      <Err text={note} />
      {rows === null ? null : rows.length === 0 ? (
        <p className="phone-board-empty">No requests.</p>
      ) : (
        <ul className="member-list" aria-label="Requests">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.name}`}>
              <span className="state">{row.kind === 'join' ? 'Join' : 'Friend'}</span>
              <span className="name">{row.name}</span>
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => (row.kind === 'join' ? acceptJoin(row.name) : acceptFriend(row.name)))}>Accept</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => (row.kind === 'join' ? declineJoin(row.name) : declineFriend(row.name)))}>Decline</button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
