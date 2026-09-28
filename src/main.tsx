import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isStoreBuild } from './game/iap'
import { OwnerGifts } from './components/OwnerGifts'

// 9.30-a: Tony's hidden gift page (web only). Everything else is the game.
const owner = !isStoreBuild() && /^\/roman-owner\/?$/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(<StrictMode>{owner ? <OwnerGifts /> : <App />}</StrictMode>)
