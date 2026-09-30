import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isStoreBuild } from './game/iap'
import { OwnerGifts } from './components/OwnerGifts'

// 9.30-a: Tony's hidden gift page (web only). Everything else is the game.
const owner = !isStoreBuild() && /^\/roman-owner\/?$/.test(window.location.pathname)

// 9.30-c: a Home Screen bookmark of /roman-owner must open the owner page, not the game. The game's
// manifest says start_url "./" (the game), so the owner route points at its own manifest and title.
if (owner) {
  // never let a search or AI crawler index the owner page
  const robots = document.querySelector('meta[name="robots"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
  robots.setAttribute('content', 'noindex, nofollow, noarchive')
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/owner.webmanifest')
  const title = document.createElement('meta')
  title.name = 'apple-mobile-web-app-title'
  title.content = 'Roman gifts'
  document.head.appendChild(title)
}

createRoot(document.getElementById('root')!).render(<StrictMode>{owner ? <OwnerGifts /> : <App />}</StrictMode>)
