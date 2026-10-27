import { l } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { fetchJson } from '../dataSource'
import { galleryProjection, type Xyc } from '../clusters/clusterGeometry'
import { WARM_TONES } from './backdropGeometry'

type Preview = { points: Xyc[] }

/** A tone mixed into the charcoal page, as color-mix(in srgb) would; canvas needs plain colours. */
function onPage(tone: string, share: number) {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(tone, i) * share + channel('#242422', i) * (1 - share)),
  )
  return `rgb(${mixed.join(' ')})`
}
// The "tuned" mix of the cluster-maps renders: clusters 75 %, noise 30 %.
const TONES = WARM_TONES.map((tone) => onPage(tone, 0.75))
const NOISE = onPage(WARM_TONES[4], 0.3)

/**
 * A cluster map on a square canvas in the backdrop's warm greys, framed as the cluster-maps
 * "tuned" render: the extent comes from the clustered points only and the points beyond it are
 * dropped, not clamped onto the edge, so a sparse noise halo cannot shrink the map. Sparse sets
 * get larger dots. `data-points` counts the points drawn.
 */
export function PointCanvas({ points }: { points: Xyc[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const el = canvas.current
    if (!el || !points.length) return
    const size = el.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    el.width = el.height = Math.ceil(size * dpr)
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const { sx, sy, inside } = galleryProjection(
      points,
      size,
      size,
      size * 0.08,
    )
    const r =
      (size / 900) * Math.min(3, Math.max(1, Math.sqrt(20000 / points.length)))
    let n = 0
    for (const [x, y, c] of points) {
      if (!inside(x, y)) continue
      ctx.fillStyle = c < 0 ? NOISE : TONES[c % 6]
      ctx.beginPath()
      ctx.arc(sx(x), sy(y), r, 0, Math.PI * 2)
      ctx.fill()
      n++
    }
    setDrawn(n)
  }, [points])
  return <canvas ref={canvas} aria-hidden="true" data-points={drawn} />
}

/**
 * The IT job-ads UMAP beside the Projects link. Decorative, so it loads only when the reader
 * nears it and leaves nothing behind when the data is missing.
 */
export default function JobsMap() {
  const figure = useRef<HTMLElement>(null)
  const [points, setPoints] = useState<Xyc[]>([])

  useEffect(() => {
    const el = figure.current
    if (!el) return
    let active = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        fetchJson<Preview>('jobs/preview-detail.json')
          .then((data) => active && setPoints(data.points))
          .catch(() => {})
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [])

  return (
    <figure className="home-jobs-map" ref={figure}>
      <PointCanvas points={points} />
      <figcaption>
        {l(
          'IT JOB ADS IN SWEDEN · 35,861 ADS · UMAP',
          'IT-JOBBANNONSER I SVERIGE · 35 861 ANNONSER · UMAP',
        )}
      </figcaption>
    </figure>
  )
}
