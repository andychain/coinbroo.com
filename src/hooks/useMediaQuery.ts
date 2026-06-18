'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe media query hook. Returns `false` on the server and the first client
 * render (so static export hydrates as desktop), then corrects after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
