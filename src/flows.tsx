import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, type Me } from './api'
import { BoardView } from './ui/BoardView'
import { ClothArt, DefenderArt } from './ui/DefenderArt'
import { isSolved } from './game/logic'
import { sfxGiggle, sfxMark, sfxPlace } from './game/sound'
import { ADJECTIVES, NOUNS, formatTeamName } from './game/teamNames'
import { CHARGE_COST, CHARGE_LABEL, DEFENDERS, DEFENDER_PRICE, PETS, CLOTHES, PACKS, SELLER, SUPPORT_EMAIL, STARTER_COINS, WEEK_WIN_BONUS_AT, centsForSku, formatCoins, formatPrice, isSku, priceForCountry, sameSiteNext, type Sku } from './game/catalog'
import { torontoDate } from './game/generate'
import { pointsWeekKey } from './game/points'
import { boardKey, boardSteps, parseBoardKey, throneAt, throneForBoards, throneIdForBoard, winMap } from './game/thrones'
import type { Copy, Lang } from './i18n'
import { legalSections } from './i18n'
import { go } from './nav'
import { BUILD_NUMBER } from './game/catalog'

export interface Bag {
  t: Copy
  lang: Lang
  pc: boolean
  me: Me | null
  onMe: (me: Me | null) => void
  setLang: (lang: Lang) => void
  path: string
}

export function LegalLinks({ t }: { t: Copy }) {
  return (
    <nav className="legal-row" aria-label={t.helpLegal}>
      <button className="legal-link" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
      <button className="legal-link" type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
      <button className="legal-link" type="button" onClick={() => go('/legal/disclosures')}>{t.disclosures}</button>
    </nav>
  )
}

function errText(t: Copy, error: unknown): string {
  const code = error instanceof ApiError ? error.code : ''
  if (code === 'name' || code === 'taken') return t.errorName
  if (code === 'password') return t.errorPassword
  if (code === 'credentials') return t.errorCredentials
  if (code === 'slow-down' || code === 'locked' || code === 'one-a-day') return t.errorSlow
  if (code === 'code-dead' || code === 'expired') return t.errorCode
  if (code === 'stripe-test-only') return t.errorStripe
  if (code === 'mail') return t.errorMail
  if (code === 'email-used') return t.emailUsed
  if (code === 'email-holder') return t.emailNeedsHolder
  if (code === 'coins') return t.needCoins
  if (code === 'owned') return t.owned
  if (code === 'schema') return t.errorSchema
  if (code === 'supabase-key') return t.errorSupabase
  if (code === 'auth') return t.signInFriends
  if (code === 'deleted') return t.deleted
  return t.errorGeneric
}

function Field({ label, value, set, type = 'text' }: { label: string; value: string; set: (v: string) => void; type?: string }) {
  return (
    <label className="field">
      {label}
      <input value={value} type={type} onChange={(event) => set(event.target.value)} autoComplete={type === 'password' ? 'current-password' : 'username'} />
    </label>
  )
}

function WeekGoal({ t, wins }: { t: Copy; wins: number }) {
  const shown = Math.max(0, wins)
  const filled = Math.min(100, (shown / WEEK_WIN_BONUS_AT) * 100)
  return (
    <>
      <p className="muted">{t.winsThisWeek}</p>
      <span>{shown} / {WEEK_WIN_BONUS_AT}</span>
      <span className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={WEEK_WIN_BONUS_AT} aria-valuenow={Math.min(shown, WEEK_WIN_BONUS_AT)} aria-label={t.winsThisWeek}>
        <span style={{ width: `${filled}%` }} />
      </span>
    </>
  )
}

async function shareHome(title: string) {
  const url = `${location.origin}/`
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch {
      return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    /* The share sheet is the destination. Copy is the PC fallback. */
  }
}

function guestBoard(): { streak: number; bestRun: number } {
  try {
    const raw = JSON.parse(localStorage.getItem('rg.guest') || '') as { streak?: number; bestRun?: Record<string, number> }
    const runs = raw.bestRun ? Object.values(raw.bestRun) : []
    const best = runs.reduce((top, n) => Math.max(top, Number(n) || 0), 0)
    return { streak: Number(raw.streak) || 0, bestRun: best }
  } catch {
    return { streak: 0, bestRun: 0 }
  }
}

function nextDailyLeft(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const left = (23 - read('hour')) * 3600 + (59 - read('minute')) * 60 + (60 - read('second'))
  const safe = Math.max(0, left)
  return `${Math.floor(safe / 3600)}h ${Math.floor((safe % 3600) / 60)}m`
}

function StreakPips({ streak }: { streak: number }) {
  const filled = Math.min(7, Math.max(0, streak))
  return (
    <span className="pips" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => <span key={i} className={i < filled ? 'on' : ''} />)}
    </span>
  )
}

function AccountMenu({ t, me }: { t: Copy; me: Me }) {
  return (
    <div className="card stack pop" onClick={(event) => event.stopPropagation()}>
      <button className="btn" type="button" onClick={() => go('/settings')}>{t.settings}</button>
      {me.holder ? <button className="btn" type="button" onClick={() => go('/family')}>{t.family}</button> : null}
      <button className="btn" type="button" onClick={() => go('/leaderboard')}>{t.openLeaderboard}</button>
      <button className="btn" type="button" onClick={() => go('/teams')}>{t.myTeam}</button>
      <button className="btn" type="button" onClick={() => void api('/api/signout', {}).then(() => location.assign('/'))}>{t.signOutDevice}</button>
    </div>
  )
}

export function HomeScreen({ t, me, pc }: Bag) {
  const [open, setOpen] = useState(false)
  const guest = guestBoard()
  const streak = me?.streak ?? guest.streak
  const bestRun = me ? Object.values(me.bestRun ?? {}).reduce((top, n) => Math.max(top, Number(n) || 0), 0) : guest.bestRun
  const hostName = PETS.find((pet) => pet.id === me?.hostPet)?.name ?? DEFENDERS.find((defender) => defender.id === me?.hostPet)?.name ?? t.noHost
  const [rows, setRows] = useState<{ name: string; score: number; hostPet?: string | null }[]>([])
  const [boardNote, setBoardNote] = useState('')
  const [team, setTeam] = useState<{ name?: string; mascot?: string; score?: number } | null>(null)
  useEffect(() => {
    if (!pc) return
    void api<{ rows: { name: string; score: number; hostPet?: string | null }[] }>('/api/leaderboard?scope=today').then((res) => {
      setRows((res.rows ?? []).slice(0, 8))
    }).catch((err) => setBoardNote(errText(t, err)))
    void api<{ team: { name?: string; mascot?: string; score?: number } | null }>('/api/team').then((res) => {
      setTeam(res.team)
    }).catch(() => setTeam(null))
  }, [pc, t])

  const tabs = (
    <div className="tabs">
      <button className="tab on" type="button" onClick={() => go('/play')}>{t.play}</button>
      <button className="tab" type="button" onClick={() => go('/stable')}>{t.stable}</button>
      <button className="tab" type="button" onClick={() => void shareHome(t.brand)}>{t.share}</button>
      <button className="tab" type="button" onClick={() => go(me ? '/settings' : '/join')}>{t.save}</button>
    </div>
  )
  const hero = (
    <>
      <span className="eyebrow">{t.logic}</span>
      <p className="home-mark">{t.brand}</p>
      <div className="home-hero">
        <button className="btn gold home-play" type="button" onClick={() => go('/play')}>{t.play}</button>
        <button className="throne-tile" type="button" onClick={() => go('/thrones')}><img src="/images/cinematic/bg-throne.webp" alt={t.throne} /></button>
      </div>
    </>
  )
  const legal = (
    <div className="home-legal">
      <button className="legal-link" type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
      <LegalLinks t={t} />
      <span className="build">{t.build} {BUILD_NUMBER}</span>
    </div>
  )

  if (!pc) {
    return (
      <div className="body home-phone">
        {tabs}
        {me ? (
          <div className="home-name">
            <button className="name-chip" type="button" onClick={() => go('/progress')}>{me.playerName}</button>
          </div>
        ) : null}
        {hero}
        {me ? (
          <>
            <button className="chip" type="button" onClick={() => go('/leaderboard')}>{t.solo}</button>
            <button className="card stack home-goal" type="button" onClick={() => go('/shop')}>
              <span className="spread"><b>{t.goal}</b><span>{t.shop}</span></span>
              <WeekGoal t={t} wins={me.weekWins ?? 0} />
            </button>
            <button className="card stack home-daily" type="button" onClick={() => go('/play')}>
              <b>{t.daily}</b>
              <span>{t.streak} {streak}</span>
              <StreakPips streak={streak} />
            </button>
          </>
        ) : (
          <div className="card stack progress-door" onClick={() => go('/progress')}>
            <p className="guest-prompt">{t.guestLine}</p>
            <button className="btn gold" type="button" onClick={(event) => { event.stopPropagation(); go('/settings') }}>{t.guestSave}</button>
            <p className="home-signin"><span className="muted">{t.already}</span> <button className="legal-link" type="button" onClick={(event) => { event.stopPropagation(); go('/signin') }}>{t.signIn}</button></p>
          </div>
        )}
        {legal}
      </div>
    )
  }

  return (
    <div className="pc-body home-pc">
      <div className="home-col">
        {hero}
        <b className="eyebrow">{t.pickMode}</b>
        <div className="home-mode-row">
          <button className="card stack" type="button" onClick={() => go('/play')}><b>{t.daily}</b></button>
          <button className="card stack" type="button" onClick={() => go('/play')}><b>{t.freePlay}</b><span className="muted">6×6 · {t.medium}</span></button>
          <button className="card stack" type="button" onClick={() => go('/play')}><b>{t.survival}</b><span className="muted">{t.bestRun} {bestRun}</span></button>
        </div>
        <div className="card stack home-you progress-door" onClick={() => go('/progress')}>
          <div className="home-name">
            {me ? <button className="name-chip" type="button" onClick={(event) => { event.stopPropagation(); setOpen((v) => !v) }}>{me.playerName}</button> : <b>{t.solo}</b>}
            {open && me ? <AccountMenu t={t} me={me} /> : null}
          </div>
          <span className="row">{me?.hostPet ? <DefenderArt id={me.hostPet} size={48} /> : null}<span>{t.host} · {hostName}</span></span>
          <div className="row">
            <button className="btn" type="button" onClick={(event) => { event.stopPropagation(); go('/stable') }}>{t.stable}</button>
            <button className="btn gold" type="button" onClick={(event) => { event.stopPropagation(); go('/shop') }}>{t.shop}</button>
          </div>
          {!me ? <p className="guest-prompt">{t.guestLine}</p> : null}
        </div>
        {legal}
      </div>
      <div className="home-col">
        <div className="card stack home-daily">
          <b>{t.daily}</b>
          <span>{t.streak} {streak}</span>
          <StreakPips streak={streak} />
          <span className="muted">{t.nextDaily} {nextDailyLeft()}</span>
        </div>
        <button className="card stack home-goal" type="button" onClick={() => go('/shop')}>
          <span className="spread"><b>{t.goal}</b><span>{t.shop}</span></span>
          <WeekGoal t={t} wins={me?.weekWins ?? 0} />
        </button>
        <div className="card stack">
          <b>{t.myTeam}</b>
          {team?.name ? (
            <span className="row"><DefenderArt id={team.mascot} size={40} /><span>{team.name}{typeof team.score === 'number' ? ` · ${team.score}` : ''}</span></span>
          ) : <p className="muted">{me ? t.openTeams : t.guestLine}</p>}
          <button className="btn" type="button" onClick={() => go('/teams')}>{team?.name ? t.myTeam : t.openTeams}</button>
        </div>
      </div>
      <div className="home-col">
        <div className="card stack home-board">
          <span className="spread"><b>{t.today}</b><span className="muted">{t.leaderboard}</span></span>
          <div className="scroll stack">
            {rows.length === 0 ? <p className="muted">{boardNote || t.noRank}</p> : rows.map((row, index) => (
              <span key={`${row.name}-${index}`} className="spread"><span className="row"><DefenderArt id={row.hostPet} size={28} />{index + 1}. {row.name}</span><span>{row.score}</span></span>
            ))}
          </div>
          <button className="btn" type="button" onClick={() => go('/leaderboard')}>{t.fullLeaderboard}</button>
        </div>
      </div>
    </div>
  )
}

export function AuthScreen({ t, pc, onMe, path }: Bag) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [recovery, setRecovery] = useState<string | null>(null)
  const [publicName, setPublicName] = useState('')
  const [names, setNames] = useState<string[]>([])
  const route = path.split('?')[0]
  const mode = route.startsWith('/reset/') ? 'reset' : route.replace('/', '') || 'join'
  const token = route.startsWith('/reset/') ? decodeURIComponent(route.split('/')[2] || '') : ''
  const next = sameSiteNext(new URLSearchParams(path.split('?')[1] ?? '').get('next'))
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ''

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    setError('')
    try {
      if (mode === 'join') {
        const res = await api<{ me: Me; recoveryCode: string | null; mailSent?: boolean }>('/api/join', { login, password, agree: true })
        onMe(res.me)
        setPublicName(res.me.playerName)
        if (res.recoveryCode) setRecovery(res.recoveryCode)
        else if (res.mailSent === false) setError(t.errorMail)
        else go(next || '/')
      } else if (mode === 'signin') {
        const res = await api<{ me: Me }>('/api/signin', { login, password })
        onMe(res.me)
        go(next || '/')
      } else if (mode === 'forgot') {
        const res = await api<{ sent: boolean; reason?: string }>('/api/recover/email', { login })
        setNote(res.reason === 'no-email' ? t.noEmail : t.linkSent)
      } else if (mode === 'code') {
        const res = await api<{ token: string }>('/api/recover/code', { login, code })
        go(`/reset/${res.token}`)
      } else if (mode === 'reset') {
        if (password !== again) return setError(t.errorPassword)
        const res = await api<{ me: Me; names: string[]; recoveryCode: string | null }>('/api/reset', { token, password })
        onMe(res.me)
        setNames(res.names)
        setRecovery(res.recoveryCode)
        if (!res.recoveryCode) go(next || '/')
      }
    } catch (error) {
      setError(errText(t, error))
    }
  }

  async function shareCode() {
    if (!recovery) return
    if (navigator.share) {
      try { await navigator.share({ title: t.recoveryTitle, text: recovery }); return } catch { /* dismissed */ }
    }
    await navigator.clipboard.writeText(recovery)
  }

  function downloadCode() {
    if (!recovery) return
    const blob = new Blob([`${recovery}\n`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'romans-game-recovery-code.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (recovery && mode === 'join') {
    return (
      <form className={pc ? 'pc-body' : 'body'} onSubmit={(event) => { event.preventDefault(); go(next || '/nudge') }}>
        <div className={pc ? 'pc-main stack' : 'stack'}>
          <h1>{t.recoveryTitle}</h1>
          <div className="card"><b>{recovery}</b><p className="muted">{t.publicName}: {publicName}</p><p className="muted">{t.recoveryOnce}</p></div>
          <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(recovery)}>{t.copyCode}</button>
          <button className="btn" type="button" onClick={() => void shareCode()}>{t.shareSave}</button>
          {pc ? <button className="btn" type="button" onClick={downloadCode}>{t.downloadCode}</button> : null}
          <button className="btn gold" type="submit">{t.iSaved}</button>
        </div>
      </form>
    )
  }

  return (
    <form className={pc ? 'pc-body' : 'body'} onSubmit={submit}>
      <div className={pc ? 'pc-main stack' : 'stack'}>
        <button className="logo" type="button" onClick={() => go('/')}>{t.brand}</button>
        <h1>{mode === 'signin' ? t.signIn : mode === 'forgot' ? t.forgot : mode === 'code' ? t.haveCode : mode === 'reset' ? t.newPassword : t.join}</h1>
        {mode === 'signin' ? <p className="muted">{t.welcome}</p> : null}
        {mode === 'join' ? <p className="muted">{t.freeToPlay}</p> : null}
        {mode !== 'reset' ? <Field label={t.playerOrEmail} value={login} set={setLogin} /> : null}
        {mode === 'code' ? <Field label={t.haveCode} value={code} set={setCode} /> : null}
        {mode === 'join' || mode === 'signin' || mode === 'reset' ? <Field label={t.password} value={password} set={setPassword} type="password" /> : null}
        {mode === 'join' || mode === 'reset' ? <p className="muted">{t.atLeast8}</p> : null}
        {mode === 'reset' ? <Field label={t.typeAgain} value={again} set={setAgain} type="password" /> : null}
        {names.length ? <p className="muted">{t.namesOnAccount}: {names.join(', ')}</p> : null}
        {note ? <p className="muted">{note}</p> : null}
        {error ? <p className="err">{error}</p> : null}
        {mode === 'join' ? <button className="btn gold" type="submit">{t.joinPlay}</button> : null}
        {mode === 'signin' ? <button className="btn gold" type="submit">{t.signIn}</button> : null}
        {mode === 'forgot' ? <button className="btn gold" type="submit">{t.sendReset}</button> : null}
        {mode === 'code' ? <button className="btn gold" type="submit">{t.continue}</button> : null}
        {mode === 'reset' ? <button className="btn gold" type="submit">{t.savePassword}</button> : null}
        {mode === 'join' ? <p className="muted">{t.agree} <button type="button" onClick={() => go('/legal/terms')}>{t.terms}</button> · <button type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button></p> : null}
        <div className="links">
          <button type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
          <span>·</span>
          <button type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
        </div>
        {mode === 'signin' || mode === 'forgot' || mode === 'join' ? (
          <div className="row auth-links">
            {mode === 'signin' ? <button className="btn" type="button" onClick={() => go('/forgot')}>{t.forgot}</button> : null}
            {mode === 'forgot' ? <button className="btn" type="button" onClick={() => go('/code')}>{t.haveCode}</button> : null}
            {mode === 'join' ? <button className="btn" type="button" onClick={() => go(`/signin${nextQuery}`)}>{t.already} {t.signIn}</button> : null}
            {mode === 'signin' ? <button className="btn" type="button" onClick={() => go(`/join${nextQuery}`)}>{t.newHere} {t.join}</button> : null}
          </div>
        ) : null}
        <span className="build">{t.build} {BUILD_NUMBER}</span>
      </div>
    </form>
  )
}

export function NudgeScreen({ t, me }: Bag) {
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const blocked = me?.ageGate === 'under' && !me.holderId
  if (blocked) {
    return (
      <div className="body stack">
        <h1>{t.nudgeTitle}</h1>
        <p className="muted">{t.emailNeedsHolder}</p>
        <button className="btn" type="button" onClick={() => go('/')}>{t.maybeLater}</button>
      </div>
    )
  }
  return (
    <form className="body stack" onSubmit={(event) => {
      event.preventDefault()
      void api('/api/email/add', { email, password: '' }).then(() => setNote(t.verifySent)).catch((err) => setNote(errText(t, err)))
    }}>
      <h1>{t.nudgeTitle}</h1>
      <p className="muted">{t.nudgeBody}</p>
      <Field label={t.yourEmail} value={email} set={setEmail} />
      {note ? <p className="muted">{note}</p> : null}
      <button className="btn gold" type="submit">{t.addEmail}</button>
      <button className="btn" type="button" onClick={() => go('/')}>{t.maybeLater}</button>
    </form>
  )
}

export function ShopScreen({ t, lang, me, onMe, path, pc }: Bag) {
  const [tab, setTab] = useState<'charges' | 'defenders' | 'clothing' | 'packs'>('charges')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [holder, setHolder] = useState('')
  const [error, setError] = useState('')
  const [prices, setPrices] = useState(priceForCountry(null))
  const [orderId, setOrderId] = useState<string | null>(sessionStorage.getItem('rg.order'))
  const [sku, setSku] = useState<Sku>(isSku(sessionStorage.getItem('rg.sku')) ? sessionStorage.getItem('rg.sku') as Sku : 'starter')
  const failed = path.includes('failed=1')
  const step = path.startsWith('/shop/') ? path.split('/')[2]?.split('?')[0] : 'browse'

  useEffect(() => {
    void api<typeof prices>('/api/prices').then(setPrices).catch(() => undefined)
  }, [])

  async function buyCoins(kind: 'charge' | 'defender' | 'cloth', id: string) {
    if (!me) {
      setError(t.guestLine)
      return
    }
    setError('')
    try {
      const res = await api<{ me: Me }>('/api/shop/buy', { kind, id })
      onMe(res.me)
    } catch (err) {
      setError(errText(t, err))
    }
  }

  async function begin(next: Sku) {
    if (!me) {
      setError(t.guestLine)
      return
    }
    setSku(next)
    sessionStorage.setItem('rg.sku', next)
    if (me.buyingStopped) return go('/shop/setup')
    if (!me.ageGate) return go('/shop/birthday')
    if (me.ageGate === 'under') return go('/shop/ask')
    if (!me.emailVerified) return go('/shop/email')
    await review(next)
  }

  async function review(next = sku) {
    try {
      const res = await api<{ orderId: string }>('/api/shop/accept', { sku: next })
      sessionStorage.setItem('rg.order', res.orderId)
      setOrderId(res.orderId)
      go('/shop/review')
    } catch (error) {
      const code = error instanceof ApiError ? error.code : ''
      if (code === 'birthday') go('/shop/birthday')
      else if (code === 'ask-holder') go('/shop/ask')
      else if (code === 'email') go('/shop/email')
      else setError(errText(t, error))
    }
  }

  const cents = centsForSku(sku, prices)
  const price = cents == null ? '' : formatPrice(cents, prices.symbol, lang)
  const offerName = packName(t, sku)
  const offerLine = sku === 'starter'
    ? `${formatCoins(STARTER_COINS, lang)} ${t.coins} · ${t.bonusIcons}`
    : `${formatCoins(PACKS.find((pack) => pack.sku === sku)?.coins ?? 0, lang)} ${t.coins}`
  const wrap = (node: ReactNode) => <div className={pc ? 'pc-sheet shop-scroll' : 'body stack shop-scroll'}>{node}</div>

  if (step === 'birthday') {
    return wrap(
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        void api<{ ageGate: string }>('/api/shop/birthday', { year: Number(year), month: Number(month), day: Number(day) }).then(async (res) => {
          const meRes = await api<{ me: Me }>('/api/me')
          onMe(meRes.me)
          if (res.ageGate === 'under') go('/shop/ask')
          else if (!meRes.me?.emailVerified) go('/shop/email')
          else await review(sku)
        }).catch((error) => setError(errText(t, error)))
      }}>
        <h1>{t.birthdayTitle}</h1>
        <p className="muted">{t.birthdayWhy}</p>
        <div className="grid2">
          <Field label={t.day} value={day} set={setDay} />
          <Field label={t.month} value={month} set={setMonth} />
        </div>
        <Field label={t.year} value={year} set={setYear} />
        <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn gold" type="submit">{t.continue}</button>
      </form>,
    )
  }
  if (step === 'ask' || step === 'setup') {
    return wrap(
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        void api('/api/family/ask', { email: holder }).then(() => go('/shop/waiting')).catch((error) => setError(errText(t, error)))
      }}>
        <h1>{step === 'setup' ? t.setupAgain : t.askHolder}</h1>
        <p className="muted">{step === 'setup' ? t.setupBody : t.youKeep}</p>
        {step === 'setup' ? <Field label={t.password} value={password} set={setPassword} type="password" /> : null}
        <Field label={t.holderEmail} value={holder} set={setHolder} />
        <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn gold" type="submit">{step === 'setup' ? t.sendLink : t.sendHolder}</button>
        <button className="btn" type="button" onClick={() => go('/play')}>{t.keepPlaying}</button>
      </form>,
    )
  }
  if (step === 'email') {
    return wrap(
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        void api('/api/email/add', { email, password }).then(() => setError(t.verifySent)).catch((err) => setError(errText(t, err)))
      }}>
        <h1>{t.addEmail}</h1>
        <Field label={t.yourEmail} value={email} set={setEmail} />
        <Field label={t.password} value={password} set={setPassword} type="password" />
        <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn gold" type="submit">{t.sendLink}</button>
      </form>,
    )
  }
  if (step === 'review') {
    return wrap(
      <div className="stack">
        <h1>{t.reviewTitle}</h1>
        {failed ? <p className="err">{t.paymentFailed}</p> : null}
        <div className="card">
          <b>{offerName}</b>
          <p>{offerLine}</p>
          <p>{price}</p>
          <p className="muted">{t.seller}: {SELLER} · {SUPPORT_EMAIL}</p>
          <p className="muted">{t.payWith}</p>
          <p className="muted">{t.refunds}</p>
          <p className="muted">{t.noticePay}</p>
        </div>
        <div className="links">
          <button type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
          <button type="button" onClick={() => go('/legal/purchases')}>{t.purchases}</button>
          <button type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
        </div>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn gold" type="button" onClick={() => go('/shop/password')}>{t.accept}</button>
        <button className="btn" type="button" onClick={() => go('/shop')}>{t.decline}</button>
      </div>,
    )
  }
  if (step === 'password') {
    return wrap(
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        void api<{ url: string }>('/api/shop/checkout', { orderId, password }).then((res) => {
          if (res.url) location.href = res.url
        }).catch((error) => setError(errText(t, error)))
      }}>
        <h1>{t.password}</h1>
        <p className="muted">{t.passwordEvery}</p>
        <Field label={t.password} value={password} set={setPassword} type="password" />
        {error ? <p className="err">{error}</p> : null}
        <button className="btn gold" type="submit">{t.continuePay}</button>
        <button className="btn" type="button" onClick={() => go('/forgot')}>{t.forgot}</button>
      </form>,
    )
  }
  if (step === 'done') {
    const sessionId = new URLSearchParams(location.search).get('session_id')
    return wrap(
      <Done t={t} lang={lang} sessionId={sessionId} onMe={onMe} />,
    )
  }
  if (step === 'waiting') return wrap(<div className="stack"><h1>{t.waiting}</h1><button className="btn" type="button" onClick={() => go('/play')}>{t.keepPlaying}</button></div>)

  const showStarter = !me?.starterOwned
  if (pc) {
    return wrap(
      <div className="stack shop-fit">
        <div className="spread"><button className="logo" type="button" onClick={() => go('/')}>{t.brand}</button><span className="coin">{formatCoins(me?.coins ?? 0, lang)} ¢</span></div>
        {error ? <p className={error === t.guestLine ? 'guest-prompt' : 'err'}>{error}</p> : null}
        <div className="pc-shop-all">
          <div className="shop-cards five">
            {DEFENDERS.map((item) => (
              <div key={item.id} className="card pic-card stack">
                <DefenderArt id={item.id} size={64} />
                <b>{item.name}</b>
                <p className="muted">{CHARGE_LABEL[item.ability][lang]}</p>
                <p>{formatCoins(CHARGE_COST, lang)} {t.coins}</p>
                <button className="btn gold" type="button" onClick={() => void buyCoins('charge', item.id)}>{t.buy}</button>
              </div>
            ))}
          </div>
          {true ? (
            <div className="shop-cards five">
              {DEFENDERS.map((defender) => {
                const owned = me?.pets.includes(defender.id)
                return (
                  <div key={defender.id} className="card pic-card stack">
                    <DefenderArt id={defender.id} size={64} />
                    <b>{defender.name}</b>
                    <p className="muted">{CHARGE_LABEL[defender.ability][lang]}</p>
                    <p>{owned ? t.owned : `${formatCoins(DEFENDER_PRICE[defender.id], lang)} ${t.coins}`}</p>
                    {owned ? null : <button className="btn gold" type="button" onClick={() => void buyCoins('defender', defender.id)}>{t.buy}</button>}
                  </div>
                )
              })}
            </div>
          ) : null}
          {true ? (
            <div className="shop-cards six">
              {CLOTHES.map((piece) => {
                const owned = me?.clothes.includes(piece.id)
                const detail = piece.earn === 'throne' ? t.laurelEarn : piece.earn === 'streak' ? t.crownEarn : t.oneWearer
                const priceLine = owned ? t.owned : piece.price == null ? '' : `${formatCoins(piece.price, lang)} ${t.coins}`
                return (
                  <div key={piece.id} className="card pic-card stack">
                    <DefenderArt id={piece.id} size={56} />
                    <b>{piece.name}</b>
                    <p className="muted">{detail}</p>
                    {priceLine ? <p>{priceLine}</p> : null}
                    {piece.price == null || owned ? null : <button className="btn gold" type="button" onClick={() => void buyCoins('cloth', piece.id)}>{t.buy}</button>}
                  </div>
                )
              })}
            </div>
          ) : null}
          {true ? (
            <div className={showStarter ? 'shop-cards four' : 'shop-cards three'}>
              {showStarter ? (
                <button className="starter pic-card stack" type="button" onClick={() => void begin('starter')}>
                  <span className="tag">{t.bonus}</span>
                  <span className="row"><DefenderArt id="night-owl" size={120} /><DefenderArt id="top-hat" size={120} /></span>
                  <b>{t.starter}</b>
                  <p className="muted">{t.oneTime}</p>
                  <p>{t.bonusIcons}</p>
                  <p>{formatPrice(prices.starterCents, prices.symbol, lang)}</p>
                </button>
              ) : null}
              {PACKS.map((pack) => {
                const packCents = centsForSku(pack.sku, prices)
                const tag = pack.tag === 'bonus7' ? t.bonus7 : pack.tag === 'bonus15' ? t.bonus15 : null
                const body = (
                  <>
                    {tag ? <span className="tag">{tag}</span> : null}
                    <b>{packName(t, pack.sku)}</b>
                    <p className="muted">{formatCoins(pack.coins, lang)} {t.coins}</p>
                    {packCents == null ? null : <p>{formatPrice(packCents, prices.symbol, lang)}</p>}
                  </>
                )
                if (packCents == null) return <div key={pack.sku} className="card pic-card stack">{body}</div>
                return (
                  <button key={pack.sku} className="card pic-card stack" type="button" onClick={() => void begin(pack.sku)}>{body}</button>
                )
              })}
            </div>
          ) : null}
        </div>
        <div className="spread">
          <span className="row"><button className="btn" type="button" disabled>{t.buyFree}</button><button className="btn" type="button" onClick={() => go('/shop')}>{t.notNow}</button></span>
          <p className="muted">{t.shopTabsNote}</p>
        </div>
      </div>,
    )
  }
  return wrap(
    <div className="stack">
      <div className="spread"><button className="logo" type="button" onClick={() => go('/')}>{t.brand}</button><span className="coin">{formatCoins(me?.coins ?? 0, lang)} ¢</span></div>
      {pc ? null : (
        <div className="tabs">
          {(['charges', 'defenders', 'clothing'] as const).map((item) => (
            <button key={item} className={`tab ${tab === item ? 'on' : ''}`} type="button" onClick={() => setTab(item)}>{t[item]}</button>
          ))}
        </div>
      )}
      {error ? <p className={error === t.guestLine ? 'guest-prompt' : 'err'}>{error}</p> : null}
      {showStarter ? (
        <button className="starter" type="button" onClick={() => void begin('starter')}>
          <span className="tag">{t.bonus}</span>
          <span className="spread"><DefenderArt id="night-owl" size={56} /><DefenderArt id="top-hat" size={56} /></span>
          <b>{t.starter}</b>
          <p className="muted">{t.oneTime}</p>
          <p>{t.bonusIcons}</p>
          <p>{formatPrice(prices.starterCents, prices.symbol, lang)}</p>
        </button>
      ) : null}
      {pc || tab === 'charges' ? (
        <div className="stack">
          {DEFENDERS.map((item) => (
            <div key={item.id} className="card stack">
              <div className="spread"><DefenderArt id={item.id} size={48} /><span>{item.name}</span><span>{formatCoins(CHARGE_COST, lang)} {t.coins}</span></div>
              <button className="btn" type="button" onClick={() => void buyCoins('charge', item.id)}>{t.buy}</button>
            </div>
          ))}
        </div>
      ) : null}
      {pc || tab === 'defenders' ? DEFENDERS.map((defender) => {
        const owned = me?.pets.includes(defender.id)
        return (
          <div key={defender.id} className="card stack">
            <div className="spread"><DefenderArt id={defender.id} size={48} /><span>{defender.name}</span><span>{owned ? t.owned : `${formatCoins(DEFENDER_PRICE[defender.id], lang)} ${t.coins}`}</span></div>
            {owned ? null : <button className="btn" type="button" onClick={() => void buyCoins('defender', defender.id)}>{t.buy}</button>}
          </div>
        )
      }) : null}
      {pc || tab === 'clothing' ? CLOTHES.map((piece) => {
        const owned = me?.clothes.includes(piece.id)
        const note = piece.earn === 'throne' ? t.laurelEarn : piece.earn === 'streak' ? t.crownEarn : owned ? t.owned : `${formatCoins(piece.price ?? 0, lang)} ${t.coins}`
        return (
          <div key={piece.id} className="card stack">
            <div className="spread"><DefenderArt id={piece.id} size={48} /><span>{piece.name}</span><span>{note}</span></div>
            {piece.price == null || owned ? null : <button className="btn" type="button" onClick={() => void buyCoins('cloth', piece.id)}>{t.buy}</button>}
          </div>
        )
      }) : null}
      <p className="muted">{t.coinPacks}</p>
      {PACKS.map((pack) => {
        const packCents = centsForSku(pack.sku, prices)
        const tag = pack.tag === 'bonus7' ? t.bonus7 : pack.tag === 'bonus15' ? t.bonus15 : null
        const body = (
          <>
            {tag ? <span className="tag">{tag}</span> : null}
            <b>{packName(t, pack.sku)}</b>
            <p>{formatCoins(pack.coins, lang)} {t.coins}</p>
            {packCents == null ? null : <p>{formatPrice(packCents, prices.symbol, lang)}</p>}
          </>
        )
        if (packCents == null) return <div key={pack.sku} className="card">{body}</div>
        return (
          <button key={pack.sku} className="card" type="button" onClick={() => void begin(pack.sku)}>{body}</button>
        )
      })}
      <div className="card"><button className="btn" type="button" disabled>{t.buyFree}</button> <button className="btn" type="button" onClick={() => go('/shop')}>{t.notNow}</button></div>
      <p className="muted">{t.shopTabsNote}</p>
    </div>,
  )
}

function packName(t: Copy, sku: string): string {
  if (sku === 'pack-small') return t.packSmall
  if (sku === 'pack-medium') return t.packMedium
  if (sku === 'pack-large') return t.packLarge
  return t.starter
}

function Done({ t, lang, sessionId, onMe }: { t: Copy; lang: Lang; sessionId: string | null; onMe: (me: Me | null) => void }) {
  const [note, setNote] = useState(t.receiptWay)
  const [line, setLine] = useState('')
  useEffect(() => {
    if (!sessionId) return
    void api<{ me: Me | null; sku: string }>('/api/shop/confirm', { sessionId }).then((res) => {
      if (res.me) onMe(res.me)
      const pack = PACKS.find((item) => item.sku === res.sku)
      setNote(res.sku === 'starter' ? t.starter : pack ? packName(t, pack.sku) : t.coins)
      setLine(res.sku === 'starter'
        ? `${formatCoins(STARTER_COINS, lang)} ${t.coins} · ${t.bonusIcons}`
        : pack ? `${formatCoins(pack.coins, lang)} ${t.coins}` : '')
    }).catch(() => setNote(t.paymentFailed))
  }, [sessionId, onMe, t, lang])
  return (
    <div className="stack">
      <h1>{t.added}</h1>
      {note === t.starter ? <span className="spread"><DefenderArt id="night-owl" size={64} /><DefenderArt id="top-hat" size={64} /></span> : null}
      <p>{note}</p>
      {line ? <p className="muted">{line}</p> : null}
      <button className="btn gold" type="button" onClick={() => go('/shop')}>{t.backShop}</button>
    </div>
  )
}

export function FamilyScreen({ t, path, pc }: Bag) {
  const token = path.startsWith('/approve/') ? decodeURIComponent(path.split('/')[2] || '') : ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState('')
  const [info, setInfo] = useState<{ playerName?: string; status?: string; members?: { id: string; playerName: string; lastPlayed: string | null }[] }>({})
  useEffect(() => {
    if (token) {
      void api<{ approval: { playerName: string; status: string } }>(`/api/family?token=${encodeURIComponent(token)}`).then((res) => setInfo(res.approval)).catch(() => setError(t.errorCode))
    } else {
      void api<{ members: { id: string; playerName: string; lastPlayed: string | null }[] }>('/api/family').then(setInfo).catch(() => undefined)
    }
  }, [token, t.errorCode])

  if (token) {
    return (
      <div className="body stack">
        <h1>{t.approve}</h1>
        <p>{info.playerName}</p>
        <div className="card"><b>{t.whatWeKeep}</b><p className="muted">{t.keepBody}</p></div>
        <p className="muted">{t.ifNothing}</p>
        <div className="links">
          <button type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
          <button type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
        </div>
        {info.status === 'declined' || info.status === 'expired' ? <p>{info.status === 'declined' ? t.saidNo : t.expired}</p> : (
          <>
            <p className="muted">{t.ownAccount}</p>
            <Field label={t.optionalName} value={playerName} set={setPlayerName} />
            <Field label={t.password} value={password} set={setPassword} type="password" />
            {error ? <p className="err">{error}</p> : null}
            <button className="btn gold" type="button" onClick={() => void api('/api/family/answer', { token, answer: 'yes', password, playerName }).then(() => go('/family')).catch((err) => setError(errText(t, err)))}>{t.approve}</button>
            <button className="btn" type="button" onClick={() => void api('/api/family/answer', { token, answer: 'no' }).then(() => setInfo({ ...info, status: 'declined' }))}>{t.dontApprove}</button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="body stack scroll">
      <h1>{t.family}</h1>
      <p className="muted">{t.members}</p>
      {(info.members ?? []).map((member) => (
        <div key={member.id} className="card stack">
          <b>{member.playerName}</b>
          <p className="muted">{member.lastPlayed ?? '—'}</p>
          <div className="grid2">
            <button className="btn" type="button" onClick={() => {
              const next = prompt(t.newPassword) || ''
              if (next) void api('/api/family/member', { id: member.id, action: 'reset', password: next })
            }}>{t.resetPassword}</button>
            <button className="btn" type="button" onClick={() => void api('/api/family/member', { id: member.id, action: 'remove' }).then(() => location.reload())}>{t.remove}</button>
            <button className="btn" type="button" onClick={() => void api('/api/family/member', { id: member.id, action: 'stop' })}>{t.stopBuying}</button>
            <button className="btn" type="button" onClick={() => void api('/api/family/member', { id: member.id, action: 'signout' })}>{t.signOutDevice}</button>
          </div>
        </div>
      ))}
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        void api<{ recoveryCode: string }>('/api/family/add', { playerName, password }).then((res) => {
          setError('')
          setPlayerName('')
          setPassword('')
          setRecovery(res.recoveryCode)
        }).catch((err) => setError(errText(t, err)))
      }}>
        <b>{t.addMember}</b>
        <Field label={t.playerOrEmail} value={playerName} set={setPlayerName} />
        <Field label={t.password} value={password} set={setPassword} type="password" />
        <button className="btn gold" type="submit">{t.addMember}</button>
        {recovery ? <div className="card"><b>{t.recoveryTitle}</b><p>{recovery}</p><p className="muted">{t.recoveryOnce}</p>{pc ? <button className="btn" type="button" onClick={() => {
          const blob = new Blob([`${recovery}\n`], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'romans-game-recovery-code.txt'
          a.click()
          URL.revokeObjectURL(url)
        }}>{t.downloadCode}</button> : null}</div> : null}
      </form>
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        void api('/api/family/ask', { email }).then(() => setError(t.waiting)).catch((err) => setError(errText(t, err)))
      }}>
        <Field label={t.holderEmail} value={email} set={setEmail} />
        <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
        <button className="btn" type="submit">{t.sendHolder}</button>
      </form>
      {error ? <p className="err">{error}</p> : null}
      <button className="btn" type="button" onClick={() => go('/teams')}>{t.makeTeam}</button>
    </div>
  )
}

export function SettingsScreen({ t, me, onMe, setLang, lang, path, pc }: Bag) {
  const [email, setEmail] = useState('')
  const [nextName, setNextName] = useState(me?.playerName ?? '')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [current, setCurrent] = useState('')
  const [note, setNote] = useState('')
  const page = path.split('/')[2] || ''
  const shell = pc ? 'pc-sheet settings-sheet stack' : 'body stack scroll'
  function chooseLang(next: 'en' | 'fr') {
    setLang(next)
    if (me) void api('/api/language', { language: next })
  }
  if (page === 'language') {
    return (
      <div className={shell}>
        <h1>{t.language}</h1>
        <p className="muted">{t.languageNote}</p>
        {!me ? <p className="guest-prompt">{t.guestLine}</p> : null}
        <button className={`btn ${lang === 'en' ? 'gold' : ''}`} type="button" onClick={() => chooseLang('en')}>{t.english}</button>
        <button className={`btn ${lang === 'fr' ? 'gold' : ''}`} type="button" onClick={() => chooseLang('fr')}>{t.francais}</button>
        <button className="btn" type="button" onClick={() => go('/settings')}>{t.done}</button>
        <LegalLinks t={t} />
      </div>
    )
  }
  if (page === 'data' && !me) {
    return (
      <div className={shell}>
        <h1>{t.yourData}</h1>
        <p className="guest-prompt">{t.guestLine}</p>
        <button className="btn" type="button" onClick={() => go('/settings')}>{t.settings}</button>
        <LegalLinks t={t} />
      </div>
    )
  }
  if (page === 'data' && me) {
    return (
      <div className={shell}>
        <h1>{t.yourData}</h1>
        <Field label={t.password} value={password} set={setPassword} type="password" />
        <button className="btn" type="button" onClick={() => void api<{ file: Me }>('/api/data/download', { password }).then((res) => {
          const blob = new Blob([JSON.stringify(res.file, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'romans-game-data.json'
          a.click()
          URL.revokeObjectURL(url)
        }).catch(() => setNote(t.errorPassword))}>{t.downloadData}</button>
        <button className="btn danger" type="button" onClick={() => void api('/api/data/delete', { password }).then(() => { onMe(null); setNote(t.deleted) }).catch(() => setNote(t.errorPassword))}>{t.confirmDelete}</button>
        {note ? <p className="muted">{note}</p> : null}
        <LegalLinks t={t} />
      </div>
    )
  }
  return (
    <div className={shell}>
      <h1>{t.settings}</h1>
      {me ? <p className="muted">{me.playerName} · {me.email ?? t.addEmail}</p> : <p className="guest-prompt">{t.guestLine}</p>}
      <button className="btn" type="button" onClick={() => go('/settings/language')}>{t.language} · {lang === 'fr' ? t.francais : t.english}</button>
      {me ? <>
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        void api<{ me: Me }>('/api/name', { name: nextName, password: current }).then((res) => { onMe(res.me); setNote(t.saveName) }).catch((err) => setNote(errText(t, err)))
      }}>
        <b>{t.publicName}</b>
        <Field label={t.publicName} value={nextName} set={setNextName} />
        <Field label={t.currentPassword} value={current} set={setCurrent} type="password" />
        <button className="btn" type="submit">{t.saveName}</button>
      </form>
      {me.ageGate === 'under' && !me.holderId ? <p className="muted">{t.emailNeedsHolder}</p> : (
        <form className="card stack" onSubmit={(event) => { event.preventDefault(); void api('/api/email/add', { email, password: current }).then(() => setNote(t.verifySent)).catch((err) => setNote(errText(t, err))) }}>
          <b>{t.changeEmail}</b>
          <Field label={t.yourEmail} value={email} set={setEmail} />
          <Field label={t.currentPassword} value={current} set={setCurrent} type="password" />
          <button className="btn" type="submit">{t.sendLink}</button>
        </form>
      )}
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        void api('/api/password', { current, password, again }).then(() => setNote(t.savePassword)).catch(() => setNote(t.errorPassword))
      }}>
        <b>{t.changePassword}</b>
        <Field label={t.newPassword} value={password} set={setPassword} type="password" />
        <Field label={t.typeAgain} value={again} set={setAgain} type="password" />
        <button className="btn" type="submit">{t.savePassword}</button>
      </form>
      <button className="btn" type="button" onClick={() => go('/settings/data')}>{t.yourData}</button>
      <button className="btn" type="button" onClick={() => void api('/api/signout', {}).then(() => location.assign('/'))}>{t.signOutDevice}</button>
      <button className="btn" type="button" onClick={() => void api('/api/signout-all', {}).then(() => location.assign('/'))}>{t.signOutAll}</button>
      </> : null}
      {note ? <p className="muted">{note}</p> : null}
      <LegalLinks t={t} />
      <span className="build">{t.build} {BUILD_NUMBER}</span>
    </div>
  )
}

export function HelpScreen({ t, path, lang }: Bag) {
  const page = path.replace('/help', '').replace(/^\//, '')
  const enBody = [
    'Place one buddy in every row, every column and every colour. Buddies cannot touch, even on a corner. An X marks a square you have ruled out.',
    'Join with a player name and a password. Email is only for getting back in. The age question is saved once, later, if you buy with cash.',
    'A player can ask an account holder by email. The account holder approves, then can reset a password, remove a player, or stop buying.',
    'Free coins need no checks. Cash buying asks for a birthday once, then Review your order, your password, and Stripe.',
    'Team names come from two lists plus a number. Up to 10 players. Leader, up to two captains, then members.',
    'A challenge link opens the same board. Play free, no account needed. Sign in to save your score.',
    'Daily is one shared board. Free Play lets you pick size and difficulty. Survival Run keeps hearts from board to board.',
    'During a board you only hear The Unseen. When the board ends, he pops out with one line, then the result.',
  ]
  const frBody = [
    'Place un compagnon dans chaque rangée, chaque colonne et chaque couleur. Les compagnons ne se touchent pas, même par un coin. Un X écarte une case.',
    'Rejoins avec un nom de joueur et un mot de passe. Le courriel sert seulement à revenir. La question d’âge est gardée une fois, plus tard, si tu achètes en argent.',
    'Un joueur peut demander à un titulaire par courriel. Le titulaire approuve, puis peut réinitialiser un mot de passe, retirer un joueur ou arrêter les achats.',
    'Les pièces gratuites ne demandent rien. L’achat en argent demande une date de naissance une fois, puis Vérifie ta commande, ton mot de passe, et Stripe.',
    'Les noms d’équipe viennent de deux listes plus un numéro. Jusqu’à 10 joueurs. Meneur, deux capitaines au plus, puis membres.',
    'Un lien de défi ouvre le même plateau. Joue gratuitement, sans compte. Connecte-toi pour garder ton score.',
    'Du jour est un plateau partagé. Le jeu libre choisit la taille et la difficulté. La course survie garde les cœurs d’un plateau à l’autre.',
    'Pendant un plateau, tu entends seulement l’Invisible. À la fin, il apparaît avec une phrase, puis le résultat.',
  ]
  const labels = [t.helpHow, t.helpAccount, t.helpFamily, t.helpShop, t.helpTeams, t.helpChallenge, t.helpModes, t.helpUnseen]
  const ids = ['how', 'account', 'family', 'shop', 'teams', 'challenge', 'modes', 'unseen']
  const bodies = lang === 'fr' ? frBody : enBody
  const topics = ids.map((id, index) => [id, labels[index], bodies[index]] as const)
  if (!page) {
    return (
      <div className="body stack scroll">
        <h1>{t.helpLegal}</h1>
        {topics.map(([id, label]) => <button key={id} className="btn" type="button" onClick={() => go(`/help/${id}`)}>{label}</button>)}
        <button className="btn" type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
        <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
        <button className="btn" type="button" onClick={() => go('/legal/families')}>{t.families}</button>
        <button className="btn" type="button" onClick={() => go('/legal/purchases')}>{t.purchases}</button>
        <button className="btn" type="button" onClick={() => go('/help/contact')}>{t.contact}</button>
      </div>
    )
  }
  if (page === 'contact') return <Contact t={t} />
  const topic = topics.find(([id]) => id === page)
  return (
    <div className="body stack">
      <button className="btn" type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
      <h1>{topic?.[1]}</h1>
      <p>{topic?.[2]}</p>
    </div>
  )
}

function Contact({ t }: { t: Copy }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [about, setAbout] = useState(t.contactAbout[0])
  const [note, setNote] = useState('')
  return (
    <form className="body stack" onSubmit={(event) => {
      event.preventDefault()
      void api('/api/contact', { email, message, about }).then(() => setNote(t.reply)).catch(() => setNote(t.errorMail))
    }}>
      <h1>{t.contact}</h1>
      <p className="muted">{t.reply}</p>
      <label className="field">{t.about}<select value={about} onChange={(event) => setAbout(event.target.value)}>{t.contactAbout.map((item) => <option key={item}>{item}</option>)}</select></label>
      <Field label={t.yourEmail} value={email} set={setEmail} />
      <label className="field">{t.message}<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} /></label>
      <p className="muted">{t.officer}</p>
      {note ? <p className="muted">{note}</p> : null}
      <button className="btn gold" type="submit">{t.send}</button>
    </form>
  )
}

export function LegalScreen({ t, lang, path }: Bag) {
  const page = path.split('/')[2] || 'terms'
  const title = page === 'privacy' ? t.privacy : page === 'families' ? t.families : page === 'purchases' ? t.purchases : page === 'cookies' ? t.cookies : page === 'accessibility' ? t.access : page === 'disclosures' ? t.disclosures : t.terms
  const sections = legalSections(lang, page === 'accessibility' ? 'accessibility' : page)
  return (
    <div className={path ? 'body stack scroll legal' : 'body'}>
      <button className="btn" type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
      <h1>{title}</h1>
      <p className="muted">{t.legalUpdated}</p>
      {sections.map((section) => {
        const [heading, para] = section.split('|')
        return <p key={heading}><b>{heading}.</b> {para}</p>
      })}
      <p className="muted">{t.officer}</p>
      <button className="btn" type="button" onClick={() => go('/help/contact')}>{t.contact}</button>
    </div>
  )
}

export function TeamScreen({ t, me, path, pc }: Bag) {
  const code = path.startsWith('/t/') ? path.split('/')[2] : ''
  const [team, setTeam] = useState<{ name?: string; code?: string; mascot?: string; members?: { id: string; name: string; rank: string }[]; asks?: { id: string; name: string }[]; memberCount?: number; path?: string } | null>(null)
  const [openTeams, setOpenTeams] = useState<{ name: string; memberCount: number; code: string; full: boolean; mascot?: string }[]>([])
  const [adj, setAdj] = useState(ADJECTIVES[0])
  const [noun, setNoun] = useState(NOUNS[0])
  const [number, setNumber] = useState(12)
  const [mascot, setMascot] = useState('Leo')
  const [openJoin, setOpenJoin] = useState(true)
  const [joinCode, setJoinCode] = useState(code)
  const [error, setError] = useState('')
  useEffect(() => {
    const query = code ? `?code=${code}` : ''
    void api<{ team: typeof team; board?: { name: string; memberCount: number; code: string; full: boolean; mascot?: string }[] }>(`/api/team${query}`).then((res) => {
      setTeam(res.team)
      setOpenTeams(res.board ?? [])
    }).catch(() => undefined)
  }, [code])

  async function share() {
    if (!team?.path) return
    const url = `${location.origin}${team.path}`
    if (navigator.share) {
      try { await navigator.share({ title: team.name, url }); return } catch { /* dismissed */ }
    }
    await navigator.clipboard.writeText(url)
  }

  const createForm = (
    <form className="card stack" onSubmit={(event) => {
      event.preventDefault()
      if (!me) { setError(t.guestLine); return }
      void api('/api/team', { pick: { adjective: adj, noun, number: Number(number) }, mascot, openJoin }).then(() => location.reload()).catch((err) => setError(errText(t, err)))
    }}>
      <b>{t.makeTeam}</b>
      <p>{formatTeamName({ adjective: adj, noun, number: Number(number) })}</p>
      <label className="field">{t.teams}<select value={adj} onChange={(event) => setAdj(event.target.value as typeof adj)}>{ADJECTIVES.map((word) => <option key={word}>{word}</option>)}</select></label>
      <label className="field"> <select value={noun} onChange={(event) => setNoun(event.target.value as typeof noun)}>{NOUNS.map((word) => <option key={word}>{word}</option>)}</select></label>
      <Field label="#" value={String(number)} set={(value) => setNumber(Number(value) || 1)} />
      <label className="field">{t.defenders}<select value={mascot} onChange={(event) => setMascot(event.target.value)}>{['Leo', 'Lupa', 'Aquila', 'Nox', 'Invictus'].map((name) => <option key={name}>{name}</option>)}</select></label>
      <DefenderArt id={mascot} size={56} />
      <label className="spread"><span>{t.openJoin}</span><input type="checkbox" checked={openJoin} onChange={(event) => setOpenJoin(event.target.checked)} /></label>
      <p className="muted">{openJoin ? t.openJoin : t.inviteOnly}</p>
      <button className="btn gold" type="submit">{t.makeTeam}</button>
    </form>
  )

  return (
    <div className={pc ? 'pc-sheet shop-scroll' : 'body stack scroll shop-scroll'}>
      <h1>{t.teams}</h1>
      {team?.name ? (
        <div className={pc ? 'team-balance two' : 'card stack'}>
          <div className={pc ? 'card stack' : 'team-flat'}>
          <span className="row"><DefenderArt id={team.mascot} size={48} /><b>{team.name}</b></span>
          <p className="muted">{team.memberCount ?? 0}/10{team.code ? ` · ${team.code}` : ''}</p>
          {(team.members ?? []).map((member) => {
            const iAmLeader = (team.members ?? []).some((row) => row.id === me?.id && row.rank === 'leader')
            return (
              <div key={member.id} className="stack">
                <div className="spread"><span>{member.name}</span><span>{member.rank === 'leader' ? t.leader : member.rank === 'captain' ? t.captain : t.member}</span></div>
                {iAmLeader && member.id !== me?.id ? (
                  <div className="grid2">
                    <button className="btn" type="button" onClick={() => void api('/api/team/rank', { id: member.id, rank: member.rank === 'captain' ? 'member' : 'captain' }).then(() => location.reload())}>{member.rank === 'captain' ? t.member : t.captain}</button>
                    <button className="btn" type="button" onClick={() => void api('/api/team/rank', { id: member.id, remove: true }).then(() => location.reload()).catch((err) => setError(errText(t, err)))}>{t.remove}</button>
                  </div>
                ) : null}
              </div>
            )
          })}
          {(team.members ?? []).some((row) => row.id === me?.id && row.rank === 'leader') ? (
            <form className="stack" onSubmit={(event) => {
              event.preventDefault()
              void api('/api/team/rename', { pick: { adjective: adj, noun, number: Number(number) } }).then(() => location.reload()).catch((err) => setError(errText(t, err)))
            }}>
              <b>{t.renameTeam}</b>
              <p>{formatTeamName({ adjective: adj, noun, number: Number(number) })}</p>
              <label className="field"><select value={adj} onChange={(event) => setAdj(event.target.value as typeof adj)}>{ADJECTIVES.map((word) => <option key={word}>{word}</option>)}</select></label>
              <label className="field"><select value={noun} onChange={(event) => setNoun(event.target.value as typeof noun)}>{NOUNS.map((word) => <option key={word}>{word}</option>)}</select></label>
              <Field label="#" value={String(number)} set={(value) => setNumber(Number(value) || 1)} />
              <button className="btn" type="submit">{t.renameTeam}</button>
            </form>
          ) : null}
          <p className="muted">{t.nextInLine}: {(() => {
            const rest = (team.members ?? []).filter((row) => row.rank !== 'leader')
            const captain = rest.find((row) => row.rank === 'captain')
            return (captain ?? rest[0])?.name ?? '—'
          })()}</p>
          </div>
          <div className={pc ? 'card stack' : 'team-flat'}>
          {(team.asks ?? []).map((ask) => (
            <div key={ask.id} className="spread">
              <span>{ask.name}</span>
              <button className="btn" type="button" onClick={() => void api('/api/team/answer', { id: ask.id, accept: true }).then(() => location.reload())}>{t.accept}</button>
              <button className="btn" type="button" onClick={() => void api('/api/team/answer', { id: ask.id, accept: false }).then(() => location.reload())}>{t.decline}</button>
            </div>
          ))}
          <button className="btn" type="button" onClick={() => void share()}>{t.share}</button>
          {pc ? <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(`${location.origin}${team.path}`)}>{t.copyLink}</button> : null}
          <p className="muted">{t.passNote}</p>
          <button className="btn danger" type="button" onClick={() => void api('/api/team/leave', {}).then(() => go('/teams'))}>{t.leaveCrown}</button>
          </div>
        </div>
      ) : pc ? (
        <>
          {!me ? <p className="guest-prompt">{t.guestLine}</p> : null}
          <div className="team-balance">
            <form className="card pic-card stack" onSubmit={(event) => {
              event.preventDefault()
              if (!me) { setError(t.guestLine); return }
              void api('/api/team', { pick: { adjective: adj, noun, number: Number(number) }, mascot, openJoin }).then(() => location.reload()).catch((err) => setError(errText(t, err)))
            }}>
              <DefenderArt id={mascot} size={120} />
              <b>{formatTeamName({ adjective: adj, noun, number: Number(number) })}</b>
              <p className="muted">{openJoin ? t.openJoin : t.inviteOnly}</p>
              <label className="field">{t.teams}<select value={adj} onChange={(event) => setAdj(event.target.value as typeof adj)}>{ADJECTIVES.map((word) => <option key={word}>{word}</option>)}</select></label>
              <label className="field"><select value={noun} onChange={(event) => setNoun(event.target.value as typeof noun)}>{NOUNS.map((word) => <option key={word}>{word}</option>)}</select></label>
              <Field label="#" value={String(number)} set={(value) => setNumber(Number(value) || 1)} />
              <label className="field">{t.defenders}<select value={mascot} onChange={(event) => setMascot(event.target.value)}>{['Leo', 'Lupa', 'Aquila', 'Nox', 'Invictus'].map((name) => <option key={name}>{name}</option>)}</select></label>
              <button className="btn gold" type="submit">{t.makeTeam}</button>
            </form>
            <form className="card stack" onSubmit={(event) => { event.preventDefault(); go(`/t/${joinCode}`) }}>
              <b>{t.joinTeam}</b>
              <Field label={t.code} value={joinCode} set={setJoinCode} />
              <button className="btn" type="submit">{t.joinTeam}</button>
            </form>
            <div className="card stack">
              <b>{t.teams}</b>
              <p className="muted">{t.roster}</p>
              <p className="muted">{t.passNote}</p>
              {openTeams.length === 0 ? <p className="muted">{t.openTeams}</p> : openTeams.map((row) => (
                <div key={row.code} className="stack">
                  <span className="row"><DefenderArt id={row.mascot ?? 'leo'} size={48} /><b>{row.name}</b></span>
                  <span className="muted">{row.memberCount}/10</span>
                  {row.full ? <span>{t.full}</span> : <button className="btn" type="button" onClick={() => go(`/t/${row.code}`)}>{t.joinTeam}</button>}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {!me ? <p className="guest-prompt">{t.guestLine}</p> : null}
          {createForm}
          <form className="stack" onSubmit={(event) => { event.preventDefault(); go(`/t/${joinCode}`) }}>
            <Field label={t.code} value={joinCode} set={setJoinCode} />
            <button className="btn" type="submit">{t.joinTeam}</button>
          </form>
          {openTeams.length > 0 ? (
            <div className="card stack">
              <b>{t.openTeams}</b>
              {openTeams.map((row) => (
                <div key={row.code} className="spread">
                  <span className="row"><DefenderArt id={row.mascot ?? 'leo'} size={32} />{row.name}</span>
                  <span>{row.memberCount}/10</span>
                  {row.full ? <span>{t.full}</span> : <button className="btn" type="button" onClick={() => go(`/t/${row.code}`)}>{t.joinTeam}</button>}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
      {code && team && !team.members ? (
        <button className="btn gold" type="button" onClick={() => {
          if (!me) { setError(t.guestLine); return }
          void api('/api/team/join', { code }).then(() => location.reload()).catch((err) => setError(errText(t, err)))
        }}>{t.joinTeam}</button>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      <p className="muted">{t.roster}</p>
    </div>
  )
}

export function BoardScreen({ t, me, pc }: Bag) {
  const [scope, setScope] = useState('today')
  const [runRows, setRunRows] = useState<{ id?: string; name: string; score: number; throne: number; hostPet?: string | null }[]>([])
  const [rows, setRows] = useState<{ id?: string; name: string; score: number; throne: number; hostPet?: string | null }[]>([])
  const [incoming, setIncoming] = useState<{ id: string; name: string }[]>([])
  const [outgoing, setOutgoing] = useState<{ id: string; name: string }[]>([])
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([])
  const [inbox, setInbox] = useState<{ id: number; from_name: string; body: string; from_id: string | null }[]>([])
  const [picked, setPicked] = useState<{ id?: string; name: string } | null>(null)
  const [note, setNote] = useState('')
  function load(next = scope) {
    void api<{ rows: typeof rows; incoming?: typeof incoming; outgoing?: typeof outgoing; friends?: typeof friends; inbox?: typeof inbox }>(`/api/leaderboard?scope=${next}`).then((res) => {
      setRows(res.rows ?? [])
      setIncoming(res.incoming ?? [])
      setOutgoing(res.outgoing ?? [])
      setFriends(res.friends ?? [])
      setInbox(res.inbox ?? [])
    }).catch((err) => setNote(errText(t, err)))
  }
  useEffect(() => { load(scope) }, [scope])
  useEffect(() => {
    void api<{ rows: typeof runRows }>(`/api/leaderboard?scope=survival`).then((res) => setRunRows(res.rows ?? [])).catch(() => undefined)
  }, [t])
  function act(action: string, id: string) {
    if (!me) { setNote(t.guestLine); return }
    void api('/api/friends', { action, id }).then(() => { setPicked(null); load() }).catch((err) => setNote(errText(t, err)))
  }
  const tabs = (
    <div className="tabs">
      {(['today', 'week', 'friends', 'survival'] as const).map((item) => (
        <button key={item} className={`tab ${scope === item ? 'on' : ''}`} type="button" onClick={() => setScope(item)}>{t[item === 'survival' ? 'survival' : item === 'friends' ? 'friends' : item]}</button>
      ))}
    </div>
  )
  const pickedCard = picked ? (
    <div className="card stack">
      <b>{picked.name}</b>
      {!me ? <p className="guest-prompt">{t.guestLine}</p> : (
        <>
          <button className="btn" type="button" onClick={() => {
            if (picked.id) act('ask', picked.id)
            else void api('/api/friends', { action: 'ask', name: picked.name }).then(() => { setPicked(null); load() }).catch((err) => setNote(errText(t, err)))
          }}>{t.addFriend}</button>
          <button className="btn" type="button" onClick={() => {
            if (!me) { setNote(t.guestLine); return }
            const body = picked.id ? { id: picked.id } : { name: picked.name }
            void api('/api/team/ask', body).then(() => setNote(t.requestSent)).catch((err) => setNote(errText(t, err)))
          }}>{t.askJoin}</button>
        </>
      )}
      <button className="btn" type="button" onClick={() => setPicked(null)}>{t.close}</button>
    </div>
  ) : null
  if (pc) {
    const mine = me ? rows.findIndex((row) => row.id === me.id || row.name === me.playerName) : -1
    const boardRows = (list: typeof rows) => list.length === 0 ? <p className="muted">{note || t.noRank}</p> : list.slice(0, 8).map((row, index) => (
      <button key={`${row.id ?? row.name}${index}`} className="spread" type="button" onClick={() => setPicked(row)}>
        <span className="row"><DefenderArt id={row.hostPet} size={28} />{index + 1}. {row.name}</span><span>{row.score}</span>
      </button>
    ))
    return (
      <div className="pc-boards">
        <div className="card stack">
          <b>{t.solo}</b>
          <div className="tabs">
            {(['today', 'week', 'friends'] as const).map((item) => (
              <button key={item} className={`tab ${scope === item ? 'on' : ''}`} type="button" onClick={() => setScope(item)}>{t[item]}</button>
            ))}
          </div>
          <div className="scroll stack">
            {scope === 'friends' ? (friends.length === 0 ? <p className="muted">{t.noRank}</p> : friends.map((person) => (
              <div key={person.id} className="spread"><span>{person.name}</span></div>
            ))) : boardRows(rows)}
          </div>
        </div>
        <div className="card stack">
          <b>{t.survival}</b>
          <div className="scroll stack">{boardRows(runRows)}</div>
        </div>
        <div className="card stack">
          <div className="spread"><b>{t.week}</b><button className="btn" type="button" onClick={() => go('/')}>{t.close}</button></div>
          <p className="muted">{t.yourRank} · {mine >= 0 ? String(mine + 1) : t.noRank}</p>
          {pickedCard}
          {note ? <p className="muted">{note}</p> : null}
        </div>
      </div>
    )
  }
  return (
    <div className="body stack">
      <div className="spread"><h1>{t.solo}</h1><button className="btn" type="button" onClick={() => go('/')}>{t.close}</button></div>
      {tabs}
      {scope === 'friends' ? (
        <div className="scroll stack">
          {!me ? <p className="guest-prompt">{t.guestLine}</p> : null}
          <h2>{t.inbox}</h2>
          {inbox.length === 0 ? <p className="muted">{t.inboxEmpty}</p> : inbox.map((item) => (
            <div key={item.id} className="card stack">
              <b>{item.from_name}</b>
              <span>{item.body}</span>
              {item.from_id ? (
                <div className="grid2">
                  <button className="btn" type="button" onClick={() => act('accept', item.from_id!)}>{t.accept}</button>
                  <button className="btn" type="button" onClick={() => { act('decline', item.from_id!); void api('/api/inbox/read', { id: item.id }) }}>{t.decline}</button>
                </div>
              ) : null}
            </div>
          ))}
          <h2>{t.pendingFriend}</h2>
          {incoming.map((person) => (
            <div key={person.id} className="spread">
              <span>{person.name}</span>
              <button className="btn" type="button" onClick={() => act('accept', person.id)}>{t.accept}</button>
              <button className="btn" type="button" onClick={() => act('decline', person.id)}>{t.decline}</button>
            </div>
          ))}
          {outgoing.map((person) => (
            <div key={person.id} className="spread">
              <span>{person.name}</span>
              <button className="btn" type="button" onClick={() => act('cancel', person.id)}>{t.cancelRequest}</button>
            </div>
          ))}
          <h2>{t.friends}</h2>
          {friends.length === 0 ? <p className="muted">{t.noRank}</p> : friends.map((person) => (
            <div key={person.id} className="spread">
              <span>{person.name}</span>
              <button className="btn" type="button" onClick={() => act('unfriend', person.id)}>{t.unfriend}</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="scroll">
          {rows.length === 0 ? <p className="muted">{t.noRank}</p> : rows.map((row, index) => (
            <button key={`${row.id ?? row.name}${index}`} className="spread" type="button" onClick={() => setPicked(row)}>
              <span className="row"><DefenderArt id={row.hostPet} size={32} />{index + 1}. {row.name}</span><span>{row.throne ? `#${row.throne}` : ''} {row.score}</span>
            </button>
          ))}
        </div>
      )}
      {pickedCard}
      {note ? <p className="muted">{note}</p> : null}
    </div>
  )
}

const THRONE_ART = [
  '/images/cinematic/bg-throne.webp',
  '/images/cinematic/throne-stone.webp',
  '/images/cinematic/throne-cedar.webp',
  '/images/cinematic/throne-river.webp',
  '/images/cinematic/throne-amber.webp',
  '/images/cinematic/throne-harbor.webp',
  '/images/cinematic/throne-iron.webp',
  '/images/cinematic/throne-silver.webp',
  '/images/cinematic/throne-lantern.webp',
  '/images/cinematic/throne-gold.webp',
  '/images/cinematic/throne-crown.webp',
  '/images/cinematic/throne-dawn.webp',
]

export function ThroneScreen({ t, lang, me, pc }: Bag) {
  const held = throneForBoards(winMap({ wins: me?.wins ?? 0, winsByBoard: me?.winsByBoard }))
  const list = Array.from({ length: 12 }, (_, index) => throneAt(index))
  const cards = list.map((throne) => (
    <div key={throne.id} className="card throne-card">
      <img src={THRONE_ART[throne.id - 1]} alt="" />
      <b>{throne.id}. {lang === 'fr' ? throne.nameFr : throne.name}</b>
      <span>{held && held.id >= throne.id ? '●' : throne.wins}</span>
    </div>
  ))
  return (
    <div className={pc ? 'pc-sheet' : 'body stack scroll'}>
      <div className="spread"><h1>{t.thrones}</h1><button className="btn" type="button" onClick={() => go('/')}>{t.home}</button></div>
      <p className="muted">{t.statusOnly}{held ? ` · ${lang === 'fr' ? held.nameFr : held.name}` : ''}</p>
      <div className="throne-grid">{cards}</div>
    </div>
  )
}

const PROGRESS_BOARDS = [
  { size: 5, difficulty: 0 },
  { size: 6, difficulty: 1 },
  { size: 7, difficulty: 2 },
] as const

const PROGRESS_DEFENDERS = ['invictus', 'nox', 'aquila', 'lupa', 'leo'] as const

function guestProgress(): { points: number; pointsByBoard: Record<string, number>; pointsToday: number; pointsWeek: number; winsByBoard: Record<string, number> } {
  const empty = { points: 0, pointsByBoard: {}, pointsToday: 0, pointsWeek: 0, winsByBoard: {} }
  try {
    const raw = JSON.parse(localStorage.getItem('rg.guest') || '') as {
      wins?: number
      winsByBoard?: Record<string, number>
      points?: number
      pointsByBoard?: Record<string, number>
      pointsToday?: number
      pointsDay?: string
      pointsWeek?: number
      pointsWeekKey?: string
    }
    if (!raw || typeof raw.wins !== 'number') return empty
    return {
      points: raw.points ?? 0,
      pointsByBoard: raw.pointsByBoard ?? {},
      pointsToday: raw.pointsDay === torontoDate() ? raw.pointsToday ?? 0 : 0,
      pointsWeek: raw.pointsWeekKey === pointsWeekKey() ? raw.pointsWeek ?? 0 : 0,
      winsByBoard: winMap(raw),
    }
  } catch {
    return empty
  }
}

function bestBoardLine(t: Copy, pointsByBoard: Record<string, number>, lang: Lang): string {
  let best = 0
  let key = ''
  for (const [board, value] of Object.entries(pointsByBoard)) {
    if (value > best) {
      best = value
      key = board
    }
  }
  if (best <= 0) return '0'
  const parsed = parseBoardKey(key)
  if (!parsed) return formatCoins(best, lang)
  const name = [t.easy, t.medium, t.hard, t.expert][parsed.difficulty] ?? ''
  return `${formatCoins(best, lang)} · ${parsed.size}×${parsed.size} ${name}`
}

export function ProgressScreen({ t, lang, me, pc }: Bag) {
  const [open, setOpen] = useState(false)
  const guest = me ? null : guestProgress()
  const points = me?.points ?? guest?.points ?? 0
  const today = me?.pointsToday ?? guest?.pointsToday ?? 0
  const week = me?.pointsWeek ?? guest?.pointsWeek ?? 0
  const byBoard = me?.pointsByBoard ?? guest?.pointsByBoard ?? {}
  const winsByBoard = winMap({ wins: me?.wins, winsByBoard: me?.winsByBoard ?? guest?.winsByBoard })
  const names = [t.easy, t.medium, t.hard, t.expert]
  const ownedPets = new Set(me?.pets ?? [])
  const ownedClothes = new Set(me?.clothes ?? [])
  return (
    <div className={pc ? 'progress-page' : 'body stack progress-page'}>
      <div className="spread">
        <h1>{t.myProgress}</h1>
        <div className="home-name">
          {me ? <button className="name-chip" type="button" onClick={() => setOpen((v) => !v)}>{me.playerName}</button> : <b>{t.solo}</b>}
          {open && me ? <AccountMenu t={t} me={me} /> : null}
        </div>
        <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
      </div>
      {me ? null : <p className="guest-prompt">{t.signInToSave}</p>}
      <div className="card progress-points">
        <span><b>{formatCoins(points, lang)}</b><small className="muted">{t.points}</small></span>
        <span><b>{formatCoins(today, lang)}</b><small className="muted">{t.today}</small></span>
        <span><b>{formatCoins(week, lang)}</b><small className="muted">{t.week}</small></span>
        <span><b>{bestBoardLine(t, byBoard, lang)}</b><small className="muted">{t.bestPerBoard}</small></span>
      </div>
      <div className="progress-boards">
        {PROGRESS_BOARDS.map((board) => {
          const key = boardKey(board.size, board.difficulty)
          const wins = winsByBoard[key] ?? 0
          const held = throneIdForBoard(wins, boardSteps(board.size, board.difficulty))
          return (
            <div key={key} className="card throne-card">
              <img src={THRONE_ART[held > 0 ? held - 1 : 0]} alt="" />
              <b>{names[board.difficulty]} {board.size}×{board.size}</b>
              <span>{t.boardsCleared} {wins}</span>
              <span>{t.points} {formatCoins(byBoard[key] ?? 0, lang)}</span>
            </div>
          )
        })}
      </div>
      <div className="progress-row progress-defenders">
        {PROGRESS_DEFENDERS.map((id) => {
          const owned = ownedPets.has(id)
          const name = DEFENDERS.find((defender) => defender.id === id)?.name ?? id
          return (
            <div key={id} className="card">
              <DefenderArt id={id} size={pc ? 64 : 44} pieces={[]} title={name} />
              <b>{name}</b>
              <span className={owned ? '' : 'muted'}>{owned ? t.owned : t.locked}</span>
            </div>
          )
        })}
      </div>
      <div className="progress-row progress-clothes">
        {CLOTHES.map((piece) => {
          const owned = ownedClothes.has(piece.id)
          return (
            <div key={piece.id} className="card">
              <ClothArt id={piece.id} size={pc ? 52 : 40} title={piece.name} />
              <b>{piece.name}</b>
              <span className={owned ? '' : 'muted'}>{owned ? t.owned : t.locked}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StableScreen({ t, me, onMe, pc }: Bag) {
  const pets = me?.pets ?? []
  const clothes = me?.clothes ?? []
  const host = PETS.find((pet) => pet.id === me?.hostPet)?.name ?? DEFENDERS.find((defender) => defender.id === me?.hostPet)?.name
  const petCards = pets.map((id) => (
    <div key={id} className={pc ? 'card pic-card stack' : 'card spread'}>
      <DefenderArt id={id} size={pc ? 96 : 48} />
      <span>{PETS.find((pet) => pet.id === id)?.name ?? DEFENDERS.find((defender) => defender.id === id)?.name ?? id}</span>
      <button className="btn" type="button" onClick={() => void api<{ me: Me }>('/api/host', { pet: id }).then((res) => onMe(res.me))}>{t.pickHost}</button>
    </div>
  ))
  const clothCards = clothes.map((id) => (
    <div key={id} className={pc ? 'card pic-card stack' : 'card spread'}>
      <DefenderArt id={id} size={pc ? 96 : 48} />
      <span>{CLOTHES.find((piece) => piece.id === id)?.name ?? (id === 'for-lupa' ? 'Top hat' : id === 'for-aquila' ? 'Sunglasses' : id === 'for-leo' ? 'Laurel' : id)}</span>
    </div>
  ))
  return (
    <div className={pc ? 'pc-sheet shop-scroll' : 'body stack shop-scroll'}>
      <h1>{t.stable}</h1>
      {pc ? (
        <div className="stable-row">
          {DEFENDERS.map((defender) => (
            <div key={defender.id} className="card pic-card stack">
              <DefenderArt id={defender.id} size={168} />
              <b>{defender.name}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="defender-row">
          {DEFENDERS.map((defender) => (
            <div key={defender.id}>
              <DefenderArt id={defender.id} size={56} />
              <div>{defender.name}</div>
            </div>
          ))}
        </div>
      )}
      <p className="muted">{t.host}: {host ?? t.noHost}</p>
      {pc && petCards.length > 0 ? <div className="pc-grid">{petCards}</div> : petCards}
      <h2>{t.dress}</h2>
      <p className="muted">{t.oneWearer}</p>
      {pc && clothCards.length > 0 ? <div className="pc-grid">{clothCards}</div> : clothCards}
      <div className={pc ? 'row' : 'stack'}>
        <button className="btn" type="button" onClick={() => go('/shop')}>{t.shop}</button>
        <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
      </div>
    </div>
  )
}

export function LaterScreen({ t }: Bag) {
  return <div className="body stack"><h1>{t.comingLater}</h1><button className="btn" type="button" onClick={() => go('/')}>{t.home}</button></div>
}

export function ChallengeScreen({ t, path, me, pc }: Bag) {
  const code = path.split('/')[2] || ''
  const [sender, setSender] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [board, setBoard] = useState<import('./game/logic').Puzzle | null>(null)
  const [cells, setCells] = useState<import('./game/logic').Cell[]>([])
  const [result, setResult] = useState('')
  const [started] = useState(() => Date.now())
  useEffect(() => {
    void api<{ challenge: { size: number; regions: number[]; senderName: string } }>(`/api/challenge/${code}`).then((res) => {
      const size = res.challenge.size
      setBoard({ id: code, size, regions: res.challenge.regions, solution: [] })
      setCells(Array.from({ length: size * size }, () => 'empty' as const))
      setSender(res.challenge.senderName)
    }).catch(() => setResult(t.errorGeneric))
  }, [code, t.errorGeneric])
  if (!board) return <div className="body"><p>{result || '…'}</p><button className="btn" type="button" onClick={() => go('/')}>{t.home}</button></div>
  return (
    <div className="body stack">
      <p>{t.guestLine}</p>
      <p className="muted">{sender}</p>
      {me ? null : <Field label={t.yourName} value={playerName} set={setPlayerName} />}
      <BoardView puzzle={board} cells={cells} onTap={(index) => {
        const next = cells.slice()
        const order = { empty: 'mark', mark: 'buddy', buddy: 'empty' } as const
        next[index] = order[next[index]]
        if (next[index] === 'mark') sfxMark()
        if (next[index] === 'buddy') {
          sfxPlace()
          sfxGiggle()
        }
        setCells(next)
        if (isSolved(board, next)) {
          const seconds = Math.max(0, Math.round((Date.now() - started) / 1000))
          void api<{ won: boolean; solved?: boolean }>(`/api/challenge/${code}`, { seconds, cells: next, name: me?.playerName || playerName }).then((res) => setResult(res.solved === false ? t.errorGeneric : res.won ? t.youBeat : t.soClose))
        }
      }} />
      {result ? <h2>{result}</h2> : null}
      {me ? null : (
        <>
          <button className="btn gold" type="button" onClick={() => go('/join')}>{t.joinOn}</button>
          <button className="btn" type="button" onClick={() => go('/signin')}>{t.alreadyPlay}</button>
        </>
      )}
      {pc ? <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(location.href)}>{t.copyLink}</button> : null}
      <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
    </div>
  )
}

export function WasntScreen({ t, path }: Bag) {
  const token = decodeURIComponent(path.split('/')[2] || '')
  const [done, setDone] = useState(false)
  return (
    <div className="body stack">
      <h1>{t.wasntMe}</h1>
      {done ? (
        <>
          <p>{t.buyingStopped}</p>
          <button className="btn" type="button" onClick={() => go('/forgot')}>{t.changePassword}</button>
          <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
        </>
      ) : (
        <button className="btn danger" type="button" onClick={() => void api('/api/wasnt-me', { token }).then(() => setDone(true)).catch(() => setDone(true))}>{t.wasntMe}</button>
      )}
    </div>
  )
}

export function VerifyScreen({ t }: Bag) {
  const token = new URLSearchParams(location.search).get('token') || ''
  const [note, setNote] = useState('…')
  useEffect(() => {
    void api('/api/email/verify', { token }).then(() => setNote(t.emailOn)).catch((err) => setNote(errText(t, err)))
  }, [token, t])
  return <div className="body stack"><h1>{t.yourEmail}</h1><p>{note}</p><button className="btn" type="button" onClick={() => go('/settings')}>{t.settings}</button></div>
}
