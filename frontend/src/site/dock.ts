/**
 * The site sidebar's dock: on a wide screen a product (politics, the job market) places its own
 * navigation inside the site sidebar, so the whole site has one sidebar. On a narrow screen there
 * is no dock and the product shows its navigation itself, as a horizontal menu.
 */
import { createContext, useContext, useEffect, useState } from 'react'

export const DockContext = createContext<HTMLElement | null>(null)

/** Where to render a product's navigation, or null to render it in place. */
export const useDock = () => useContext(DockContext)

/** Whether a media query matches, following changes (a resized window, a rotated phone). */
export function useMedia(query: string) {
  const get = () => !!window.matchMedia?.(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}

/** The width from which the site sidebar is shown. */
export const WIDE = '(min-width: 1024px)'
