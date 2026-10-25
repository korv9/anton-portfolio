import { useEffect, useRef, useState } from 'react'
import { fetchJson } from '../dataSource'
import { projectClusterPoints } from '../clusters/clusterGeometry'
import { WARM_TONES } from './backdropGeometry'

type Preview = { points: [number, number, number][] }

/** A tone mixed into the charcoal page, as color-mix(in srgb) would; canvas needs plain colours. */
function onPage(tone: string, share: number) {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(tone, i) * share + channel('#242422', i) * (1 - share)),
  )
  return `rgb(${mixed.join(' ')})`
}
// The debate map's mix: clusters 62 %, noise 40 %.
const TONES = WARM_TONES.map((tone) => onPage(tone, 0.62))
const NOISE = onPage(WARM_TONES[4], 0.4)

/**
 * The IT job-ads UMAP beside the Projects link, in the backdrop's warm greys. Decorative, so it
 * loads only when the reader nears it and leaves nothing behind when the data is missing.
 */
export default function JobsMap() {
  const figure = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [points, setPoints] = useState<Preview['points']>([])

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

  useEffect(() => {
    const el = canvas.current
    if (!el || !points.length) return
    const size = el.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    el.width = el.height = Math.ceil(size * dpr)
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const { sx, sy } = projectClusterPoints(
      points.map(([x, y]) => ({ x, y })),
      size,
      size,
      size * 0.08,
    )
    const r = size / 900
    for (const [x, y, c] of points) {
      ctx.fillStyle = c < 0 ? NOISE : TONES[c % 6]
      ctx.beginPath()
      ctx.arc(sx(x), sy(y), r, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [points])

  return (
    <figure className="home-jobs-map" ref={figure}>
      <canvas ref={canvas} aria-hidden="true" data-points={points.length} />
      <figcaption>IT JOB ADS IN SWEDEN · 35,861 ADS · UMAP</figcaption>
    </figure>
  )
}
