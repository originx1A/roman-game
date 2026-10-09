import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import { OwnerGifts } from './components/OwnerGifts'

/*
 * 10.09: stand-alone owner page (owner.html). /roman-owner is rewritten to it (public/_redirects), so the owner
 * page loads without the game bundle. Same OwnerGifts component the game's main.tsx renders for /roman-owner.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OwnerGifts />
  </StrictMode>,
)
