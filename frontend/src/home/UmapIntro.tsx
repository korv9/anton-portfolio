import { useEffect, useMemo, useRef, useState } from 'react'
import { l } from '../i18n'
import { BACKDROP_COLOURS } from './backdropGeometry'
import type { UmapScene } from './umapIntroData'
import { morphPosition, morphStageAt, prepareMorphFrame } from './umapMorph'

export default function UmapIntro({
  scenes,
  paused,
  complete,
  onComplete,
}: {
  scenes: UmapScene[]
  paused: boolean
  complete: boolean
  onComplete: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const elapsed = useRef(0)
  const count = useRef(innerWidth < 760 ? 1100 : 2400).current
  const frames = useMemo(
    () => scenes.map((scene) => prepareMorphFrame(scene.points, count)),
    [scenes, count],
  )
  const [stage, setStage] = useState({ from: 0, to: 0 })

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !frames.length || complete) return
    const css = getComputedStyle(el)
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    const sample = probe.getContext('2d')!
    const channels = (colour: string) => {
      sample.fillStyle = colour
      sample.fillRect(0, 0, 1, 1)
      return [...sample.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const colours = BACKDROP_COLOURS.map((token) =>
      channels(css.getPropertyValue(token).trim()),
    )
    const noise = channels(css.getPropertyValue('--cluster-noise').trim())
    const colour = (cluster: number) =>
      cluster < 0 ? noise : colours[cluster % colours.length]
    let scale = 1
    let frame = 0
    let previous = 0
    let painted = 0
    let stageKey = ''
    const draw = () => {
      const current = morphStageAt(elapsed.current, scenes.length)
      ctx.clearRect(0, 0, 1000, 1000)
      const key = `${current.from}:${current.to}`
      if (key !== stageKey) {
        stageKey = key
        setStage({ from: current.from, to: current.to })
      }
      const a = frames[current.from]
      const b = frames[current.to]
      for (let i = 0; i < count; i++) {
        const position = morphPosition(a[i], b[i], current.progress, i)
        const ca = colour(a[i].c)
        const cb = colour(b[i].c)
        const rgb = ca.map((value, channel) =>
          Math.round(value + (cb[channel] - value) * position.blend),
        )
        ctx.fillStyle = `rgb(${rgb.join(',')})`
        ctx.globalAlpha = Math.min(1, elapsed.current / 60)
        ctx.beginPath()
        ctx.arc(position.x, position.y, 1.45 + (i % 5) * 0.12, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (current.done) onComplete()
    }
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      scale = (el.clientWidth * dpr) / 1000
      el.width = Math.ceil(el.clientWidth * dpr)
      el.height = Math.ceil(el.clientHeight * dpr)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      draw()
    }
    const tick = (now: number) => {
      if (previous) elapsed.current += now - previous
      previous = now
      const ended = morphStageAt(elapsed.current, scenes.length).done
      if (now - painted >= 32 || ended) {
        painted = now
        draw()
      }
      if (!ended) frame = requestAnimationFrame(tick)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    if (!paused) frame = requestAnimationFrame(tick)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [scenes, frames, count, paused, complete, onComplete])

  return (
    <div
      className="home-umap-intro"
      data-shape={scenes[stage.to].id}
      data-morphing={stage.from !== stage.to}
    >
      <div className="home-backdrop-intro">
        <canvas ref={canvas} />
      </div>
      <p className="home-intro-label">
        {l(scenes[stage.from].en, scenes[stage.from].sv)}
        {stage.to !== stage.from && (
          <> → {l(scenes[stage.to].en, scenes[stage.to].sv)}</>
        )}
      </p>
    </div>
  )
}
