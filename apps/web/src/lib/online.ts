import { useEffect, useState } from 'react'

export function canMutate(online: boolean): boolean {
  return online
}

export function isBrowserOnline(nav: { onLine: boolean } = globalThis.navigator): boolean {
  return canMutate(nav?.onLine !== false)
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  return online
}
