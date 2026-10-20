/**
 * D's 3D scene on the shared municipality field: each municipality rises by its rank on the
 * chosen measure (the same rank colouring as the 2D map, so a few extremes do not flatten the
 * rest), and public libraries with coordinates sit on the roofs as lights. The info panel and
 * tables keep the raw values. Split from Belonging.tsx, which keeps data, findings and 2D.
 */
import { lazy, Suspense, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Geometry } from './map'

const MunicipalityField = lazy(() => import('./MunicipalityField'))

export function BelongingField({
  geo,
  values,
  libraries,
  nameOf,
  selected,
  onPick,
  fallback,
}: {
  geo: Geometry
  /** The measure's raw value per municipality code, null when not reported. */
  values: Map<string, number | null>
  libraries: { x: number; y: number; code: string | null }[]
  nameOf: (code: string) => string
  selected: string | null
  onPick: (code: string) => void
  fallback: ReactNode
}) {
  const sorted = [...values.values()]
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  const rank = (v: number) =>
    sorted.length > 1 ? sorted.indexOf(v) / (sorted.length - 1) : 1
  const places = geo.municipalities.map((m) => {
    const v = values.get(m.code)
    return v == null
      ? { code: m.code, height: null }
      : { code: m.code, ramp: rank(v), height: 0.03 + rank(v) * 0.2 }
  })
  return (
    <Suspense
      fallback={
        <p className="sw-note" role="status">
          {l('Loading 3D…', 'Laddar 3D…')}
        </p>
      }
    >
      <MunicipalityField
        geo={geo}
        places={places}
        selected={selected}
        names={new Map(geo.municipalities.map((m) => [m.code, nameOf(m.code)]))}
        points={libraries.map((p) => ({ x: p.x, y: p.y, code: p.code ?? '' }))}
        onPick={onPick}
        label={l(
          'Municipalities raised by their rank on the measure, with public libraries as lights',
          'Kommunerna höjda efter sin rang på måttet, med folkbiblioteken som ljuspunkter',
        )}
        fallback={fallback}
        shiftFor={(w) => (w > 1100 ? -w * 0.03 : 0)}
      />
    </Suspense>
  )
}
