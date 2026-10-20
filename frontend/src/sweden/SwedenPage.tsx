/**
 * The SWEDEN platform's routes (router.ts SWEDEN_PATHS): the hub at #sweden, a page per research
 * product, Connections, and #sweden-kit for developing the shared components. A product page
 * whose data cannot be read shows its question and an EmptyState, never sample findings.
 */
import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import {
  EmptyState,
  EvidenceStamp,
  StatusStamp,
  SwedenMasthead,
} from './template'
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
  if (route.path === '#sweden-kit') return <Kit />
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

/** Internal route for developing the shared components; it shows no data. */
function Kit() {
  return (
    <article className="sweden sw-page">
      <SwedenMasthead current="#sweden-kit" />
      <section className="sw-findings">
        <h1>SWEDEN kit</h1>
        <p className="sw-note">
          {l(
            'Component states only. Nothing on this page is data.',
            'Bara komponentlägen. Inget på sidan är data.',
          )}
        </p>
        <h2>{l('Status', 'Status')}</h2>
        <p>
          <StatusStamp status="findings" /> <StatusStamp status="pipeline" />{' '}
          <StatusStamp status="unavailable" />
        </p>
        <h2>{l('Evidence', 'Evidens')}</h2>
        <p>
          <EvidenceStamp evidence="descriptive" />{' '}
          <EvidenceStamp evidence="exploratory" />{' '}
          <EvidenceStamp evidence="causal" />
        </p>
        <h2>{l('Empty state', 'Tomt läge')}</h2>
        <EmptyState
          state="ingestion"
          shows={l(
            'What the visualisation would show.',
            'Vad visualiseringen skulle visa.',
          )}
          needs={l(
            'Which source or pipeline it needs.',
            'Vilken källa eller pipeline den behöver.',
          )}
        />
      </section>
    </article>
  )
}
