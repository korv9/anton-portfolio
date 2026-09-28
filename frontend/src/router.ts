/**
 * Hash routing for the whole site.
 *
 * A route is `#path` with optional query parameters, `#politik-valjarna?partier=S,M&fran=2010`,
 * so a chosen view can be shared as a link. Old addresses keep working: the few that the new
 * politics product replaces redirect, and the rest open as deep dives inside it.
 */
import { useEffect, useState } from 'react'

export type Page =
  | 'home'
  | 'politik'
  | 'jobs'
  | 'welfare'
  | 'analysis'
  | 'drugcomb'
  | 'allegoria'
  | 'thesis'
  | 'homie'
  | 'datamodel'
  | 'status'

export type Route = {
  /** The full hash, e.g. `#politik-valjarna?partier=S`. */
  hash: string
  /** The hash without its query, e.g. `#politik-valjarna`. */
  path: string
  params: URLSearchParams
  page: Page
}

/** Addresses that the new structure replaces, and where they now lead. */
export const REDIRECTS: Record<string, string> = {
  '#now': '#politik',
  '#now-election': '#politik',
  '#politics-page': '#politik',
  '#about': '#om-mig',
  '#projects': '#projekt',
}

const POLITICS_PREFIXES = [
  '#politik',
  '#now-',
  '#politics',
  '#budget-',
  '#parties',
  '#issue-',
  '#taxes',
]
const POLITICS_EXACT = ['#data-explorer', '#debates', '#raw-data']

export function isPoliticsPath(path: string) {
  return (
    POLITICS_EXACT.includes(path) ||
    POLITICS_PREFIXES.some((prefix) => path.startsWith(prefix))
  )
}

export function pageOf(path: string): Page {
  if (isPoliticsPath(path)) return 'politik'
  if (
    ['#job-market', '#job-data'].includes(path) ||
    path.startsWith('#job-market-')
  )
    return 'jobs'
  if (['#drugcomb', '#drugcomb-data'].includes(path)) return 'drugcomb'
  if (path === '#rfc-drift') return 'allegoria'
  if (path === '#thesis') return 'thesis'
  if (path === '#homie') return 'homie'
  if (path === '#sweden' || path.startsWith('#sweden-')) return 'welfare'
  if (path === '#status') return 'status'
  if (path === '#analysis' || path.startsWith('#analysis-')) return 'analysis'
  if (path === '#data-model' || path.startsWith('#data-model-'))
    return 'datamodel'
  return 'home'
}

export function parseHash(raw: string): Route {
  const hash = raw || '#start'
  const [rawPath, query = ''] = hash.split('?')
  const path = REDIRECTS[rawPath] ?? rawPath
  return { hash, path, params: new URLSearchParams(query), page: pageOf(path) }
}

/** The current route; follows hash changes and applies redirects in the address bar. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const update = () => {
      const raw = window.location.hash
      const [rawPath, query] = raw.split('?')
      const target = REDIRECTS[rawPath]
      if (target) {
        // Replace, so the back button does not bounce through the old address.
        history.replaceState(null, '', target + (query ? `?${query}` : ''))
      }
      setRoute(parseHash(window.location.hash))
    }
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return route
}

/** Replace the query of the current hash without adding a history entry per filter change. */
export function setHashParams(path: string, params: URLSearchParams) {
  const query = params.toString()
  const next = query ? `${path}?${query}` : path
  if (window.location.hash === next) return
  history.replaceState(null, '', next)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
