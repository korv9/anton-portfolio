/**
 * The SWEDEN atlas routes: #sweden-atlas (start) and one page per study. Each page is loaded
 * on its own route with three.js; nothing here is loaded on the homepage.
 */
import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'

const PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
  '#sweden-atlas': lazy(() => import('./AtlasHub')),
  '#sweden-atlas-a': lazy(() => import('./AtlasMeasured')),
  '#sweden-atlas-b': lazy(() => import('./AtlasWorker')),
  '#sweden-atlas-c': lazy(() => import('./AtlasModelled')),
  '#sweden-atlas-d': lazy(() => import('./AtlasBelonging')),
  '#sweden-atlas-e': lazy(() => import('./AtlasFutures')),
  '#sweden-atlas-x': lazy(() => import('./AtlasConnections')),
}

export const ATLAS_PATHS = Object.keys(PAGES)

export default function Atlas({ path }: { path: string }) {
  const Page = PAGES[path] ?? PAGES['#sweden-atlas']
  return (
    <Suspense
      fallback={
        <p className="sweden sw-note" role="status">
          Loading…
        </p>
      }
    >
      <Page />
    </Suspense>
  )
}
