import { useEffect, useState } from 'react'
import { api, type Me } from './api'
import { BUILD_NUMBER, formatCoins } from './game/catalog'
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
import { DefenderArt } from './ui/DefenderArt'

export function App() {
  const full = usePath()
  const path = full.split('?')[0]
  const [lang, setLangState] = useState<Lang>(detectLang)
  const [me, setMe] = useState<Me | null>(null)
  const [pc, setPc] = useState(() => !isPhone())
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
    const on = () => setPc(!isPhone())
    on()
    const mq = window.matchMedia('(max-width: 959px)')
    mq.addEventListener('change', on)
    window.addEventListener('resize', on)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener('resize', on)
    }
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
          <button className={`tab ${path === '/' || path === '/play' ? 'on' : ''}`} type="button" onClick={() => go('/play')}>{t.play}</button>
          <button className={`tab ${path.startsWith('/shop') ? 'on' : ''}`} type="button" onClick={() => go('/shop')}>{t.shop}</button>
          <button className={`tab ${path === '/leaderboard' ? 'on' : ''}`} type="button" onClick={() => go('/leaderboard')}>{t.leaderboard}</button>
          <button className={`tab ${path.startsWith('/teams') || path.startsWith('/t/') ? 'on' : ''}`} type="button" onClick={() => go('/teams')}>{t.teams}</button>
          <button className={`tab ${path === '/stable' ? 'on' : ''}`} type="button" onClick={() => go('/stable')}>{t.stable}</button>
          <button className={`tab ${path === '/thrones' ? 'on' : ''}`} type="button" onClick={() => go('/thrones')}>{t.throne}</button>
          <button className={`tab ${path.startsWith('/settings') ? 'on' : ''}`} type="button" onClick={() => go('/settings')}>{t.settings}</button>
        </nav>
      ) : <span style={{ flex: 1 }} />}
      {me?.hostPet ? <DefenderArt id={me.hostPet} size={36} /> : null}
      <button className="coin" type="button" onClick={() => go('/shop')}>{formatCoins(me?.coins ?? 0, lang)} ¢</button>
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

/**
 * Phones stay on the phone layout. A phone set to "desktop site" gets a layout
 * viewport of about 980px, which is just wide enough for a 960px desktop check.
 * The user agent and the screen's short side still identify that phone.
 */
function isPhone(): boolean {
  if (window.matchMedia('(max-width: 959px)').matches) return true
  const shortSide = Math.min(window.screen.width, window.screen.height)
  const ua = navigator.userAgent
  if (/iPhone|iPod|Windows Phone/i.test(ua)) return true
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true
  return shortSide > 0 && shortSide <= 520 && window.matchMedia('(pointer: coarse)').matches
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
