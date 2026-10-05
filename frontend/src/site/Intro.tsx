/**
 * The opening: a field of points in loose coloured clusters, like a scatter plot after
 * clustering. The clusters drift, then every point travels to its place in the name ANTON
 * ERNSTSSON, written large in points, and a smaller cluster settles into DATA · AI · SOFTWARE
 * underneath. Then the screen fades and the start page is there. The clusters are decoration,
 * not data.
 *
 * Shown once per visit when the site opens on the start page; a shared link to another page
 * opens straight on its content, and reduced motion skips it. A click, Enter or Escape skips
 * it. Setting `ae-intro-seen` in sessionStorage skips it too (the browser tests do, so they
 * start on the content).
 */
import { useEffect, useRef, useState } from 'react'
import './intro.css'

const SKIP = 'ae-intro-seen'
const NAME = 'ANTON ERNSTSSON'
const FIELDS = 'DATA · AI · SOFTWARE'
const COLOURS = [
  '#4e79a7',
  '#887ec8',
  '#559266',
  '#c77561',
  '#b48a32',
  '#5aa3b0',
]
const INK = [242, 240, 236]

/** Milliseconds: clusters drift, the name forms, the fields form, the screen leaves. */
const DRIFT = 1200
const FORM = 1500
const FIELDS_AT = DRIFT + 1500
const FIELDS_FORM = 1100
const LEAVE_AT = FIELDS_AT + FIELDS_FORM + 1700

type Point = {
  x0: number
  y0: number
  tx: number
  ty: number
  cx: number
  cy: number
  phase: number
  radius: number
  delay: number
  start: number
  form: number
  rgb: number[]
  size: number
}

function shouldShow() {
  const hash = window.location.hash
  if (hash && !['#start', '#'].includes(hash)) return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return false
  try {
    return sessionStorage.getItem(SKIP) !== '1'
  } catch {
    return true
  }
}

/** Where the text's pixels are, sampled on a grid: the targets the points travel to. */
function sample(
  lines: string[],
  font: (size: number) => string,
  size: number,
  centreY: number,
  width: number,
  height: number,
  step: number,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font(size)
  const lineHeight = size * 1.05
  lines.forEach((line, i) =>
    ctx.fillText(
      line,
      width / 2,
      centreY + (i - (lines.length - 1) / 2) * lineHeight,
    ),
  )
  const data = ctx.getImageData(0, 0, width, height).data
  const out: [number, number][] = []
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step)
      if (data[(y * width + x) * 4 + 3] > 140) out.push([x, y])
  return out
}

/** The largest font size, up to `max`, at which every line fits in `room` pixels. */
function fit(
  lines: string[],
  font: (size: number) => string,
  max: number,
  room: number,
) {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return max
  ctx.font = font(100)
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width))
  return Math.min(max, (100 * room) / widest)
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

function build(width: number, height: number): Point[] {
  const narrow = width < 720
  const nameLines = narrow ? ['ANTON', 'ERNSTSSON'] : [NAME]
  const font = (s: number) => `800 ${s}px Helvetica, Arial, sans-serif`
  const fieldFont = (s: number) => `700 ${s}px Helvetica, Arial, sans-serif`
  const nameSize = fit(nameLines, font, 160, width * 0.86)
  const step = Math.max(3, Math.round(nameSize / 22))
  const nameY = height * 0.44
  const name = sample(nameLines, font, nameSize, nameY, width, height, step)
  const fieldSize = fit([FIELDS], fieldFont, nameSize * 0.42, width * 0.8)
  const blockBottom = nameY + (nameLines.length * nameSize * 1.05) / 2
  const fields = sample(
    [FIELDS],
    fieldFont,
    fieldSize,
    blockBottom + fieldSize * 1.3,
    width,
    height,
    Math.max(2, Math.round(fieldSize / 14)),
  )
  // Six clusters spread over the screen, each a gaussian blob of its own colour.
  const centres = COLOURS.map((colour, i) => {
    const angle = (i / COLOURS.length) * Math.PI * 2 + 0.4
    return {
      x: width / 2 + Math.cos(angle) * width * (0.26 + Math.random() * 0.1),
      y: height / 2 + Math.sin(angle) * height * (0.24 + Math.random() * 0.08),
      spread: Math.min(width, height) * (0.05 + Math.random() * 0.05),
      rgb: hex(colour),
    }
  })
  const gauss = () =>
    Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) *
    Math.cos(2 * Math.PI * Math.random())
  const point = (
    [tx, ty]: [number, number],
    start: number,
    form: number,
    size: number,
  ): Point => {
    const c = centres[Math.floor(Math.random() * centres.length)]
    const x0 = c.x + gauss() * c.spread
    const y0 = c.y + gauss() * c.spread
    return {
      x0,
      y0,
      tx,
      ty,
      cx: c.x,
      cy: c.y,
      phase: Math.random() * Math.PI * 2,
      radius: 4 + Math.random() * 10,
      // Points nearer the left of the name leave their cluster a little earlier.
      delay: (tx / width) * 450 + Math.random() * 250,
      start,
      form,
      rgb: c.rgb,
      size: Math.max(1, size * (0.32 + Math.random() * 0.18)),
    }
  }
  return [
    ...name.map((t) => point(t, DRIFT, FORM, step)),
    ...fields.map((t) =>
      point(t, FIELDS_AT, FIELDS_FORM, Math.max(2, Math.round(fieldSize / 14))),
    ),
  ]
}

export default function Intro() {
  const [phase, setPhase] = useState<'in' | 'leave' | 'gone'>(() =>
    shouldShow() ? 'in' : 'gone',
  )
  const canvas = useRef<HTMLCanvasElement>(null)

  const leave = (fast = false) => {
    setPhase((current) => (current === 'in' ? 'leave' : current))
    window.setTimeout(() => setPhase('gone'), fast ? 250 : 800)
  }

  useEffect(() => {
    if (phase !== 'in') return
    try {
      sessionStorage.setItem(SKIP, '1')
    } catch {
      /* storage blocked: the intro shows again on reload */
    }
    document.body.style.overflow = 'hidden'
    const el = canvas.current
    const ctx = el?.getContext('2d')
    const width = window.innerWidth
    const height = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let frame = 0
    if (el && ctx) {
      el.width = width * dpr
      el.height = height * dpr
      el.style.width = `${width}px`
      el.style.height = `${height}px`
      ctx.scale(dpr, dpr)
      const points = build(width, height)
      const began = performance.now()
      const draw = (now: number) => {
        const t = now - began
        ctx.clearRect(0, 0, width, height)
        for (const p of points) {
          // Drifting: each point circles slowly around its place in the cluster.
          const wobble = t / 900 + p.phase
          const dx = p.x0 + Math.cos(wobble) * p.radius
          const dy = p.y0 + Math.sin(wobble) * p.radius
          const k = ease(
            Math.min(1, Math.max(0, (t - p.start - p.delay) / p.form)),
          )
          const x = dx + (p.tx - dx) * k
          const y = dy + (p.ty - dy) * k
          const r = Math.round(p.rgb[0] + (INK[0] - p.rgb[0]) * k)
          const g = Math.round(p.rgb[1] + (INK[1] - p.rgb[1]) * k)
          const b = Math.round(p.rgb[2] + (INK[2] - p.rgb[2]) * k)
          ctx.fillStyle = `rgba(${r},${g},${b},${0.55 + 0.45 * k})`
          ctx.beginPath()
          ctx.arc(x, y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
        frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    }
    const timer = window.setTimeout(() => leave(), LEAVE_AT)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        leave(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // leave uses only stable setters.
  }, [phase === 'gone'])

  if (phase === 'gone') return null
  return (
    <div
      className={`intro-screen${phase === 'leave' ? ' leaving' : ''}`}
      aria-hidden="true"
      onClick={() => leave(true)}
    >
      <canvas ref={canvas} className="intro-canvas" />
    </div>
  )
}
