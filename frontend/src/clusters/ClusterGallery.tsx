/**
 * The clearest clusterings on the site, drawn large in the home maps' warm greys (cluster-maps
 * README): only compact clusters are kept and thinned (clearest()), so no map reads as a blob;
 * the extent comes from the points kept, outliers are dropped rather than clamped onto the
 * frame, and clusters are toned by size rank. Each map loads its data when it nears the screen.
 */
import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import { WARM_TONES } from '../home/backdropGeometry'
import { loadDebateMap } from './debateData'
import { galleryProjection, type Xyc } from './clusterGeometry'

type Data = {
  points: Xyc[]
  /** Size of the full run when the file holds a sample of it. */
  total?: number
}
type Dataset = {
  key: string
  title: () => string
  method: string
  load: () => Promise<Data>
}

const UH = 'UMAP · HDBSCAN'
const research = (slug: string) => () =>
  fetchJson<{
    observations: number
    points: [string, number, number, number][]
  }>(`cluster-research/${slug}.json`).then((d) => ({
    points: d.points.map(([, x, y, c]): Xyc => [x, y, c]),
    total: d.observations,
  }))
let atlas: Promise<
  Record<string, [string, number, number, number, number][]>
> | null = null
const philosophy = (view: 'baseline' | 'author_centered') => async () => ({
  points: (await (atlas ??= fetchJson('philosophy/atlas.json')))[view].map(
    ([, , x, y, c]): Xyc => [x, y, c],
  ),
})
const triples = (path: string) => () =>
  fetchJson<{ points: Xyc[] }>(path).then((d) => ({ points: d.points }))
const objects = (points: { x: number; y: number; c: number }[]) =>
  points.map((p): Xyc => [p.x, p.y, p.c])

/** In the README's order: most striking first. */
export const DATASETS: Dataset[] = [
  {
    key: 'jobs-detail',
    title: () => l('IT job ads, 2022–2025', 'IT-jobbannonser 2022–2025'),
    method: UH,
    load: triples('jobs/preview-detail.json'),
  },
  {
    key: 'debate-backdrop',
    title: () =>
      l('Riksdag debates, 33 sessions', 'Riksdagsdebatter, 33 riksmöten'),
    method: l('UMAP · one topic model', 'UMAP · en ämnesmodell'),
    load: () => loadDebateMap().then((m) => ({ points: objects(m.points) })),
  },
  {
    key: 'symbolic-detail',
    title: () => l('Symbol words in 101 books', 'Symbolord i 101 böcker'),
    method: UH,
    load: triples('symbolic/preview-detail.json'),
  },
  {
    key: 'debate-topics',
    title: () =>
      l('Party-leader debates by subject', 'Partiledardebatter efter ämne'),
    method: l('UMAP · HDBSCAN, 12 seeds', 'UMAP · HDBSCAN, 12 frön'),
    load: research('debate-topics'),
  },
  {
    key: 'philosophy-baseline',
    title: () =>
      l(
        'Passages from 13 works of philosophy',
        'Passager ur 13 filosofiska verk',
      ),
    method: UH,
    load: philosophy('baseline'),
  },
  {
    key: 'philosophy-author',
    title: () =>
      l(
        'The same passages, centred per work',
        'Samma passager, centrerade per verk',
      ),
    method: UH,
    load: philosophy('author_centered'),
  },
  {
    key: 'debates-legacy',
    title: () =>
      l(
        'Riksdag debates, four earlier sessions',
        'Riksdagsdebatter, fyra tidigare riksmöten',
      ),
    method: l('UMAP · earlier topic model', 'UMAP · äldre ämnesmodell'),
    load: async () => {
      const parts = await Promise.all(
        ['2015-16', '2020-21', '2022-23', '2025-26'].map((s) =>
          fetchJson<{ data: { x: number; y: number; topic_id: number }[] }>(
            `debates/sessions/${s}/umap.json`,
          ),
        ),
      )
      return {
        points: parts.flatMap((p) =>
          p.data.map((d): Xyc => [d.x, d.y, d.topic_id]),
        ),
      }
    },
  },
]

const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))

/** Points, clusters and method: the one line under a map's title. */
export function caption(set: Dataset, data: Data) {
  const n = data.points.length
  return [
    data.total && data.total !== n
      ? `${num(n)} ${l('of', 'av')} ${num(data.total)} ${l('points', 'punkter')}`
      : `${num(n)} ${l('points', 'punkter')}`,
    (() => {
      const { kept, of } = clearest(data.points)
      return kept < of
        ? l(
            `the ${kept} clearest of ${of} clusters`,
            `de ${kept} tydligaste av ${of} kluster`,
          )
        : `${of} ${l('clusters', 'kluster')}`
    })(),
    set.method,
  ].join(' · ')
}

/** A tone mixed into the charcoal page, as color-mix(in srgb) would; canvas needs plain colours. */
function onPage(tone: string, share: number) {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(tone, i) * share + channel('#242422', i) * (1 - share)),
  )
  return `rgb(${mixed.join(' ')})`
}
// The README's contrast mix for clusters, and noise dimmer than the tuned render's.
const TONES = WARM_TONES.map((tone) => onPage(tone, 0.85))
const NOISE = onPage(WARM_TONES[4], 0.35)

/**
 * Only the clearest clusters, so a map never reads as a few big blobs: noise is left out, a
 * cluster holding more than a tenth of the points is dropped, the loosest clusters go (spread
 * around their centre measured against the map's size), at most `keep` remain, and every cluster
 * is thinned to `cap` points by even sampling so dense ones stay a texture, not a solid shape.
 */
export function clearest(points: Xyc[], keep = 16, cap = 700) {
  const groups = new Map<number, Xyc[]>()
  for (const p of points)
    if (p[2] >= 0) (groups.get(p[2]) ?? groups.set(p[2], []).get(p[2])!).push(p)
  const all = [...groups.values()].flat()
  if (!all.length) return { points: [], kept: 0, of: 0 }
  const xs = all.map((p) => p[0]).sort((a, b) => a - b)
  const ys = all.map((p) => p[1]).sort((a, b) => a - b)
  const q = (v: number[], f: number) => v[Math.floor(f * (v.length - 1))]
  const extent =
    Math.hypot(q(xs, 0.95) - q(xs, 0.05), q(ys, 0.95) - q(ys, 0.05)) || 1
  const scored = [...groups].map(([c, ps]) => {
    const cx = ps.reduce((s, p) => s + p[0], 0) / ps.length
    const cy = ps.reduce((s, p) => s + p[1], 0) / ps.length
    const spread =
      ps.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) /
      ps.length /
      extent
    return { c, ps, spread, share: ps.length / all.length }
  })
  const chosen = scored
    .filter((g) => g.share <= 0.1 && g.ps.length >= 8)
    .sort((a, b) => a.spread - b.spread)
    .slice(0, keep)
  const out: Xyc[] = []
  for (const g of chosen) {
    const step = Math.max(1, g.ps.length / cap)
    for (let i = 0; i < g.ps.length; i += step) out.push(g.ps[Math.floor(i)])
  }
  return { points: out, kept: chosen.length, of: groups.size }
}

/** Draws one map; returns how many points landed inside the frame. */
export function drawMap(canvas: HTMLCanvasElement, data: Data) {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.ceil(w * dpr)
  canvas.height = Math.ceil(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx || !w || !h) return 0
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // Rank clusters by size; the largest takes the brightest tone.
  const sizes = new Map<number, number>()
  for (const [, , c] of data.points)
    if (c >= 0) sizes.set(c, (sizes.get(c) ?? 0) + 1)
  const rank = new Map(
    [...sizes].sort((a, b) => b[1] - a[1]).map(([c], i) => [c, i]),
  )
  const { points } = clearest(data.points)
  const { sx, sy, inside } = galleryProjection(
    points,
    w,
    h,
    Math.min(w, h) * 0.06,
  )
  const r =
    (Math.min(w, h) / 800) *
    Math.min(3, Math.max(1.4, Math.sqrt(20000 / points.length)))
  // One path per tone; noise first so the clusters sit on top of it.
  const paths = [NOISE, ...TONES].map(() => new Path2D())
  let drawn = 0
  for (const [x, y, c] of points) {
    if (!inside(x, y)) continue
    const path = paths[c < 0 ? 0 : 1 + (rank.get(c)! % 6)]
    path.moveTo(sx(x) + r, sy(y))
    path.arc(sx(x), sy(y), r, 0, Math.PI * 2)
    drawn++
  }
  ;[NOISE, ...TONES].forEach((tone, i) => {
    ctx.fillStyle = tone
    ctx.fill(paths[i])
  })
  return drawn
}

function Tile({ set, wide }: { set: Dataset; wide: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<Data | 'error' | null>(null)
  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let active = true
    const load = () =>
      set.load().then(
        (d) => active && setData(d),
        () => active && setData('error'),
      )
    if (typeof IntersectionObserver === 'undefined') {
      load()
      return () => void (active = false)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        load()
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(el)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [set])
  useEffect(() => {
    const el = canvas.current
    if (!el || !data || data === 'error') return
    const draw = () => setDrawn(drawMap(el, data))
    draw()
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) draw()
      width = el.clientWidth
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [data])
  const ready = data && data !== 'error'
  return (
    <article
      ref={ref}
      className={`cv-tile${wide ? ' cv-tile-wide' : ''}`}
      id={`cv-map-${set.key}`}
      aria-labelledby={`cv-map-${set.key}-title`}
    >
      <figure>
        <div className="cv-tile-map" aria-busy={!data}>
          {ready && (
            <canvas ref={canvas} aria-hidden="true" data-points={drawn} />
          )}
        </div>
        <figcaption>
          <h2 id={`cv-map-${set.key}-title`}>{set.title()}</h2>
          {ready ? (
            <p className="cv-specs">{caption(set, data)}</p>
          ) : (
            data === 'error' && (
              <p className="cv-specs">
                {l('The data did not load.', 'Datan kunde inte läsas.')}
              </p>
            )
          )}
        </figcaption>
      </figure>
    </article>
  )
}

export default function ClusterGallery() {
  return (
    <div className="cv-gallery">
      {DATASETS.map((set, i) => (
        <Tile key={set.key} set={set} wide={i < 3} />
      ))}
    </div>
  )
}
