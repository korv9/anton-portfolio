/**
 * Drugs as a night sky: each star is a drug, placed by PCA of its mean ZIP in every tissue, sized
 * by how often it was tested. Drugs that k-means puts together are joined by the shortest lines
 * that connect them all (a minimum spanning tree), so each cluster reads as a constellation.
 * From drug-clusters.json, made by platform/publish/drugcomb_ml.py.
 */
import { useMemo, useState } from 'react'
import { l } from '../i18n'
import { fixed } from '../format'

export type DrugPoint = {
  drug: string
  cluster: number
  x: number
  y: number
  n: number
  mean_zip: number
  share: number
}
export type DrugCluster = {
  id: number
  size: number
  mean_zip: number
  highest: { tissue: string; zip: number }[]
  lowest: { tissue: string; zip: number }[]
  examples: string[]
}

const W = 1000
const H = 640
const PAD = 70
// The site's data-series tokens, in fixed order.
const HUES = [
  'var(--data-ochre)',
  'var(--data-blue)',
  'var(--data-rust)',
  'var(--data-green)',
  'var(--data-purple)',
  'var(--data-teal)',
]
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const num = fixed

/** Prim's minimum spanning tree over points, as index pairs. */
function spanning(points: [number, number][]) {
  const n = points.length
  if (n < 2) return []
  const inTree = new Array(n).fill(false)
  const best = new Array(n).fill(Infinity)
  const from = new Array(n).fill(-1)
  best[0] = 0
  const edges: [number, number][] = []
  for (let k = 0; k < n; k++) {
    let u = -1
    for (let i = 0; i < n; i++)
      if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i
    inTree[u] = true
    if (from[u] >= 0) edges.push([from[u], u])
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue
      const d = Math.hypot(
        points[u][0] - points[v][0],
        points[u][1] - points[v][1],
      )
      if (d < best[v]) {
        best[v] = d
        from[v] = u
      }
    }
  }
  return edges
}

export default function DrugConstellation({
  drugs,
  clusters,
}: {
  drugs: DrugPoint[]
  clusters: DrugCluster[]
}) {
  const [focus, setFocus] = useState<string | null>(null)
  const [only, setOnly] = useState<number | null>(null)

  const placed = useMemo(() => {
    // The PCA map with distances compressed (asinh), so the few far drugs fit beside the rest.
    const t = (v: number) => Math.asinh(v)
    const xs = drugs.map((d) => t(d.x))
    const ys = drugs.map((d) => t(d.y))
    const [x0, x1, y0, y1] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ]
    const sx = (v: number) =>
      PAD + ((t(v) - x0) / (x1 - x0 || 1)) * (W - 2 * PAD)
    const sy = (v: number) =>
      H - PAD - ((t(v) - y0) / (y1 - y0 || 1)) * (H - 2 * PAD)
    const maxN = Math.max(...drugs.map((d) => d.n))
    return drugs.map((d) => ({
      ...d,
      px: sx(d.x),
      py: sy(d.y),
      r: 1.6 + 5 * Math.sqrt(d.n / maxN),
    }))
  }, [drugs])

  const lines = useMemo(
    () =>
      clusters.flatMap((c) => {
        const members = placed.filter((d) => d.cluster === c.id)
        return spanning(members.map((d) => [d.px, d.py])).map(([a, b]) => ({
          cluster: c.id,
          a: members[a],
          b: members[b],
        }))
      }),
    [clusters, placed],
  )

  const centres = clusters.map((c) => {
    const m = placed.filter((d) => d.cluster === c.id)
    return {
      ...c,
      cx: m.reduce((s, d) => s + d.px, 0) / m.length,
      cy: m.reduce((s, d) => s + d.py, 0) / m.length,
    }
  })
  const star = placed.find((d) => d.drug === focus) ?? null
  const dim = (cluster: number) => only !== null && only !== cluster

  return (
    <div className="dsky">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={l(
          `${drugs.length} drugs in ${clusters.length} clusters by where they are synergistic.`,
          `${drugs.length} läkemedel i ${clusters.length} kluster efter var de är synergistiska.`,
        )}
      >
        <rect width={W} height={H} className="dsky-ground" />
        <g className="dsky-grid">
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <circle key={f} cx={W / 2} cy={H / 2} r={(H / 2) * f * 1.4} />
          ))}
          <line x1={W / 2} y1={20} x2={W / 2} y2={H - 20} />
          <line x1={20} y1={H / 2} x2={W - 20} y2={H / 2} />
        </g>
        {lines.map((e, k) => (
          <line
            key={k}
            className="dsky-line"
            x1={e.a.px}
            y1={e.a.py}
            x2={e.b.px}
            y2={e.b.py}
            opacity={dim(e.cluster) ? 0.05 : 0.35}
            style={{
              ['--k' as string]: k,
              stroke: HUES[e.cluster % HUES.length],
            }}
          />
        ))}
        {placed.map((d, k) => (
          <g
            key={d.drug}
            className="dsky-star"
            opacity={dim(d.cluster) ? 0.15 : 1}
            onMouseEnter={() => setFocus(d.drug)}
            onMouseLeave={() => setFocus(null)}
            style={{ ['--k' as string]: k }}
          >
            <circle cx={d.px} cy={d.py} r={d.r * 3} className="dsky-hit" />
            <circle
              cx={d.px}
              cy={d.py}
              r={d.r}
              style={{ fill: HUES[d.cluster % HUES.length] }}
            />
            {d.r > 4 && (
              <path
                d={`M ${d.px - d.r * 2.2} ${d.py} H ${d.px + d.r * 2.2} M ${d.px} ${d.py - d.r * 2.2} V ${d.py + d.r * 2.2}`}
                style={{ stroke: HUES[d.cluster % HUES.length] }}
                className="dsky-spike"
              />
            )}
          </g>
        ))}
        {centres.map((c) => (
          <text
            key={c.id}
            x={c.cx}
            y={c.cy - 18}
            textAnchor="middle"
            className="dsky-label"
            style={{ fill: HUES[c.id % HUES.length] }}
            opacity={dim(c.id) ? 0.2 : 1}
          >
            {ROMAN[c.id]}
          </text>
        ))}
        {star && (
          <g
            className="dsky-tip"
            transform={`translate(${star.px} ${star.py})`}
          >
            <circle r={star.r + 6} />
            <text
              x={star.px > W - 220 ? -14 : 14}
              y={-10}
              textAnchor={star.px > W - 220 ? 'end' : 'start'}
            >
              {star.drug}
            </text>
            <text
              x={star.px > W - 220 ? -14 : 14}
              y={6}
              textAnchor={star.px > W - 220 ? 'end' : 'start'}
              className="dsky-tip-meta"
            >
              {ROMAN[star.cluster]} · {num(star.n)} {l('meas.', 'mätn.')} · ZIP{' '}
              {num(star.mean_zip, 1)}
            </text>
          </g>
        )}
      </svg>
      <div
        className="dsky-legend"
        role="group"
        aria-label={l('Clusters', 'Kluster')}
      >
        {clusters.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={only === c.id}
            onClick={() => setOnly(only === c.id ? null : c.id)}
          >
            <i
              style={{ background: HUES[c.id % HUES.length] }}
              aria-hidden="true"
            />
            <b>{ROMAN[c.id]}</b> · {c.size} {l('drugs', 'läkemedel')} ·{' '}
            {l('mean ZIP', 'medel-ZIP')} {num(c.mean_zip, 1)}
          </button>
        ))}
      </div>
    </div>
  )
}
