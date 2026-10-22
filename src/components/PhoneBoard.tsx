import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloudScoresButton, useCloud } from '../cloud/CloudScores'
import {
  acceptFriend,
  acceptJoin,
  cancelFriend,
  cancelJoin,
  createGroup,
  declineFriend,
  declineJoin,
  demoteCaptain,
  leaveGroup,
  leavePreview,
  loadEveryone,
  loadFriends,
  loadGroupBoard,
  loadGroupCard,
  loadInbox,
  loadMembers,
  loadMyCard,
  loadPlayerCard,
  lockRosters,
  promoteCaptain,
  removeMember,
  renameGroup,
  requestJoin,
  sendFriend,
  unfriend,
  type GroupCard,
  type GroupLink,
  type GroupRole,
  type GroupRow,
  type InboxRow,
  type MemberRow,
  type MyCard,
  type PlayerCard,
  type PlayerRow,
} from '../cloud/friendsGroups'
import { GROUP_ADJECTIVES, GROUP_NOUNS } from '../cloud/groupNames'

type Tab = 'everyone' | 'friends' | 'groups'
type Period = 'week' | 'month'
type Open =
  | null
  | { kind: 'me' }
  | { kind: 'player'; name: string; score: number; place: number; groupName: string | null }
  | { kind: 'group'; name: string; average: number; seasonPoints: number }
  | { kind: 'inbox' }
  | { kind: 'create' }

function fmt(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('en-US')
}

function isLeader(status: string): boolean {
  return status === 'leader' || status === 'founder'
}

function statusLine(card: PlayerCard): string {
  const parts: string[] = []
  if (card.friendStatus === 'friends') parts.push('Friends')
  else if (card.friendStatus === 'pending' || card.friendStatus === 'incoming') parts.push('Pending')
  if (card.joinStatus === 'member' || card.joinStatus === 'captain' || isLeader(card.joinStatus)) parts.push('Member')
  else if (card.joinStatus === 'pending' && !parts.includes('Pending')) parts.push('Pending')
  return parts.join(' · ')
}

function leaveCopy(nextName: string | null, closes: boolean): string {
  if (closes) return 'Leave this group? You are the last member, so the group will close. Points stay.'
  if (nextName) return `Leave this group? ${nextName} becomes Leader.`
  return 'Leave this group? Points you earned stay with the group.'
}

function RoleBadge({ role }: { role: GroupRole | string }) {
  if (role === 'leader') return <small className="role-badge">👑 Leader</small>
  if (role === 'captain') return <small className="role-badge">⭐ Captain</small>
  return null
}

/** Phone board, and the centred desktop board. Guests can look. Signed-in players can rank, add friends, and join groups. */
export function PhoneBoard({ playerName, onInfo, onClose }: { playerName: string; onInfo?: () => void; onClose?: () => void }) {
  const cloud = useCloud()
  const guest = cloud.status !== 'signed-in'
  const signed = cloud.status === 'signed-in' && !!cloud.publicName
  const [tab, setTab] = useState<Tab>('everyone')
  const [period, setPeriod] = useState<Period>('week')
  const [rows, setRows] = useState<PlayerRow[] | null>(null)
  const [groups, setGroups] = useState<GroupRow[] | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(0)
  const [myGroup, setMyGroup] = useState<string | null | undefined>(undefined)
  const [open, setOpen] = useState<Open>(null)
  const [rev, setRev] = useState(0)
  const changed = useCallback(() => setRev((n) => n + 1), [])
  const openMine = useCallback(() => setOpen({ kind: 'me' }), [])
  const openGroup = useCallback((name: string) => setOpen({ kind: 'group', name, average: 0, seasonPoints: 0 }), [])

  useEffect(() => {
    if (!signed) return
    void lockRosters()
  }, [signed])

  useEffect(() => {
    if (!signed) {
      setPending(0)
      setMyGroup(undefined)
      return
    }
    let gone = false
    void loadMyCard().then((result) => {
      if (gone) return
      if (!result.ok) {
        setPending(0)
        setMyGroup(null)
        return
      }
      setPending(result.data.pendingCount)
      setMyGroup(result.data.groupName)
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
    if (!open && !onClose) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (open) setOpen(null)
      else onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const you = signed ? cloud.publicName : ''
  const list = tab === 'groups' ? groups : rows
  const empty =
    tab === 'friends' ? (signed ? 'No friends yet.' : 'Sign in to see friends.') : tab === 'groups' ? (period === 'month' ? 'No groups this month.' : 'No groups this week.') : 'No scores yet.'

  return (
    <main className="phone-board scroll-pane" data-testid="phone-board">
      <div className="board-head">
        <h2>Leaderboard</h2>
        <div className="board-head-actions">
          {signed ? (
            <button type="button" className="board-inbox" data-testid="board-inbox" onClick={() => setOpen({ kind: 'inbox' })}>
              Requests
              {pending > 0 ? <span className="badge">{pending}</span> : null}
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="btn ghost" data-testid="board-close" onClick={onClose}>Close</button>
          ) : null}
        </div>
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
      {tab === 'groups' && signed && myGroup !== undefined ? (
        <div className="board-tools">
          {myGroup ? (
            <button type="button" className="btn primary" data-testid="my-group" onClick={() => openGroup(myGroup)}>My group</button>
          ) : (
            <button type="button" className="btn primary" data-testid="create-group" onClick={() => setOpen({ kind: 'create' })}>+ Create a group</button>
          )}
          <button type="button" className="btn ghost" data-testid="group-requests" onClick={() => setOpen({ kind: 'inbox' })}>
            Requests
            {pending > 0 ? <span className="count"> {pending}</span> : null}
          </button>
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
      {open?.kind === 'me' ? <MySheet onClose={() => setOpen(null)} onChanged={changed} onInbox={() => setOpen({ kind: 'inbox' })} onGroup={openGroup} onCreate={() => setOpen({ kind: 'create' })} rev={rev} /> : null}
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
          key={open.name}
          seed={open}
          period={period}
          signed={signed}
          playerName={playerName}
          onInfo={onInfo}
          rev={rev}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onRenamed={openGroup}
        />
      ) : null}
      {open?.kind === 'inbox' ? <InboxSheet rev={rev} onClose={() => setOpen(null)} onChanged={changed} /> : null}
      {open?.kind === 'create' ? (
        <CreateSheet
          onClose={() => setOpen(null)}
          onCreated={(name) => {
            changed()
            openGroup(name)
          }}
        />
      ) : null}
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

function NamePicker({ busy, submitLabel, onSubmit }: { busy: boolean; submitLabel: string; onSubmit: (adjective: string, noun: string) => void }) {
  const [adjective, setAdjective] = useState<string>(GROUP_ADJECTIVES[0])
  const [noun, setNoun] = useState<string>(GROUP_NOUNS[0])
  return (
    <form
      className="name-pick"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(adjective, noun)
      }}
    >
      <label>
        Adjective
        <select data-testid="group-adjective" value={adjective} onChange={(event) => setAdjective(event.target.value)}>
          {GROUP_ADJECTIVES.map((word) => (
            <option key={word} value={word}>{word}</option>
          ))}
        </select>
      </label>
      <label>
        Noun
        <select data-testid="group-noun" value={noun} onChange={(event) => setNoun(event.target.value)}>
          {GROUP_NOUNS.map((word) => (
            <option key={word} value={word}>{word}</option>
          ))}
        </select>
      </label>
      <p className="name-preview" data-testid="group-name-preview">{adjective} {noun} #…</p>
      <button type="submit" className="btn primary" disabled={busy}>{submitLabel}</button>
    </form>
  )
}

function LeaveControl({ onDone, onError }: { onDone: () => void; onError: (message: string) => void }) {
  const [ask, setAsk] = useState('')
  const [busy, setBusy] = useState(false)

  async function askLeave() {
    const preview = await leavePreview()
    setAsk(preview.ok ? leaveCopy(preview.data.nextName, preview.data.closes) : leaveCopy(null, false))
  }

  async function go() {
    setBusy(true)
    const result = await leaveGroup()
    setBusy(false)
    if (!result.ok) {
      onError(result.error)
      setAsk('')
      return
    }
    setAsk('')
    onDone()
  }

  if (!ask) {
    return <button type="button" className="btn ghost" disabled={busy} onClick={() => void askLeave()}>Leave group</button>
  }
  return (
    <div className="board-confirm" data-testid="leave-confirm">
      <p>{ask}</p>
      <div className="board-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={() => void go()}>Leave group</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => setAsk('')}>Stay</button>
      </div>
    </div>
  )
}

function MySheet({ onClose, onChanged, onInbox, onGroup, onCreate, rev }: { onClose: () => void; onChanged: () => void; onInbox: () => void; onGroup: (name: string) => void; onCreate: () => void; rev: number }) {
  const [card, setCard] = useState<MyCard | null>(null)
  const [note, setNote] = useState('')

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

  const role: GroupRole = card?.role || (card?.founder ? 'leader' : '')

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
            <RoleBadge role={role} />
          </p>
          <div className="board-actions">
            <button type="button" className="btn ghost" onClick={onInbox}>Requests</button>
            {card.groupName ? null : <button type="button" className="btn primary" onClick={onCreate}>+ Create a group</button>}
          </div>
          {card.groupName ? <LeaveControl onDone={onChanged} onError={setNote} /> : null}
        </>
      ) : null}
    </Sheet>
  )
}

function CreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function make(adjective: string, noun: string) {
    setBusy(true)
    const result = await createGroup(adjective, noun)
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    onCreated(result.name)
  }

  return (
    <Sheet title="Create a group" label="Create a group" onClose={onClose}>
      <Err text={note} />
      <NamePicker busy={busy} submitLabel="Create group" onSubmit={(adjective, noun) => void make(adjective, noun)} />
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
    role: '' as const,
  }
  const line = statusLine(view)
  const bothPending = view.friendStatus === 'pending' && view.joinStatus === 'pending'
  const inGroup = view.joinStatus === 'member' || view.joinStatus === 'captain' || isLeader(view.joinStatus)

  return (
    <Sheet title={view.name} label={view.name} onClose={onClose}>
      <Err text={!signed && !card ? '' : note} />
      {view ? (
        <>
          <dl className="player-stats">
            <div><dt>Score</dt><dd>{fmt(view.score)}</dd></div>
            <div><dt>Rank</dt><dd>{fmt(view.place)}</dd></div>
            <div>
              <dt>Group</dt>
              <dd>
                {view.groupName ? <span className="group-tag">{view.groupName}</span> : 'None'}
                <RoleBadge role={view.role} />
              </dd>
            </div>
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
            </div>
          ) : (
            <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" onInfo={onInfo} />
          )}
          {signed && inGroup ? <LeaveControl onDone={onChanged} onError={setNote} /> : null}
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
  onRenamed,
}: {
  seed: { name: string; average: number; seasonPoints: number }
  period: Period
  signed: boolean
  playerName: string
  onInfo?: () => void
  rev: number
  onClose: () => void
  onChanged: () => void
  onRenamed: (name: string) => void
}) {
  const [card, setCard] = useState<GroupCard | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    let gone = false
    setMembers([])
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
    return () => {
      gone = true
    }
  }, [seed.name, rev])

  const confirmed = card != null && card.groupName === seed.name
  const leader = confirmed && isLeader(card.joinStatus)
  const mine = leader || (confirmed && (card.joinStatus === 'member' || card.joinStatus === 'captain'))

  useEffect(() => {
    if (!mine) return
    let gone = false
    void loadMembers(seed.name).then((result) => {
      if (!gone && result.ok) setMembers(result.data)
    })
    return () => {
      gone = true
    }
  }, [mine, seed.name, rev])

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

  async function rename(adjective: string, noun: string) {
    setBusy(true)
    const result = await renameGroup(adjective, noun)
    setBusy(false)
    if (!result.ok) {
      setNote(result.error)
      return
    }
    setRenaming(false)
    setNote('')
    onChanged()
    onRenamed(result.name)
  }

  const view = card ?? {
    groupName: seed.name,
    weekAverage: period === 'week' ? seed.average : null,
    monthAverage: period === 'month' ? seed.average : null,
    seasonPoints: seed.seasonPoints,
    activeWeek: 0,
    activeMonth: 0,
    joinStatus: 'none' as GroupLink,
  }
  const active = period === 'month' ? view.activeMonth : view.activeWeek
  const captains = members.filter((member) => member.role === 'captain').length
  const rankLabel = leader ? 'Leader' : view.joinStatus === 'captain' ? 'Captain' : view.joinStatus === 'member' ? 'Member' : view.joinStatus === 'pending' ? 'Pending' : ''

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
          {rankLabel ? <p className="board-status">{rankLabel}</p> : null}
          {signed ? (
            <div className="board-actions">
              {view.joinStatus === 'none' ? <button type="button" className="btn primary" disabled={busy} onClick={() => void run(() => requestJoin(view.groupName))}>Request to join</button> : null}
              {view.joinStatus === 'pending' ? <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => cancelJoin(view.groupName))}>Cancel request</button> : null}
              {leader ? <button type="button" className="btn ghost" disabled={busy} onClick={() => setRenaming((open) => !open)}>Rename</button> : null}
            </div>
          ) : (
            <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" onInfo={onInfo} />
          )}
          {renaming ? <NamePicker busy={busy} submitLabel="Rename" onSubmit={(adjective, noun) => void rename(adjective, noun)} /> : null}
          {signed && mine ? <LeaveControl onDone={() => { onChanged(); onClose() }} onError={setNote} /> : null}
          {mine && members.length > 0 ? (
            <ul className="member-list" aria-label="Members">
              {members.map((member) => (
                <li key={member.name}>
                  <span className="name">{member.name}</span>
                  <RoleBadge role={member.role} />
                  {member.nextInLine ? <small className="next-tag">Next in line</small> : null}
                  <span className="state">{member.status === 'inactive' ? 'Inactive' : 'Active'}</span>
                  {leader && member.role === 'member' && captains < 2 ? (
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => promoteCaptain(member.name))}>Promote</button>
                  ) : null}
                  {leader && member.role === 'captain' ? (
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => demoteCaptain(member.name))}>Demote</button>
                  ) : null}
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
