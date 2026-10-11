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
  | 'drugcomb'
  | 'thesis'
  | 'homie'
  | 'lakehouse'
  | 'symbolic'
  | 'aiact'
  | 'philosophy'
  | 'concepts'
  | 'clusters'

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
  '#data-constellation': '#projekt',
  '#data-catalogue': '#projekt',
  '#idea-lineage': '#projekt',
  '#quality': '#projekt',
  '#data-model': '#projekt',
  '#er': '#projekt',
  '#er-diagram': '#projekt',
  '#diva': '#projekt',
  '#rag': '#projekt',
  '#mimii': '#projekt',
  '#rfc-drift': '#projekt',
  '#now-election': '#politik',
  '#politik-debatter': '#politik-sakdebatter',
  '#politics-page': '#politik',
  '#about': '#om-mig',
  '#projects': '#projekt',
  '#alla-projekt': '#projekt',
  // The semantic-drift report is withdrawn while it is reworked.
  '#contact': '#om-mig',
  '#kontakt': '#om-mig',
  '#experience': '#erfarenhet',
  '#work': '#projekt',
  '#teknik': '#om-mig',
  '#kompetenser': '#om-mig',
  // The architecture page is the Data Constellation now; the platform status sits in the
  // data catalogue, and the welfare analysis in the welfare product.
  '#tech': '#projekt',
  '#technical': '#projekt',
  '#teknisk': '#projekt',
  '#design': '#start',
  '#tallman': '#projekt',
  '#job-market': '#jobb',
  '#job-market-occupations': '#jobb-yrken',
  '#job-market-regions': '#jobb-lan',
  '#job-market-conditions': '#jobb-villkor',
  '#job-market-clusters': '#jobb-kluster',
  '#status': '#projekt',
  // The politics product's older detailed views: each address leads to the theme that
  // answers the same question now.
  '#now-seats': '#politik-mandat',
  '#now-news': '#politik-nyheter',
  '#now-studies': '#politik-utredningar',
  '#now-history': '#politik-valjarna',
  '#now-government': '#politik',
  '#now-depth': '#politik-utforska',
  '#data-explorer': '#politik-sok',
  '#debates': '#politik-partiledardebatter',
  '#raw-data': '#politik-kallor',
}

/** Older address families and the theme they lead to, checked after the exact list. */
const PREFIX_REDIRECTS: [string, string][] = [
  ['#quality-', '#projekt'],
  ['#data-model-', '#projekt'],
  ['#now-', '#politik-roster'],
  ['#politics', '#politik-roster'],
  ['#issue-', '#politik-roster'],
  ['#budget-', '#politik-budget'],
  ['#parties', '#politik-partier'],
  ['#taxes', '#politik-skatter'],
  ['#analysis', '#sweden'],
]

/** Where an address leads now, if it has moved. */
export function redirectOf(path: string): string | undefined {
  return (
    REDIRECTS[path] ??
    PREFIX_REDIRECTS.find(([prefix]) => path.startsWith(prefix))?.[1]
  )
}

export function isPoliticsPath(path: string) {
  return path.startsWith('#politik')
}

export function pageOf(path: string): Page {
  if (isPoliticsPath(path)) return 'politik'
  if (
    ['#job-market', '#job-data', '#jobb'].includes(path) ||
    path.startsWith('#job-market-') ||
    path.startsWith('#jobb-')
  )
    return 'jobs'
  if (['#drugcomb', '#drugcomb-data'].includes(path)) return 'drugcomb'
  if (path === '#thesis') return 'thesis'
  if (path === '#homie') return 'homie'
  if (path === '#diva-lakehouse') return 'lakehouse'
  if (path === '#sweden' || path.startsWith('#sweden-')) return 'welfare'
  if (path === '#cluster-visuals') return 'clusters'
  if (path === '#ai-act' || path.startsWith('#ai-act-')) return 'aiact'
  if (path.startsWith('#concept-') || path.startsWith('#concepts-'))
    return 'concepts'
  if (path === '#philosophy-atlas' || path.startsWith('#philosophy-'))
    return 'philosophy'
  if (path === '#symbolic-atlas' || path.startsWith('#symbolic-'))
    return 'symbolic'
  return 'home'
}

export function parseHash(raw: string): Route {
  const hash = raw || '#start'
  const [rawPath, query = ''] = hash.split('?')
  const path = redirectOf(rawPath) ?? rawPath
  return { hash, path, params: new URLSearchParams(query), page: pageOf(path) }
}

/** The current route; follows hash changes and applies redirects in the address bar. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const update = () => {
      const raw = window.location.hash
      const [rawPath, query] = raw.split('?')
      const target = redirectOf(rawPath)
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
