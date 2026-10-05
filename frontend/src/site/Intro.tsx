/**
 * The opening: a field of points in organic coloured clusters, each grown as branching
 * filaments with thin veins running from every point in towards the cluster's core, like the
 * rings and veins of the project figures. The clusters breathe, then every point travels to its
 * place in the name ANTON ERNSTSSON, written large in points; the cluster veins let go and the
 * letters are stitched together by veins of their own. A smaller cluster settles into
 * DATA · AI · SOFTWARE underneath. Then the screen fades and the start page is there. The
 * clusters are decoration, not data.
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
const DRIFT = 1400
const FORM = 1600
const FIELDS_AT = DRIFT + 1600
const FIELDS_FORM = 1100
const LEAVE_AT = FIELDS_AT + FIELDS_FORM + 1700

type Branch = { nodes: [number, number][]; rgb: number[] }

type Point = {
  /** Resting place in the cluster, and the spine node its vein runs to. */
  x0: number
  y0: number
  ax: number
  ay: number
  /** Place in the text, and the neighbour in the text its vein runs to. */
  tx: number
  ty: number
  link: number
  link2: number
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

/**
 * Where the text's pixels are, sampled on a grid and nudged off it so the letters read as
 * grown, not printed: the targets the points travel to.
 */
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
      if (data[(y * width + x) * 4 + 3] > 140)
        out.push([
          x + (Math.random() - 0.5) * step * 0.7,
          y + (Math.random() - 0.5) * step * 0.7,
        ])
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

/**
 * For every target, one of its few nearest neighbours (offset by `base`): the veins that
 * stitch the letters together once the points have arrived.
 */
function neighbours(targets: [number, number][], cell: number, base: number) {
  const grid = new Map<string, number[]>()
  const key = (x: number, y: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)}`
  targets.forEach(([x, y], i) => {
    const k = key(x, y)
    const list = grid.get(k)
    if (list) list.push(i)
    else grid.set(k, [i])
  })
  return targets.map(([x, y], i) => {
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    const near: [number, number][] = []
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gy = cy - 1; gy <= cy + 1; gy++)
        for (const j of grid.get(`${gx},${gy}`) ?? []) {
          if (j === i) continue
          const d = (targets[j][0] - x) ** 2 + (targets[j][1] - y) ** 2
          near.push([d, j])
        }
    if (!near.length) return -1
    near.sort((a, b) => a[0] - b[0])
    const pick = near[Math.floor(Math.random() * Math.min(3, near.length))]
    return base + pick[1]
  })
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const gauss = () =>
  Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) *
  Math.cos(2 * Math.PI * Math.random())

/**
 * One organic cluster: a few curving filaments grown from a core by a random walk, each a
 * chain of nodes. Points settle around the nodes, thicker near the core.
 */
function grow(x: number, y: number, reach: number, rgb: number[]): Branch[] {
  const count = 4 + Math.floor(Math.random() * 3)
  const branches: Branch[] = []
  for (let b = 0; b < count; b++) {
    let angle = (b / count) * Math.PI * 2 + Math.random() * 0.8
    const nodes: [number, number][] = [[x, y]]
    const steps = 7 + Math.floor(Math.random() * 6)
    const length = reach * (0.6 + Math.random() * 0.8)
    for (let i = 1; i <= steps; i++) {
      angle += gauss() * 0.32
      const [px, py] = nodes[i - 1]
      nodes.push([
        px + Math.cos(angle) * (length / steps),
        py + Math.sin(angle) * (length / steps),
      ])
    }
    branches.push({ nodes, rgb })
    // A side shoot from somewhere along the filament.
    if (Math.random() < 0.7) {
      const from = 2 + Math.floor(Math.random() * (steps - 3))
      let side = angle + (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random())
      const shoot: [number, number][] = [nodes[from]]
      for (let i = 1; i <= 4; i++) {
        side += gauss() * 0.3
        const [px, py] = shoot[i - 1]
        shoot.push([
          px + Math.cos(side) * (length / steps),
          py + Math.sin(side) * (length / steps),
        ])
      }
      branches.push({ nodes: shoot, rgb })
    }
  }
  return branches
}

function build(
  width: number,
  height: number,
): { points: Point[]; branches: Branch[] } {
  const narrow = width < 720
  const nameLines = narrow ? ['ANTON', 'ERNSTSSON'] : [NAME]
  const font = (s: number) => `800 ${s}px Helvetica, Arial, sans-serif`
  const fieldFont = (s: number) => `700 ${s}px Helvetica, Arial, sans-serif`
  const nameSize = fit(nameLines, font, 160, width * 0.86)
  const step = Math.max(4, Math.round(nameSize / 15))
  const nameY = height * 0.44
  const name = sample(nameLines, font, nameSize, nameY, width, height, step)
  const fieldSize = fit([FIELDS], fieldFont, nameSize * 0.42, width * 0.8)
  const fieldStep = Math.max(3, Math.round(fieldSize / 10))
  const blockBottom = nameY + (nameLines.length * nameSize * 1.05) / 2
  const fields = sample(
    [FIELDS],
    fieldFont,
    fieldSize,
    blockBottom + fieldSize * 1.3,
    width,
    height,
    fieldStep,
  )
  // Six clusters spread over the screen, each grown as filaments in its own colour.
  const reach = Math.min(width, height) * 0.17
  const clusters = COLOURS.map((colour, i) => {
    const angle = (i / COLOURS.length) * Math.PI * 2 + 0.4
    const cx =
      width / 2 + Math.cos(angle) * width * (0.27 + Math.random() * 0.08)
    const cy =
      height / 2 + Math.sin(angle) * height * (0.25 + Math.random() * 0.07)
    return grow(cx, cy, reach * (0.75 + Math.random() * 0.5), hex(colour))
  })
  const branches = clusters.flat()
  const point = (
    [tx, ty]: [number, number],
    link: number,
    link2: number,
    start: number,
    form: number,
    size: number,
  ): Point => {
    const cluster = clusters[Math.floor(Math.random() * clusters.length)]
    const branch = cluster[Math.floor(Math.random() * cluster.length)]
    // Denser near the core: the node index leans towards the start of the filament.
    const at = Math.min(
      branch.nodes.length - 1,
      Math.floor(Math.pow(Math.random(), 1.6) * branch.nodes.length),
    )
    const [nx, ny] = branch.nodes[at]
    const spread = reach * 0.11 * (1 - (at / branch.nodes.length) * 0.6)
    const anchor = branch.nodes[Math.max(0, at - 1)]
    return {
      x0: nx + gauss() * spread,
      y0: ny + gauss() * spread,
      ax: anchor[0],
      ay: anchor[1],
      tx,
      ty,
      link,
      link2,
      phase: Math.random() * Math.PI * 2,
      radius: 2 + Math.random() * 6,
      // Points nearer the left of the name leave their cluster a little earlier.
      delay: (tx / width) * 450 + Math.random() * 250,
      start,
      form,
      rgb: branch.rgb,
      size: Math.max(0.8, size * (0.13 + Math.random() * 0.17)),
    }
  }
  const nameLinks = neighbours(name, step * 1.8, 0)
  const nameLinks2 = neighbours(name, step * 1.8, 0)
  const fieldLinks = neighbours(fields, fieldStep * 1.8, name.length)
  const fieldLinks2 = neighbours(fields, fieldStep * 1.8, name.length)
  return {
    points: [
      ...name.map((t, i) =>
        point(t, nameLinks[i], nameLinks2[i], DRIFT, FORM, step),
      ),
      ...fields.map((t, i) =>
        point(
          t,
          fieldLinks[i],
          fieldLinks2[i],
          FIELDS_AT,
          FIELDS_FORM,
          fieldStep,
        ),
      ),
    ],
    branches,
  }
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
      const { points, branches } = build(width, height)
      const began = performance.now()
      const xs = new Float32Array(points.length)
      const ys = new Float32Array(points.length)
      const ks = new Float32Array(points.length)
      const draw = (now: number) => {
        const t = now - began
        ctx.clearRect(0, 0, width, height)
        const breath = Math.sin(t / 1300) * 0.6
        // Where every point is now, and how far it has come towards the text.
        points.forEach((p, i) => {
          const wobble = t / 900 + p.phase
          const dx = p.x0 + Math.cos(wobble) * p.radius
          const dy = p.y0 + Math.sin(wobble) * p.radius
          const k = ease(
            Math.min(1, Math.max(0, (t - p.start - p.delay) / p.form)),
          )
          xs[i] = dx + (p.tx + breath * Math.cos(p.phase) - dx) * k
          ys[i] = dy + (p.ty + breath * Math.sin(p.phase) - dy) * k
          ks[i] = k
        })
        // The filaments fade as the clusters give up their points.
        const held = Math.max(0, 1 - Math.max(0, t - DRIFT) / (FORM * 0.8))
        if (held > 0) {
          ctx.lineWidth = 0.7
          for (const b of branches) {
            ctx.strokeStyle = `rgba(${b.rgb.join(',')},${0.35 * held})`
            ctx.beginPath()
            ctx.moveTo(b.nodes[0][0], b.nodes[0][1])
            for (let i = 1; i < b.nodes.length - 1; i++) {
              const [x1, y1] = b.nodes[i]
              const [x2, y2] = b.nodes[i + 1]
              ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2)
            }
            ctx.stroke()
          }
        }
        ctx.lineWidth = 0.5
        points.forEach((p, i) => {
          const k = ks[i]
          // A vein from the point back to its filament, letting go as it leaves.
          const toCore = 0.22 * (1 - k) * (1 - k)
          if (toCore > 0.01) {
            ctx.strokeStyle = `rgba(${p.rgb.join(',')},${toCore})`
            ctx.beginPath()
            ctx.moveTo(xs[i], ys[i])
            ctx.quadraticCurveTo(
              (xs[i] + p.ax) / 2 + Math.cos(p.phase) * 6,
              (ys[i] + p.ay) / 2 + Math.sin(p.phase) * 6,
              p.ax,
              p.ay,
            )
            ctx.stroke()
          }
          // Veins to two neighbours in the text, once both ends have arrived.
          for (const j of [p.link, p.link2]) {
            if (j < 0) continue
            // Only once both ends have nearly landed, so no vein stretches across the screen.
            const both = (Math.min(k, ks[j]) - 0.85) / 0.15
            if (both <= 0) continue
            ctx.strokeStyle = `rgba(${p.rgb.map((c, n) => Math.round(c + (INK[n] - c) * 0.55)).join(',')},${0.5 * both})`
            ctx.beginPath()
            ctx.moveTo(xs[i], ys[i])
            ctx.quadraticCurveTo(
              (xs[i] + xs[j]) / 2 + Math.cos(p.phase) * 1.5,
              (ys[i] + ys[j]) / 2 + Math.sin(p.phase) * 1.5,
              xs[j],
              ys[j],
            )
            ctx.stroke()
          }
        })
        points.forEach((p, i) => {
          const k = ks[i]
          const m = k * 0.82
          const r = Math.round(p.rgb[0] + (INK[0] - p.rgb[0]) * m)
          const g = Math.round(p.rgb[1] + (INK[1] - p.rgb[1]) * m)
          const b = Math.round(p.rgb[2] + (INK[2] - p.rgb[2]) * m)
          ctx.fillStyle = `rgba(${r},${g},${b},${0.6 + 0.4 * k})`
          ctx.beginPath()
          ctx.arc(xs[i], ys[i], p.size * (1 + 0.3 * k), 0, Math.PI * 2)
          ctx.fill()
        })
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
