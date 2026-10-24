import { useEffect, useState } from 'react'

export function go(path: string): void {
  history.pushState({}, '', path)
  window.dispatchEvent(new Event('rg-nav'))
}

export function usePath(): string {
  const [path, setPath] = useState(() => location.pathname + location.search)
  useEffect(() => {
    const on = () => setPath(location.pathname + location.search)
    window.addEventListener('popstate', on)
    window.addEventListener('rg-nav', on)
    return () => {
      window.removeEventListener('popstate', on)
      window.removeEventListener('rg-nav', on)
    }
  }, [])
  return path
}
