import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, type Me } from './api'
import { BoardView } from './ui/BoardView'
import { isSolved } from './game/logic'
import { isMuted, setMuted, sfxMark, sfxPlace } from './game/sound'
import { ADJECTIVES, NOUNS, formatTeamName } from './game/teamNames'
import { DEFENDERS, PETS, CLOTHES, SELLER, SUPPORT_EMAIL, STARTER_COINS, formatCoins, formatPrice, priceForCountry } from './game/catalog'
import { throneAt, throneForBoards, winMap } from './game/thrones'
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
  if (code === 'schema') return t.errorSchema
  if (code === 'supabase-key') return t.errorSupabase
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

export function HomeScreen({ t, lang, me, pc }: Bag) {
  const [open, setOpen] = useState(false)
  return (
    <div className={pc ? 'pc-body' : 'body'}>
      <div className={pc ? 'pc-main stack' : 'stack'} style={{ flex: 1 }}>
        <div className="spread">
          {me ? (
            <button className="name-chip" type="button" onClick={() => setOpen((v) => !v)}>{me.playerName}</button>
          ) : <span className="muted">{t.logic}</span>}
          <button className="coin" type="button" onClick={() => go('/shop')}>{formatCoins(me?.coins ?? 0, lang)} ¢</button>
        </div>
        {open && me ? (
          <div className="card stack">
            <button className="btn" type="button" onClick={() => go('/settings')}>{t.settings}</button>
            {me.holder ? <button className="btn" type="button" onClick={() => go('/family')}>{t.family}</button> : null}
            <button className="btn" type="button" onClick={() => go('/leaderboard')}>{t.openLeaderboard}</button>
            <button className="btn" type="button" onClick={() => go('/teams')}>{t.myTeam}</button>
            <button className="btn" type="button" onClick={() => void api('/api/signout', {}).then(() => location.assign('/'))}>{t.signOutDevice}</button>
          </div>
        ) : null}
        <div className="spread">
          <button className="btn gold" type="button" onClick={() => go('/play')} style={{ fontSize: pc ? 28 : 20, padding: pc ? '18px 36px' : '12px 18px', flex: 1 }}>{t.play}</button>
          <a href="https://romansgame.com" target="_blank" rel="noreferrer"><img className="logo-tile" src="/site-logo.png" alt={t.website} /></a>
        </div>
        <div className="grid2">
          <button className="card" type="button" onClick={() => go('/shop')} style={{ textAlign: 'left' }}>
            <b>{t.goal}</b>
            <p className="muted">{me ? t.claimed : t.play}</p>
            <span>{t.shop} ›</span>
          </button>
          <button className="card" type="button" onClick={() => go('/play')} style={{ textAlign: 'left' }}>
            <b>{t.daily}</b>
            <p className="muted">{t.streak} {me?.streak ?? 0}</p>
          </button>
        </div>
        {!pc ? (
          <div className="spread">
            <button className="chip" type="button" onClick={() => go('/leaderboard')}>{t.solo}</button>
            {!me ? <button className="btn" type="button" onClick={() => go('/signin')}>{t.signIn}</button> : null}
          </div>
        ) : null}
        <div className="tabs">
          <button className="tab on" type="button" onClick={() => go('/play')}>{t.play}</button>
          <button className="tab" type="button" onClick={() => go('/stable')}>{t.stable}</button>
          <button className="tab" type="button" onClick={() => void shareHome(t.brand)}>{t.share}</button>
          <button className="tab" type="button" onClick={() => go('/thrones')}>{t.throne}</button>
          {!me ? <button className="tab" type="button" onClick={() => go('/join')}>{t.save}</button> : null}
        </div>
        {!me ? <p className="muted">{t.guestLine}</p> : null}
        <div className="foot">
          <span className="links">
            <button className="btn" type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
            <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
            <button className="btn" type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
          </span>
          <span className="build">{t.build} {BUILD_NUMBER}</span>
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
  const mode = path.startsWith('/reset/') ? 'reset' : path.replace('/', '') || 'join'
  const token = path.startsWith('/reset/') ? decodeURIComponent(path.split('/')[2] || '') : ''

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
        else go('/')
      } else if (mode === 'signin') {
        const res = await api<{ me: Me }>('/api/signin', { login, password })
        onMe(res.me)
        go('/')
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
        if (!res.recoveryCode) go('/')
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
      <form className={pc ? 'pc-body' : 'body'} onSubmit={(event) => { event.preventDefault(); go('/nudge') }}>
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
        {mode === 'signin' ? <button type="button" onClick={() => go('/forgot')}>{t.forgot}</button> : null}
        {mode === 'forgot' ? <button type="button" onClick={() => go('/code')}>{t.haveCode}</button> : null}
        {mode === 'join' ? <button type="button" onClick={() => go('/signin')}>{t.already} {t.signIn}</button> : null}
        {mode === 'signin' ? <button type="button" onClick={() => go('/join')}>{t.newHere} {t.join}</button> : null}
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
  const [tab, setTab] = useState<'charges' | 'defenders' | 'clothing'>('charges')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [holder, setHolder] = useState('')
  const [error, setError] = useState('')
  const [prices, setPrices] = useState(priceForCountry(null))
  const [orderId, setOrderId] = useState<string | null>(sessionStorage.getItem('rg.order'))
  const [sku, setSku] = useState<'starter' | 'pack-small'>((sessionStorage.getItem('rg.sku') as 'starter' | 'pack-small') || 'starter')
  const failed = path.includes('failed=1')
  const step = path.startsWith('/shop/') ? path.split('/')[2]?.split('?')[0] : 'browse'

  useEffect(() => {
    void api<typeof prices>('/api/prices').then(setPrices).catch(() => undefined)
  }, [])

  async function begin(next: 'starter' | 'pack-small') {
    if (!me) return go('/signin')
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

  const price = sku === 'starter' ? formatPrice(prices.starterCents, prices.symbol) : formatPrice(prices.smallCents, prices.symbol)
  const wrap = (node: ReactNode) => <div className="body stack">{node}</div>

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
          <b>{sku === 'starter' ? t.starter : t.smallPack}</b>
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
      {showStarter ? (
        <button className="starter" type="button" onClick={() => void begin('starter')}>
          <span className="tag">{t.bonus}</span>
          <b>{t.starter}</b>
          <p className="muted">{t.oneTime}</p>
          <p>{t.bonusIcons}</p>
          <p>{formatPrice(prices.starterCents, prices.symbol)}</p>
        </button>
      ) : null}
      {pc || tab === 'charges' ? (
        <div className="stack">
          {DEFENDERS.slice(0, 3).map((item) => (
            <div key={item.id} className="card spread"><span>{item.name}</span><span>{t.placeholderCoins}</span></div>
          ))}
        </div>
      ) : null}
      {pc || tab === 'defenders' ? PETS.filter((pet) => !pet.free).map((pet) => (
        <div key={pet.id} className="card spread"><span>{pet.name}</span><span>{t.placeholderCoins}</span></div>
      )) : null}
      {pc || tab === 'clothing' ? CLOTHES.map((piece) => (
        <div key={piece.id} className="card spread"><span>{piece.name}</span><span>{t.placeholderCoins}</span></div>
      )) : null}
      <p className="muted">{t.coinPacks}</p>
      <div className="card">
        <b>{t.smallPack}</b>
        <p>{t.placeholderCoins}</p>
        <p>{formatPrice(prices.smallCents, prices.symbol)}</p>
      </div>
      <div className="card"><b>{t.smallPack}</b><p>{t.placeholderCoins}</p><p className="muted">{t.priceUnset}</p></div>
      <div className="card"><b>{t.smallPack}</b><p>{t.placeholderCoins}</p><p className="muted">{t.priceUnset}</p></div>
      <div className="card"><p className="muted">{t.priceUnset}</p><button className="btn" type="button" disabled>{t.buyFree}</button> <button className="btn" type="button" onClick={() => go('/shop')}>{t.notNow}</button></div>
      <p className="muted">{t.shopTabsNote}</p>
      {error ? <p className="err">{error}</p> : null}
    </div>,
  )
}

function Done({ t, lang, sessionId, onMe }: { t: Copy; lang: Lang; sessionId: string | null; onMe: (me: Me | null) => void }) {
  const [note, setNote] = useState(t.receiptWay)
  const [line, setLine] = useState('')
  useEffect(() => {
    if (!sessionId) return
    void api<{ me: Me | null; sku: string }>('/api/shop/confirm', { sessionId }).then((res) => {
      if (res.me) onMe(res.me)
      setNote(res.sku === 'starter' ? t.starter : t.smallPack)
      setLine(res.sku === 'starter' ? `${formatCoins(STARTER_COINS, lang)} ${t.coins} · ${t.bonusIcons}` : t.placeholderCoins)
    }).catch(() => setNote(t.paymentFailed))
  }, [sessionId, onMe, t, lang])
  return (
    <div className="stack">
      <h1>{t.added}</h1>
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

export function SettingsScreen({ t, me, onMe, setLang, lang, path }: Bag) {
  const [email, setEmail] = useState('')
  const [nextName, setNextName] = useState(me?.playerName ?? '')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [current, setCurrent] = useState('')
  const [note, setNote] = useState('')
  const page = path.split('/')[2] || ''
  if (!me) return <div className="body"><button className="btn gold" type="button" onClick={() => go('/signin')}>{t.signIn}</button></div>
  if (page === 'language') {
    return (
      <div className="body stack">
        <h1>{t.language}</h1>
        <p className="muted">{t.languageNote}</p>
        <button className={`btn ${lang === 'en' ? 'gold' : ''}`} type="button" onClick={() => { setLang('en'); void api('/api/language', { language: 'en' }) }}>{t.english}</button>
        <button className={`btn ${lang === 'fr' ? 'gold' : ''}`} type="button" onClick={() => { setLang('fr'); void api('/api/language', { language: 'fr' }) }}>{t.francais}</button>
        <button className="btn" type="button" onClick={() => go('/settings')}>{t.done}</button>
      </div>
    )
  }
  if (page === 'data') {
    return (
      <div className="body stack">
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
      </div>
    )
  }
  return (
    <div className="body stack scroll">
      <h1>{t.settings}</h1>
      <p className="muted">{me.playerName} · {me.email ?? t.addEmail}</p>
      <button className="btn" type="button" onClick={() => go('/settings/language')}>{t.language} · {lang === 'fr' ? t.francais : t.english}</button>
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
      <button className="btn" type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
      <button className="btn" type="button" onClick={() => go('/legal/terms')}>{t.terms}</button>
      <button className="btn" type="button" onClick={() => go('/legal/privacy')}>{t.privacy}</button>
      <label className="spread">{t.sound}<input type="checkbox" defaultChecked={!isMuted()} onChange={(event) => setMuted(!event.target.checked)} /></label>
      {note ? <p className="muted">{note}</p> : null}
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
      <button type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
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
      <button type="button" onClick={() => go('/help')}>{t.helpLegal}</button>
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
  const [team, setTeam] = useState<{ name?: string; code?: string; members?: { id: string; name: string; rank: string }[]; asks?: { id: string; name: string }[]; memberCount?: number; path?: string } | null>(null)
  const [openTeams, setOpenTeams] = useState<{ name: string; memberCount: number; code: string; full: boolean }[]>([])
  const [adj, setAdj] = useState(ADJECTIVES[0])
  const [noun, setNoun] = useState(NOUNS[0])
  const [number, setNumber] = useState(12)
  const [mascot, setMascot] = useState('Leo')
  const [openJoin, setOpenJoin] = useState(true)
  const [joinCode, setJoinCode] = useState(code)
  const [error, setError] = useState('')
  useEffect(() => {
    const query = code ? `?code=${code}` : ''
    void api<{ team: typeof team; board?: { name: string; memberCount: number; code: string; full: boolean }[] }>(`/api/team${query}`).then((res) => {
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

  return (
    <div className="body stack scroll">
      <h1>{t.teams}</h1>
      {team?.name ? (
        <div className="card stack">
          <b>{team.name}</b>
          <p className="muted">{team.memberCount ?? 0}/10{team.code ? ` · ${team.code}` : ''}</p>
          {(team.members ?? []).map((member) => {
            const iAmLeader = (team.members ?? []).some((row) => row.id === me?.id && row.rank === 'leader')
            return (
              <div key={member.id} className="stack">
                <div className="spread"><span>{member.name}</span><span>{member.rank === 'leader' ? t.leader : member.rank === 'captain' ? t.captain : t.member}</span></div>
                {iAmLeader && member.id !== me?.id ? (
                  <div className="grid2">
                    <button className="btn" type="button" onClick={() => void api('/api/team/rank', { id: member.id, rank: member.rank === 'captain' ? 'member' : 'captain' }).then(() => location.reload())}>{member.rank === 'captain' ? t.member : t.captain}</button>
                    <button className="btn" type="button" onClick={() => void api('/api/team/rank', { id: member.id, remove: true }).then(() => location.reload()).catch(() => setError(t.errorGeneric))}>{t.remove}</button>
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
      ) : (
        <>
          {!me ? <p>{t.signInFriends}</p> : null}
          <form className="card stack" onSubmit={(event) => {
            event.preventDefault()
            void api('/api/team', { pick: { adjective: adj, noun, number: Number(number) }, mascot, openJoin }).then(() => location.reload()).catch((err) => setError(errText(t, err)))
          }}>
            <b>{t.makeTeam}</b>
            <p>{formatTeamName({ adjective: adj, noun, number: Number(number) })}</p>
            <label className="field">{t.teams}<select value={adj} onChange={(event) => setAdj(event.target.value as typeof adj)}>{ADJECTIVES.map((word) => <option key={word}>{word}</option>)}</select></label>
            <label className="field"> <select value={noun} onChange={(event) => setNoun(event.target.value as typeof noun)}>{NOUNS.map((word) => <option key={word}>{word}</option>)}</select></label>
            <Field label="#" value={String(number)} set={(value) => setNumber(Number(value) || 1)} />
            <label className="field">{t.defenders}<select value={mascot} onChange={(event) => setMascot(event.target.value)}>{['Leo', 'Lupa', 'Aquila', 'Nox', 'Invictus'].map((name) => <option key={name}>{name}</option>)}</select></label>
            <label className="spread"><span>{t.openJoin}</span><input type="checkbox" checked={openJoin} onChange={(event) => setOpenJoin(event.target.checked)} /></label>
            <p className="muted">{openJoin ? t.openJoin : t.inviteOnly}</p>
            <button className="btn gold" type="submit">{t.makeTeam}</button>
          </form>
          <form className="stack" onSubmit={(event) => { event.preventDefault(); go(`/t/${joinCode}`) }}>
            <Field label={t.code} value={joinCode} set={setJoinCode} />
            <button className="btn" type="submit">{t.joinTeam}</button>
          </form>
          {openTeams.length > 0 ? (
            <div className="card stack">
              <b>{t.openTeams}</b>
              {openTeams.map((row) => (
                <div key={row.code} className="spread">
                  <span>{row.name}</span>
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
          if (!me) return go('/signin')
          void api('/api/team/join', { code }).then(() => location.reload()).catch((err) => setError(errText(t, err)))
        }}>{t.joinTeam}</button>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      <p className="muted">{t.roster}</p>
    </div>
  )
}

export function BoardScreen({ t, me }: Bag) {
  const [scope, setScope] = useState('week')
  const [rows, setRows] = useState<{ id?: string; name: string; score: number; throne: number }[]>([])
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
  function act(action: string, id: string) {
    if (!me) return go('/signin')
    void api('/api/friends', { action, id }).then(() => { setPicked(null); load() }).catch((err) => setNote(errText(t, err)))
  }
  return (
    <div className="body stack">
      <div className="spread"><h1>{t.solo}</h1><button type="button" onClick={() => go('/')}>{t.close}</button></div>
      <div className="tabs">
        {(['today', 'week', 'friends', 'survival'] as const).map((item) => (
          <button key={item} className={`tab ${scope === item ? 'on' : ''}`} type="button" onClick={() => setScope(item)}>{t[item === 'survival' ? 'survival' : item === 'friends' ? 'friends' : item]}</button>
        ))}
      </div>
      {scope === 'friends' ? (
        <div className="scroll stack">
          {!me ? <button className="btn gold" type="button" onClick={() => go('/signin')}>{t.signInFriends}</button> : null}
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
              <span>{index + 1}. {row.name}</span><span>{row.throne ? `#${row.throne}` : ''} {row.score}</span>
            </button>
          ))}
        </div>
      )}
      {picked ? (
        <div className="card stack">
          <b>{picked.name}</b>
          {!me ? <button className="btn gold" type="button" onClick={() => go('/signin')}>{t.signInFriends}</button> : (
            <>
              <button className="btn" type="button" onClick={() => {
                if (picked.id) act('ask', picked.id)
                else void api('/api/friends', { action: 'ask', name: picked.name }).then(() => { setPicked(null); load() }).catch((err) => setNote(errText(t, err)))
              }}>{t.addFriend}</button>
              <button className="btn" type="button" onClick={() => {
                if (!me) return go('/signin')
                const body = picked.id ? { id: picked.id } : { name: picked.name }
                void api('/api/team/ask', body).then(() => setNote(t.requestSent)).catch((err) => setNote(errText(t, err)))
              }}>{t.askJoin}</button>
            </>
          )}
          <button className="btn" type="button" onClick={() => setPicked(null)}>{t.close}</button>
        </div>
      ) : null}
      {note ? <p className="muted">{note}</p> : null}
    </div>
  )
}

export function ThroneScreen({ t, lang, me }: Bag) {
  const held = throneForBoards(winMap({ wins: me?.wins ?? 0, winsByBoard: me?.winsByBoard }))
  const list = Array.from({ length: 12 }, (_, index) => throneAt(index))
  return (
    <div className="body stack scroll">
      <div className="spread"><h1>{t.thrones}</h1><button type="button" onClick={() => go('/')}>{t.home}</button></div>
      <p className="muted">{t.throneRule}</p>
      <p className="muted">{t.statusOnly} {held ? (lang === 'fr' ? held.nameFr : held.name) : ''}</p>
      {list.map((throne) => (
        <div key={throne.id} className="card spread">
          <span>{throne.id}. {lang === 'fr' ? throne.nameFr : throne.name}</span>
          <span>{held && held.id >= throne.id ? '●' : throne.wins}</span>
        </div>
      ))}
      <p className="muted">{t.statusOnly}</p>
    </div>
  )
}

export function StableScreen({ t, me, onMe }: Bag) {
  const pets = me?.pets ?? []
  const clothes = me?.clothes ?? []
  const host = PETS.find((pet) => pet.id === me?.hostPet)?.name
  return (
    <div className="body stack">
      <h1>{t.stable}</h1>
      <p className="muted">{t.host}: {host ?? t.noHost}</p>
      {pets.length === 0 ? <p className="muted">{t.priceUnset}</p> : pets.map((id) => (
        <div key={id} className="card stack">
          <span>{PETS.find((pet) => pet.id === id)?.name ?? id}</span>
          <button className="btn" type="button" onClick={() => void api<{ me: Me }>('/api/host', { pet: id }).then((res) => onMe(res.me))}>{t.pickHost}</button>
        </div>
      ))}
      <h2>{t.dress}</h2>
      <p className="muted">{t.oneWearer}</p>
      {clothes.length === 0 ? <p className="muted">{t.priceUnset}</p> : clothes.map((id) => <div key={id} className="card">{CLOTHES.find((piece) => piece.id === id)?.name ?? id}</div>)}
      <button className="btn" type="button" onClick={() => go('/shop')}>{t.shop}</button>
      <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
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
        if (next[index] === 'buddy') sfxPlace()
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
