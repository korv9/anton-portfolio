import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BACKDROP_COLOURS, groupBackdropPoints } from './backdropGeometry'
import { largeJobClusters } from './jobClusterDisplay'
import {
  loadJobDetail,
  loadSymbolicDetail,
  type UmapScene,
} from './umapIntroData'

export default function ClusterPreview({
  kind,
  background = false,
}: {
  kind: 'jobs' | 'symbolic'
  background?: boolean
}) {
  const figure = useRef<HTMLElement>(null)
  const space = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const mainCanvas = useRef<HTMLCanvasElement>(null)
  const ghostCanvas = useRef<HTMLCanvasElement>(null)
  const [host, setHost] = useState<Element | null>(null)
  const [points, setPoints] = useState<UmapScene['points']>([])
  const [failed, setFailed] = useState(false)
  const ready = points.length > 0
  const layers = useMemo(() => groupBackdropPoints(points), [points])

  useEffect(() => {
    const el = figure.current
    const anchor = document.querySelector(
      kind === 'jobs'
        ? '#projects-title'
        : '.work-card[href="#symbolic-atlas"] .work-title',
    )
    if (!el || !anchor || !el.parentElement) return
    const align = () => {
      if (innerWidth <= 760) {
        el.style.removeProperty('--cluster-anchor-y')
        return
      }
      const target = anchor.getBoundingClientRect()
      const normalTop =
        el.getBoundingClientRect().top -
        parseFloat(getComputedStyle(el).marginTop)
      el.style.setProperty(
        '--cluster-anchor-y',
        `${target.top + target.height / 2 - normalTop - (kind === 'jobs' ? 80 : 0)}px`,
      )
    }
    const observer = new ResizeObserver(align)
    observer.observe(anchor)
    observer.observe(el.parentElement)
    align()
    return () => observer.disconnect()
  }, [kind])

  useEffect(() => {
    const el = figure.current
    if (!el) return
    let active = true
    if (background) setHost(el.closest('.home-shell'))
    const load = kind === 'jobs' ? loadJobDetail : loadSymbolicDetail
    load()
      .then((data) => {
        if (!active) return
        const displayed = kind === 'jobs' ? largeJobClusters(data) : data
        setPoints(displayed)
        setFailed(!displayed.length)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [kind, background])

  useEffect(() => {
    if (!layers.length || !space.current) return
    const draw = () => {
      for (const el of [mainCanvas.current, ghostCanvas.current]) {
        const ctx = el?.getContext('2d')
        if (!el || !ctx) continue
        const size = el.clientWidth
        const dpr = Math.min(devicePixelRatio || 1, 3)
        el.width = el.height = Math.ceil(size * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const css = getComputedStyle(el)
        const colours = BACKDROP_COLOURS.map((token) =>
          css.getPropertyValue(token).trim(),
        )
        const scale = size / 1000
        for (const [i, layer] of layers.entries()) {
          const colour =
            layer.cluster < 0
              ? css.getPropertyValue('--cluster-noise').trim()
              : colours[layer.cluster % colours.length]
          const depth = 0.72 + (i % 6) * 0.13
          const strength =
            layer.cluster < 0
              ? 40
              : i % 6 >= 4
                ? 100
                : (kind === 'jobs' ? 82 : 68) + (i % 6) * 6
          ctx.fillStyle =
            kind === 'jobs'
              ? `color-mix(in srgb, ${colour} 12%, color-mix(in srgb, ${css.getPropertyValue('--ink-identity').trim()} ${24 + (i % 6) * 2}%, ${css.getPropertyValue('--page').trim()}))`
              : `color-mix(in srgb, ${colour} ${strength}%, ${css.getPropertyValue('--page').trim()})`
          for (const [index, p] of layer.points.entries()) {
            ctx.beginPath()
            ctx.arc(
              p.x * scale,
              p.y * scale,
              (0.95 + (index % 7) * 0.09) * scale * depth,
              0,
              Math.PI * 2,
            )
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1
      }
    }
    const observer = new ResizeObserver(draw)
    observer.observe(space.current)
    if (ghost.current) observer.observe(ghost.current)
    draw()
    return () => observer.disconnect()
  }, [layers, host, kind])

  useEffect(() => {
    if (CSS.supports('animation-timeline: view()')) return
    const el = figure.current
    if (!el) return
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let ratio = 0
    const update = () => {
      const strength = preference.matches ? 1 : Math.min(1, ratio * 2)
      if (space.current) space.current.style.opacity = String(strength)
      const caption = el.querySelector('figcaption')
      if (caption) caption.style.opacity = String(strength)
      if (ghost.current)
        ghost.current.style.opacity = String(0.02 * (1 - strength))
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        ratio = entry.intersectionRatio
        update()
      },
      { threshold: Array.from({ length: 41 }, (_, i) => i / 40) },
    )
    observer.observe(el)
    preference.addEventListener('change', update)
    return () => {
      observer.disconnect()
      preference.removeEventListener('change', update)
    }
  }, [points.length])

  return (
    <>
      <figure
        className="home-cluster-preview"
        data-kind={kind}
        ref={figure}
        data-ready={ready}
        data-points={points.length}
      >
        <div
          className="home-cluster-space"
          ref={space}
          role={ready ? 'img' : undefined}
          aria-label={
            ready
              ? `UMAP projection of ${kind === 'jobs' ? 'IT job ads' : 'symbolic occurrences'}, colored by cluster`
              : undefined
          }
        >
          {points.length ? (
            <canvas ref={mainCanvas} aria-hidden="true" />
          ) : (
            <p role="status">
              {failed ? 'Visualization unavailable.' : 'Loading UMAP…'}
            </p>
          )}
        </div>
        {kind === 'jobs' && <figcaption>UMAP of IT job ads</figcaption>}
      </figure>
      {host &&
        createPortal(
          <div
            className="home-cluster-ghost"
            data-kind={kind}
            ref={ghost}
            aria-hidden="true"
          >
            {points.length > 0 ? <canvas ref={ghostCanvas} /> : null}
          </div>,
          host,
        )}
    </>
  )
}
