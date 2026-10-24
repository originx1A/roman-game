import { useEffect, useState } from 'react'
import { api, type Me } from './api'
import { BUILD_NUMBER } from './game/catalog'
import { bindButtonClicks, loadSoundPrefs } from './game/sound'
import {
  AuthScreen,
  BoardScreen,
  ChallengeScreen,
  FamilyScreen,
  HelpScreen,
  HomeScreen,
  LaterScreen,
  LegalScreen,
  NudgeScreen,
  SettingsScreen,
  ShopScreen,
  StableScreen,
  TeamScreen,
  ThroneScreen,
  VerifyScreen,
  WasntScreen,
  type Bag,
} from './flows'
import { copyFor, detectLang, type Lang } from './i18n'
import { go, usePath } from './nav'
import { PlayScreen } from './play'

export function App() {
  const full = usePath()
  const path = full.split('?')[0]
  const [lang, setLangState] = useState<Lang>(detectLang)
  const [me, setMe] = useState<Me | null>(null)
  const [pc, setPc] = useState(() => window.matchMedia('(min-width: 960px)').matches)
  const t = copyFor(lang)

  useEffect(() => {
    loadSoundPrefs()
    return bindButtonClicks()
  }, [])

  useEffect(() => {
    void api<{ me: Me | null }>('/api/me').then((res) => {
      setMe(res.me)
      if (res.me?.language) {
        setLangState(res.me.language)
        localStorage.setItem('rg.lang', res.me.language)
      }
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)')
    const on = () => setPc(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  function setLang(next: Lang) {
    setLangState(next)
    localStorage.setItem('rg.lang', next)
    document.documentElement.lang = next
  }

  const bag: Bag = { t, lang, pc, me, onMe: setMe, setLang, path: full }
  const onPlay = path === '/play'
  let page = <HomeScreen {...bag} />
  if (path === '/join' || path === '/signin' || path === '/forgot' || path === '/code' || path.startsWith('/reset/')) page = <AuthScreen {...bag} />
  else if (path === '/nudge') page = <NudgeScreen {...bag} />
  else if (path === '/play') page = <PlayScreen t={t} lang={lang} pc={pc} me={me} onMe={setMe} />
  else if (path.startsWith('/shop')) page = <ShopScreen {...bag} />
  else if (path.startsWith('/family') || path.startsWith('/approve/')) page = <FamilyScreen {...bag} />
  else if (path.startsWith('/settings')) page = <SettingsScreen {...bag} />
  else if (path.startsWith('/help')) page = <HelpScreen {...bag} />
  else if (path.startsWith('/legal/')) page = <LegalScreen {...bag} />
  else if (path.startsWith('/teams') || path.startsWith('/t/')) page = <TeamScreen {...bag} />
  else if (path === '/leaderboard') page = <BoardScreen {...bag} />
  else if (path === '/thrones') page = <ThroneScreen {...bag} />
  else if (path === '/stable') page = <StableScreen {...bag} />
  else if (path.startsWith('/later/')) page = <LaterScreen {...bag} />
  else if (path.startsWith('/c/')) page = <ChallengeScreen {...bag} />
  else if (path.startsWith('/wasnt-me/')) page = <WasntScreen {...bag} />
  else if (path === '/verify-email') page = <VerifyScreen {...bag} />

  const bar = (
    <header className={pc ? 'pc-bar' : 'top'}>
      <button className="logo" type="button" onClick={() => go('/')}>{t.brand}</button>
      {!onPlay ? <a className="site-link" href="https://romansgame.com" target="_blank" rel="noreferrer">{t.website}</a> : <span />}
      {pc ? (
        <nav className="tabs" style={{ flex: 1 }}>
          <button className="tab" type="button" onClick={() => go('/play')}>{t.play}</button>
          <button className="tab" type="button" onClick={() => go('/shop')}>{t.shop}</button>
          <button className="tab" type="button" onClick={() => go('/leaderboard')}>{t.leaderboard}</button>
          <button className="tab" type="button" onClick={() => go('/teams')}>{t.teams}</button>
          <button className="tab" type="button" onClick={() => go('/stable')}>{t.stable}</button>
          <button className="tab" type="button" onClick={() => go('/thrones')}>{t.throne}</button>
        </nav>
      ) : <span style={{ flex: 1 }} />}
      <button className="coin" type="button" onClick={() => go('/shop')}>{me?.coins ?? 0} ¢</button>
      <span className="build">{BUILD_NUMBER}</span>
    </header>
  )

  if (!pc) {
    return (
      <div className="phone-viewport">
        <PhoneStage>{bar}{page}</PhoneStage>
      </div>
    )
  }
  return (
    <div className="pc-root">
      {bar}
      {page}
    </div>
  )
}

function PhoneStage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 390, window.innerHeight / 636))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return <div className="phone-stage" style={{ transform: `scale(${scale})` }}>{children}</div>
}
