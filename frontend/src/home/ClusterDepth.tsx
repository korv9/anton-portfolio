import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { galleryProjection, type Xyc } from '../clusters/clusterGeometry'
import { l } from '../i18n'
import { WARM_TONES, compactClusters } from './backdropGeometry'

/** The owner's picks from the cluster-maps README: the most distinct islands. */
// Not the debate backdrop or the job ads: those already open and close the page.
const MAPS = ['symbolic-detail', 'debate-topics', 'philosophy-baseline']
/** The kept clusters, by size rank, in three layers at different depths. */
const LAYERS = 3

type Loaded = { points: Xyc[]; caption: string }

/**
 * Draws one layer: every point is projected with the whole map's frame, so the layers line up.
 * A single fill per tone at the README's contrast share (85 %) composites over the page exactly
 * as the gallery's colour mix does.
 */
function drawLayer(canvas: HTMLCanvasElement, points: Xyc[], layer: number) {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.ceil(w * dpr)
  canvas.height = Math.ceil(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx || !w || !h) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const sizes = new Map<number, number>()
  for (const [, , c] of points) sizes.set(c, (sizes.get(c) ?? 0) + 1)
  const rank = new Map(
    [...sizes].sort((a, b) => b[1] - a[1]).map(([c], i) => [c, i]),
  )
  const { sx, sy, inside } = galleryProjection(points, w, h, w * 0.06)
  const r =
    (Math.min(w, h) / 800) *
    Math.min(3, Math.max(1.4, Math.sqrt(20000 / points.length)))
  const paths = WARM_TONES.map(() => new Path2D())
  for (const [x, y, c] of points) {
    if (rank.get(c)! % LAYERS !== layer || !inside(x, y)) continue
    const path = paths[rank.get(c)! % 6]
    path.moveTo(sx(x) + r, sy(y))
    path.arc(sx(x), sy(y), r, 0, Math.PI * 2)
  }
  ctx.globalAlpha = 0.85
  paths.forEach((path, i) => {
    ctx.fillStyle = WARM_TONES[i]
    ctx.fill(path)
  })
}

/**
 * One map as stacked cluster layers in CSS 3D: it loads when it nears the screen, breathes and
 * follows the pointer while on screen, and stands still under reduced motion (home.css).
 */
function DepthMap({ name, index }: { name: string; index: number }) {
  const ref = useRef<HTMLElement>(null)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const [data, setData] = useState<Loaded | null>(null)
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let active = true
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        near.disconnect()
        // The gallery's loaders, fetched with their module only when a map is near.
        import('../clusters/ClusterGallery')
          .then(async ({ DATASETS }) => {
            const set = DATASETS.find((d) => d.key === name)!
            const points = compactClusters((await set.load()).points)
            const k = new Set(points.map((p) => p[2])).size
            if (active)
              setData({
                points,
                caption: `${set.title()} · ${l(`the ${k} tightest clusters`, `de ${k} tätaste klustren`)}`,
              })
          })
          // Decoration: a map that does not load leaves its wordless placeholder.
          .catch(() => {})
      },
      { rootMargin: '600px 0px' },
    )
    const seen = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    )
    near.observe(el)
    seen.observe(el)
    return () => {
      active = false
      near.disconnect()
      seen.disconnect()
    }
  }, [name])

  useEffect(() => {
    if (!data) return
    const draw = () =>
      canvases.current.forEach(
        (canvas, layer) => canvas && drawLayer(canvas, data.points, layer),
      )
    draw()
    const first = canvases.current[0]
    let width = first?.clientWidth
    const observer = new ResizeObserver(() => {
      if (first?.clientWidth !== width) draw()
      width = first?.clientWidth
    })
    if (first) observer.observe(first)
    return () => observer.disconnect()
  }, [data])

  return (
    <div className="home-map-slot">
      <figure
        className="home-map3d"
        ref={ref}
        data-ready={!!data}
        data-paused={!onScreen}
        style={{ '--breathe-delay': `${-index * 9}s` } as CSSProperties}
      >
        <div className="home-map3d-scene" aria-hidden="true">
          {Array.from({ length: LAYERS }, (_, layer) => (
            <canvas
              key={layer}
              className="home-map3d-layer"
              ref={(el) => void (canvases.current[layer] = el)}
              style={{ '--depth': layer - 1 } as CSSProperties}
            />
          ))}
        </div>
        {data && <figcaption>{data.caption}</figcaption>}
      </figure>
    </div>
  )
}

/** The maps beside the work history; the pointer tilts their layers apart on a desktop. */
export default function ClusterDepth() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || frame) return
      const x = event.clientX / innerWidth - 0.5
      const y = event.clientY / innerHeight - 0.5
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--pointer-x', x.toFixed(3))
        el.style.setProperty('--pointer-y', y.toFixed(3))
        frame = 0
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
    }
  }, [])
  return (
    <div className="home-maps" ref={ref}>
      {MAPS.map((name, i) => (
        <DepthMap key={name} name={name} index={i} />
      ))}
    </div>
  )
}
