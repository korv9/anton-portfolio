/**
 * Every cluster map on the site as a small picture, drawn from the same data as the map
 * itself (clusters/ClusterVisualsPage MAPS). A picture loads when it comes near the screen;
 * pressing it opens the full, interactive map in a dialog.
 */
import { useEffect, useRef, useState } from 'react'
import ClusterScatter, { type ClusterPoint } from '../clusters/ClusterScatter'
import {
  CLUSTER_COLOURS,
  projectClusterPoints,
} from '../clusters/clusterGeometry'
import { MAPS, type Loaded, type MapSpec } from '../clusters/ClusterVisualsPage'

type Item = { spec: MapSpec; variant: MapSpec['variants'][number] }

const W = 320
const H = 200

function Thumb({ points }: { points: ClusterPoint[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    el.width = W * dpr
    el.height = H * dpr
    const ctx = el.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const css = getComputedStyle(el)
    const colours = CLUSTER_COLOURS.map((v) => css.getPropertyValue(v).trim())
    const noise = css.getPropertyValue('--cv-oat').trim()
    const { sx, sy } = projectClusterPoints(points, W, H, 8)
    // A picture this small needs a few thousand points at most.
    const step = Math.max(1, Math.ceil(points.length / 6000))
    const r = points.length > 2000 ? 1 : 1.8
    for (const pass of [true, false])
      for (let i = 0; i < points.length; i += step) {
        const p = points[i]
        if (p.c < 0 !== pass) continue
        ctx.globalAlpha = pass ? 0.6 : 0.85
        ctx.fillStyle = pass ? noise : colours[p.c % colours.length]
        ctx.beginPath()
        ctx.arc(sx(p.x), sy(p.y), r, 0, Math.PI * 2)
        ctx.fill()
      }
  }, [points])
  return (
    <canvas
      ref={canvas}
      style={{ width: '100%', aspectRatio: `${W} / ${H}` }}
    />
  )
}

function Card({ item, open }: { item: Item; open: (data: Loaded) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [data, setData] = useState<Loaded | 'error' | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const load = () => item.variant.load().then(setData, () => setData('error'))
    if (typeof IntersectionObserver === 'undefined') return void load()
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        load()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [item])
  const ready = data && data !== 'error' ? data : null
  const many = item.spec.variants.length > 1
  return (
    <li>
      <button
        ref={ref}
        type="button"
        className="umap-card"
        disabled={!ready}
        onClick={() => ready && open(ready)}
      >
        <span className="umap-thumb">
          {ready ? (
            <Thumb points={ready.points} />
          ) : (
            // An empty thumbnail until its points arrive; a missing file stays a quiet blank.
            <span className="tech-meta" aria-busy={data !== 'error'} />
          )}
        </span>
        <b>
          {item.spec.title}
          {many ? `, ${item.variant.label.toLowerCase()}` : ''}
        </b>
        <span className="tech-meta">
          {item.spec.project}
          {ready
            ? ` · ${(ready.population?.observations ?? ready.points.length).toLocaleString('en-GB')} points`
            : ''}
        </span>
      </button>
    </li>
  )
}

export default function UmapGallery() {
  const [items] = useState<Item[]>(() =>
    MAPS().flatMap((spec) =>
      spec.variants.map((variant) => ({ spec, variant })),
    ),
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const [shown, setShown] = useState<{ item: Item; data: Loaded } | null>(null)
  useEffect(() => {
    if (shown) dialog.current?.showModal()
  }, [shown])
  return (
    <>
      <ul className="umap-grid">
        {items.map((item) => (
          <Card
            key={`${item.spec.id}-${item.variant.key}`}
            item={item}
            open={(data) => setShown({ item, data })}
          />
        ))}
      </ul>
      <dialog
        ref={dialog}
        className="umap-dialog"
        aria-labelledby="umap-dialog-title"
        onClose={() => setShown(null)}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
      >
        {shown && (
          <div className="umap-dialog-body">
            <header>
              <div>
                <h3 id="umap-dialog-title">{shown.item.spec.title}</h3>
                <p className="tech-meta">
                  {shown.item.spec.project} · {shown.data.method.join(' · ')}
                </p>
              </div>
              <button type="button" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </header>
            <ClusterScatter
              points={shown.data.points}
              name={shown.data.name}
              label={shown.item.spec.title}
              height={620}
            />
            <p>{shown.item.spec.meaning}</p>
            <a href={shown.item.spec.href}>Open in {shown.item.spec.project}</a>
          </div>
        )}
      </dialog>
    </>
  )
}
