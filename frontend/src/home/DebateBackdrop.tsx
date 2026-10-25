import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { loadDebateMap } from '../clusters/debateData'
import type { ClusterPoint } from '../clusters/ClusterScatter'
import { WARM_TONES, groupBackdropPoints } from './backdropGeometry'

let introPlayed = false
/** The longest a cluster takes to arrive: its glide plus the last stagger (home.css). */
const ARRIVAL = 2400
/** A map later than this after mount fades in where it stands: no fly-in under text being read. */
const LATE = 1200

/**
 * Real UMAP points in cluster layers; CSS supplies floating motion and pointer parallax. On the
 * first visit each cluster glides in from its own side of the screen and they settle into the map.
 * The name never waits for it, and the map stops moving once the hero is off screen.
 */
export default function DebateBackdrop({
  playIntro = true,
}: {
  playIntro?: boolean
}) {
  const allowIntro = useRef(playIntro).current
  const backdrop = useRef<HTMLDivElement>(null)
  const foregroundBackdrop = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const canvases = useRef(new Map<string, HTMLCanvasElement>())
  const [points, setPoints] = useState<ClusterPoint[]>([])
  const [hidden, setHidden] = useState(document.hidden)
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [intro, setIntro] = useState<'true' | 'late' | 'false'>('false')
  const [heroVisible, setHeroVisible] = useState(true)
  const layers = useMemo(() => groupBackdropPoints(points), [points])
  const still = hidden || reduced || !heroVisible

  useEffect(() => {
    let active = true
    let timer = 0
    const mounted = performance.now()
    loadDebateMap()
      .then((map) => {
        if (!active) return
        setPoints(map.points)
        if (allowIntro && !introPlayed && !reduced) {
          if (performance.now() - mounted > LATE) setIntro('late')
          else {
            setIntro('true')
            timer = window.setTimeout(() => setIntro('false'), ARRIVAL)
          }
        }
        introPlayed = true
      })
      // An unavailable map leaves the decoration absent.
      .catch(() => {})
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [reduced, allowIntro])

  useEffect(() => {
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])

  useEffect(() => {
    const identity = document.getElementById('start')
    if (!identity) return
    const observer = new IntersectionObserver(([entry]) =>
      setHeroVisible(entry.isIntersecting),
    )
    observer.observe(identity)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (CSS.supports('animation-timeline: scroll()') || reduced) return
    const identity = document.getElementById('start')
    const el = backdrop.current
    if (!identity || !el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        el.style.opacity = String(0.055 + entry.intersectionRatio * 0.945)
        if (foregroundBackdrop.current)
          foregroundBackdrop.current.style.opacity = String(
            entry.intersectionRatio,
          )
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    )
    observer.observe(identity)
    return () => {
      observer.disconnect()
      el.style.removeProperty('opacity')
      foregroundBackdrop.current?.style.removeProperty('opacity')
    }
  }, [reduced])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(preference.matches)
    preference.addEventListener('change', change)
    return () => preference.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const el = scene.current
    if (!el || !layers.length) return
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      for (const layer of layers) {
        for (const foreground of [false, true]) {
          const canvas = canvases.current.get(`${foreground}:${layer.cluster}`)
          if (!canvas) continue
          const width = canvas.clientWidth
          const height = canvas.clientHeight
          canvas.width = Math.ceil(width * dpr)
          canvas.height = Math.ceil(height * dpr)
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          const k = width / layer.width
          ctx.fillStyle = getComputedStyle(canvas).color
          ctx.globalAlpha = 1
          for (const [i, p] of layer.points.entries()) {
            ctx.beginPath()
            ctx.arc(
              (p.x - layer.left) * k,
              ((p.y - layer.top) * height) / layer.height,
              (0.85 + (i % 7) * 0.07) * k,
              0,
              Math.PI * 2,
            )
            ctx.fill()
          }
        }
      }
    }
    const observer = new ResizeObserver(draw)
    observer.observe(el)
    draw()
    return () => observer.disconnect()
  }, [layers])

  useEffect(() => {
    const el = backdrop.current
    if (!el || still) return
    let frame = 0
    let x = 0
    let y = 0
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      x = (event.clientX / innerWidth - 0.5) * 52
      y = (event.clientY / innerHeight - 0.5) * 38
      if (frame) return
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--pointer-x', `${x}px`)
        el.style.setProperty('--pointer-y', `${y}px`)
        foregroundBackdrop.current?.style.setProperty('--pointer-x', `${x}px`)
        foregroundBackdrop.current?.style.setProperty('--pointer-y', `${y}px`)
        frame = 0
      })
    }
    const reset = () => {
      cancelAnimationFrame(frame)
      frame = 0
      el.style.setProperty('--pointer-x', '0px')
      el.style.setProperty('--pointer-y', '0px')
      foregroundBackdrop.current?.style.setProperty('--pointer-x', '0px')
      foregroundBackdrop.current?.style.setProperty('--pointer-y', '0px')
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', reset)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', reset)
    }
  }, [still])

  const renderLayers = (foreground: boolean) => (
    <div className="home-backdrop-scene" ref={foreground ? undefined : scene}>
      {layers.map((layer, i) =>
        foreground && (layer.cluster < 0 || i % 6 < 4) ? null : (
          <div
            className="home-backdrop-layer"
            key={layer.cluster}
            style={
              {
                left: `${layer.left / 10}%`,
                top: `${layer.top / 10}%`,
                width: `${layer.width / 10}%`,
                height: `${layer.height / 10}%`,
                '--depth': 0.45 + (i % 6) * 0.2,
                '--point-strength': `${foreground ? 100 : layer.cluster < 0 ? 40 : 62}%`,
                '--float-x': `${8 + (i % 5) * 3}px`,
                '--float-y': `${6 + (i % 7) * 2}px`,
                '--float-time': `${14 + (i % 9) * 1.5}s`,
                '--float-delay': `${-i * 2.7}s`,
                '--float-direction': i % 2 ? 'alternate-reverse' : 'alternate',
                // The golden angle spreads the clusters' ways in around the whole screen.
                '--from-x': `${Math.round(Math.cos(i * 2.4) * 95)}vmax`,
                '--from-y': `${Math.round(Math.sin(i * 2.4) * 95)}vmax`,
                '--arrive-delay': `${(i % 12) * 55}ms`,
                '--point-colour':
                  layer.cluster < 0
                    ? WARM_TONES[4]
                    : WARM_TONES[layer.cluster % 6],
              } as CSSProperties
            }
          >
            <canvas
              ref={(el) => {
                const key = `${foreground}:${layer.cluster}`
                if (el) canvases.current.set(key, el)
                else canvases.current.delete(key)
              }}
            />
          </div>
        ),
      )}
    </div>
  )
  return (
    <>
      <div
        className="home-backdrop"
        ref={backdrop}
        aria-hidden="true"
        data-paused={still}
        data-ready={points.length > 0}
        data-points={points.length}
        data-intro={intro}
      >
        {renderLayers(false)}
      </div>
      <div
        className="home-backdrop-foreground"
        ref={foregroundBackdrop}
        aria-hidden="true"
        data-paused={still}
        data-ready={points.length > 0}
        data-intro={intro}
      >
        {renderLayers(true)}
      </div>
    </>
  )
}
