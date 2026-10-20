/**
 * C's 3D scene: municipalities lift from the map and travel to their place in similarity space
 * (the first two principal components), on MunicipalityField. Split from Similarity.tsx, which
 * keeps the data, findings and 2D views.
 *
 * `t` runs from 0 (map) to 1 (similarity). The URL keeps the end the reader chose (`vy`), and the
 * slider shows every step between. Reduced motion jumps instead of animating.
 */
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { l } from '../i18n'
import type { Geometry } from './map'
import { reducedMotion } from './stage'

const MunicipalityField = lazy(() => import('./MunicipalityField'))

/** The finer split's four groups; categorical colours, legible on the dark and light page. */
export const GROUP_HEX = ['#E07A5F', '#3D9A8B', '#9B8BE0', '#C9A227']

type Muni = {
  code: string
  name: string
  population: number | null
  finer?: number
  pc?: [number, number]
  neighbours?: [string, number, number][]
}

export function useMorph(
  view: 'map' | 'similarity',
  onEnd: (v: 'map' | 'similarity') => void,
) {
  const [t, setT] = useState(view === 'similarity' ? 1 : 0)
  const anim = useRef(0)
  const end = useRef(onEnd)
  end.current = onEnd
  const go = (to: number) => {
    cancelAnimationFrame(anim.current)
    if (reducedMotion()) {
      setT(to)
      end.current(to > 0.5 ? 'similarity' : 'map')
      return
    }
    const from = t
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1400)
      setT(from + (to - from) * k)
      if (k < 1) anim.current = requestAnimationFrame(step)
      else end.current(to > 0.5 ? 'similarity' : 'map')
    }
    anim.current = requestAnimationFrame(step)
  }
  useEffect(() => () => cancelAnimationFrame(anim.current), [])
  return { t, setT, go }
}

export function MorphControl({
  t,
  setT,
  go,
  onEnd,
  trails,
  setTrails,
}: {
  t: number
  setT: (t: number) => void
  go: (to: number) => void
  onEnd: (v: 'map' | 'similarity') => void
  trails: boolean
  setTrails: (v: boolean) => void
}) {
  return (
    <div className="sw-morph">
      <button
        type="button"
        className="sw-play"
        aria-label={
          t > 0.5
            ? l('Back to the map', 'Tillbaka till kartan')
            : l('Play the transition', 'Spela övergången')
        }
        onClick={() => go(t > 0.5 ? 0 : 1)}
      >
        <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
          {t > 0.5 ? (
            <path d="M13 1L1 8l12 7z" fill="currentColor" />
          ) : (
            <path d="M1 1l12 7-12 7z" fill="currentColor" />
          )}
        </svg>
      </button>
      <label className="sw-morph-track">
        <span className="sw-visually-hidden">
          {l('Map to similarity', 'Karta till likhet')}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(t * 100)}
          onChange={(e) => setT(Number(e.target.value) / 100)}
          onPointerUp={() => onEnd(t > 0.5 ? 'similarity' : 'map')}
          onKeyUp={() => onEnd(t > 0.5 ? 'similarity' : 'map')}
        />
        <span className="sw-morph-ends" aria-hidden="true">
          <span>{l('MAP', 'KARTA')}</span>
          <span>{l('SIMILARITY', 'LIKHET')}</span>
        </span>
      </label>
      <label className="sw-check">
        <input
          type="checkbox"
          checked={trails}
          onChange={(e) => setTrails(e.target.checked)}
        />
        {l('Paths', 'Banor')}
      </label>
    </div>
  )
}

export function SimilarityField({
  geo,
  municipalities,
  t,
  trails,
  selected,
  onPick,
  fallback,
}: {
  geo: Geometry
  municipalities: Muni[]
  t: number
  trails: boolean
  selected: Muni | null
  onPick: (code: string) => void
  fallback: ReactNode
}) {
  const pcs = municipalities.filter((m) => m.pc && m.finer != null)
  const xs = pcs.map((m) => m.pc![0])
  const ys = pcs.map((m) => m.pc![1])
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2
  const my = (Math.min(...ys) + Math.max(...ys)) / 2
  const half =
    Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ) / 2 || 1
  const pops = municipalities.map((m) => Math.log10(m.population ?? 1000))
  const p0 = Math.min(...pops)
  const p1 = Math.max(...pops)
  const places = municipalities.map((m) => ({
    code: m.code,
    colour: m.finer != null ? GROUP_HEX[m.finer] : '#3a3935',
    // Height is population on a log scale; the info panel shows the count.
    height:
      m.finer != null && m.population
        ? ((Math.log10(m.population) - p0) / (p1 - p0)) * 0.25
        : null,
    target:
      m.pc && m.finer != null
        ? ([(m.pc[0] - mx) / half, (m.pc[1] - my) / half] as [number, number])
        : undefined,
  }))
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
        t={t}
        trails={trails}
        selected={selected?.code ?? null}
        marked={(selected?.neighbours ?? []).slice(0, 3).map((n) => n[0])}
        names={new Map(municipalities.map((m) => [m.code, m.name]))}
        onPick={onPick}
        label={l(
          'Municipalities moving from the map to similarity space',
          'Kommunerna flyttar från kartan till likhetsrummet',
        )}
        fallback={fallback}
        shiftFor={(w) => (w > 1100 ? -w * 0.05 : 0)}
      />
    </Suspense>
  )
}
