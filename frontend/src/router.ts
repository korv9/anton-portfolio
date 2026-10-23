/**
 * Hash routing for the whole site.
 *
 * A route is `#path` with optional query parameters, `#concept-journey?begrepp=risk`, so a
 * chosen view can be shared as a link. Old addresses keep working through redirects; the
 * withdrawn observatories all lead to the "What does it even mean?" feed.
 */
import { useEffect, useState } from 'react'

export type Page =
  | 'home'
  | 'projects'
  | 'sweden'
  | 'drugcomb'
  | 'thesis'
  | 'homie'
  | 'lakehouse'
  | 'symbolic'
  | 'philosophy'
  | 'concepts'
  | 'clusters'
  | 'meaning'
  | 'lawqa'
  | 'jobs'

export type Route = {
  /** The full hash, e.g. `#politik-valjarna?partier=S`. */
  hash: string
  /** The hash without its query, e.g. `#politik-valjarna`. */
  path: string
  params: URLSearchParams
  page: Page
  /** Read by the unrouted Job Intelligence source kept for the compliance release check. */
  companyId?: string
}

/** Addresses that the new structure replaces, and where they now lead. */
/** The feed of charts that replaced the withdrawn observatories. */
export const MEANING = '#what-does-it-even-mean'

export const REDIRECTS: Record<string, string> = {
  '#jobb-utforska': MEANING,
  // The Wellbeing Observatory's addresses from before the SWEDEN platform took #sweden.
  '#sweden-work': MEANING,
  '#sweden-sick-leave': MEANING,
  '#sweden-health': MEANING,
  '#sweden-counties': MEANING,
  '#sweden-kommuner': MEANING,
  '#sweden-explorer': MEANING,
  '#sweden-mental-health': MEANING,
  '#now': MEANING,
  '#data-constellation': '#projekt',
  '#data-catalogue': '#projekt',
  '#idea-lineage': '#projekt',
  '#quality': '#projekt',
  '#data-model': '#projekt',
  '#er': '#projekt',
  '#er-diagram': '#projekt',
  '#tech': '#projekt',
  '#diva': '#projekt',
  '#rag': '#projekt',
  '#mimii': '#projekt',
  '#rfc-drift': '#projekt',
  '#now-election': MEANING,
  '#politik-debatter': MEANING,
  '#politics-page': MEANING,
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
  // The architecture page is the Data Constellation now.
  '#technical': '#projekt',
  '#teknisk': '#projekt',
  '#design': '#start',
  '#tallman': '#projekt',
  '#job-market': MEANING,
  '#job-market-occupations': MEANING,
  '#job-market-regions': MEANING,
  '#job-market-conditions': MEANING,
  '#job-market-clusters': MEANING,
  '#status': '#projekt',
  '#symbolic-map': '#symbolic-atlas',
  // The politics product's older detailed views.
  '#now-seats': MEANING,
  '#now-news': MEANING,
  '#now-studies': MEANING,
  '#now-history': MEANING,
  '#now-government': MEANING,
  '#now-depth': MEANING,
  '#data-explorer': MEANING,
  '#debates': MEANING,
  '#raw-data': MEANING,
}

/** Older address families and the theme they lead to, checked after the exact list. */
const PREFIX_REDIRECTS: [string, string][] = [
  ['#quality-', '#projekt'],
  ['#data-model-', '#projekt'],
  // The withdrawn observatories: politics, jobs, Job Intelligence, wellbeing, the AI Act
  // and the statute book, with every tab, deep dive and older address of theirs.
  ...[
    '#now',
    '#politik',
    '#politics',
    '#issue-',
    '#budget-',
    '#parties',
    '#taxes',
    '#analysis',
    '#jobb',
    '#job-',
    '#wellbeing',
    '#compliance',
    '#ai-act',
    '#lagboken',
  ].map((prefix): [string, string] => [prefix, MEANING]),
]

/**
 * The published build shows only the start page while the products are refined; every other
 * page leads there. Local dev and the browser tests (the Vite dev server) keep the full site.
 */
const START_ONLY = import.meta.env?.PROD === true

/** Where an address leads now, if it has moved. */
export function redirectOf(path: string): string | undefined {
  const target =
    REDIRECTS[path] ??
    PREFIX_REDIRECTS.find(([prefix]) => path.startsWith(prefix))?.[1]
  return START_ONLY && pageOf(target ?? path) !== 'home' ? '#start' : target
}

/**
 * The reports: three tabs each, every tab an address of its own. All of them are laid out like
 * the start page: edge to edge, no breadcrumb or topic rows.
 */
/** The SWEDEN research platform: the hub, the five research products and Connections. */
export const SWEDEN_PATHS = [
  '#sweden',
  '#sweden-matning',
  '#sweden-arbete',
  '#sweden-likhet',
  '#sweden-tillhorighet',
  '#sweden-framtid',
  '#sweden-samband',
  '#sweden-kit',
  '#sweden-atlas',
  '#sweden-atlas-a',
  '#sweden-atlas-b',
  '#sweden-atlas-c',
  '#sweden-atlas-d',
  '#sweden-atlas-e',
  '#sweden-atlas-x',
]
export const PHILOSOPHY_TABS = [
  '#philosophy-atlas',
  '#philosophy-groups',
  '#philosophy-tensions',
]
export const SYMBOLIC_TABS = [
  '#symbolic-atlas',
  '#symbolic-findings',
  '#symbolic-experiments',
]
export const CONCEPT_TABS = [
  '#concept-journey',
  '#concepts-profiles',
  '#concept-constellation',
]
export const DRUGCOMB_TABS = ['#drugcomb', '#drugcomb-model', '#drugcomb-cells']
const REPORTS = [PHILOSOPHY_TABS, SYMBOLIC_TABS, CONCEPT_TABS, DRUGCOMB_TABS]
export function isLongRead(path: string) {
  return (
    REPORTS.flat().includes(path) ||
    path.startsWith('#philosophy-') ||
    path.startsWith('#symbolic-') ||
    path.startsWith('#concept-') ||
    path.startsWith('#concepts-') ||
    path.startsWith('#drugcomb') ||
    path === '#fraga-lagen' ||
    SWEDEN_PATHS.includes(path)
  )
}
/** Two tabs of the same report: the page then keeps the reader where they stand. */
export function sameReport(a: string, b: string) {
  return REPORTS.some((tabs) => tabs.includes(a) && tabs.includes(b))
}

export function pageOf(path: string): Page {
  if (path === '#projekt') return 'projects'
  if (path.startsWith('#drugcomb')) return 'drugcomb'
  if (path === '#thesis') return 'thesis'
  if (path === '#homie') return 'homie'
  if (path === '#diva-lakehouse') return 'lakehouse'
  if (SWEDEN_PATHS.includes(path)) return 'sweden'
  if (path === '#cluster-visuals') return 'clusters'
  if (path === MEANING) return 'meaning'
  if (path === '#fraga-lagen') return 'lawqa'
  // The job assistant (docs/job-assistant.md); #jobb and #job- still lead to the feed.
  if (path === '#jobs') return 'jobs'
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

export function companyHref(id: string) {
  return '/companies/' + encodeURIComponent(id)
}

/** Company profiles (`/companies/<id>`) belonged to Job Intelligence; they lead to the feed. */
export function parseLocation(pathname: string, hash: string): Route {
  return parseHash(pathname.startsWith('/companies/') ? MEANING : hash)
}

/** The current route; follows hash changes and applies redirects in the address bar. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() =>
    parseLocation(location.pathname, location.hash),
  )
  useEffect(() => {
    const update = () => {
      const raw = window.location.hash
      const [rawPath, query] = raw.split('?')
      const target = redirectOf(rawPath)
      if (location.pathname.startsWith('/companies/')) {
        history.replaceState(null, '', '/' + (redirectOf(MEANING) ?? MEANING))
      }
      if (target) {
        // Replace, so the back button does not bounce through the old address.
        history.replaceState(null, '', target + (query ? `?${query}` : ''))
      }
      setRoute(parseLocation(location.pathname, location.hash))
    }
    update()
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return route
}

/**
 * Replace the query of the current hash without adding a history entry per filter change, or
 * with `push` add one, so back and forward step through chosen views.
 */
export function setHashParams(
  path: string,
  params: URLSearchParams,
  push = false,
) {
  const query = params.toString()
  const next = query ? `${path}?${query}` : path
  if (window.location.hash === next) return
  if (push) history.pushState(null, '', next)
  else history.replaceState(null, '', next)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
