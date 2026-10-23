/**
 * The SWEDEN platform's routes (router.ts SWEDEN_PATHS): the hub at #sweden, a page per research
 * product and Connections. A product page whose data cannot be read shows its question and an
 * EmptyState, never sample findings.
 */
import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import './sweden.css'

// Products with findings, each loaded only on its own route.
const Hub = lazy(() => import('./Hub'))
const Atlas = lazy(() => import('./atlas/Atlas'))

const PAGES: Record<
  string,
  LazyExoticComponent<ComponentType<{ route: Route }>>
> = {
  '#sweden-matning': lazy(() => import('./Measurement')),
  '#sweden-arbete': lazy(() => import('./Language')),
  '#sweden-likhet': lazy(() => import('./Similarity')),
  '#sweden-tillhorighet': lazy(() => import('./Belonging')),
  '#sweden-framtid': lazy(() => import('./Futures')),
  '#sweden-samband': lazy(() => import('./Connections')),
}

export default function SwedenPage({ route }: { route: Route }) {
  if (route.path === '#sweden')
    return (
      <Suspense fallback={null}>
        <Hub />
      </Suspense>
    )
  if (route.path.startsWith('#sweden-atlas'))
    return (
      <Suspense fallback={null}>
        <Atlas path={route.path} />
      </Suspense>
    )
  const Page = PAGES[route.path]
  if (Page)
    return (
      <Suspense
        fallback={
          <p className="sweden sw-note" role="status">
            {l('Loading…', 'Laddar…')}
          </p>
        }
      >
        <Page route={route} />
      </Suspense>
    )
  return (
    <Suspense fallback={null}>
      <Hub />
    </Suspense>
  )
}
