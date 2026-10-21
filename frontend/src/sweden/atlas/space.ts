/**
 * The atlas "space": the dark, starry three.js stage every atlas scene draws into. It owns the
 * renderer, camera, orbit controls and the small drawing vocabulary the scenes share: glows,
 * threads, web floors and ghost boxes (dashed outlines for what has no data).
 *
 * Scenes add labels as `Tag`s anchored to 3D points; the page projects them to the screen after
 * every camera change. It renders on change only and caps the pixel ratio at 2.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type Tone = 'mono' | 'lab' | 'gap' | 'warm' | 'title'
export type Anchor = 'center' | 'left' | 'right' | 'above' | 'below'
export type Tag = {
  at: THREE.Vector3
  lines: string[]
  /** The first line is drawn stronger. */
  head?: boolean
  tone?: Tone
  anchor?: Anchor
  colour?: string
  dx?: number
  dy?: number
  /** Makes the label a link. */
  href?: string
  /** Makes the label a button. */
  onClick?: () => void
  /** For a button label: whether it is the current choice. */
  pressed?: boolean
}

export type View = {
  camera: [number, number, number]
  target: [number, number, number]
  fov?: number
  fog?: number
  /** Horizontal view offset in px on wide screens; negative moves the subject right. */
  shift?: number
}

export const WARM = 0xf2a65a
export const ACCENT = 0xc9bcf2
export const GAP = 0xaab6cf

let glowTexture: THREE.Texture | null = null
function glowTex() {
  if (glowTexture) return glowTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.25, '#ffffffcc')
  g.addColorStop(1, '#ffffff00')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  glowTexture = new THREE.CanvasTexture(c)
  return glowTexture
}

export type Space = ReturnType<typeof createSpace>

export function createSpace(el: HTMLElement, view: View) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
  renderer.setClearColor(0x07070a)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x07070a, view.fog ?? 0.00025)
  const camera = new THREE.PerspectiveCamera(view.fov ?? 36, 1, 1, 9000)
  camera.position.set(...view.camera)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2836, 1.1))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(-300, 600, 400)
  scene.add(sun)

  // Stars: fixed seed, so the sky is the same on every visit.
  let seed = 5
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  {
    const n = 2800
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 2200 + rnd() * 3000
      const t = rnd() * Math.PI * 2
      const p = Math.acos(2 * rnd() - 1)
      a.set(
        [
          r * Math.sin(p) * Math.cos(t),
          r * Math.cos(p),
          r * Math.sin(p) * Math.sin(t),
        ],
        i * 3,
      )
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(a, 3))
    scene.add(
      new THREE.Points(
        g,
        new THREE.PointsMaterial({
          color: 0xbfb8d8,
          size: 1.5,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.5,
          fog: false,
        }),
      ),
    )
  }

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(...view.target)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxDistance = 4000
  controls.minDistance = 40

  // One draw per frame: while damping, controls.update() fires 'change', which queues the next.
  let frame = 0
  const draw = () => {
    frame = 0
    controls.update()
    renderer.render(scene, camera)
  }
  const render = () => {
    if (!frame) frame = requestAnimationFrame(draw)
  }
  controls.addEventListener('change', render)

  const resize = () => {
    const w = el.clientWidth
    const h = el.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    const shift = w > 1000 ? (view.shift ?? -170) : 0
    camera.setViewOffset(w, h, shift, 0, w, h)
    camera.updateProjectionMatrix()
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(el)
  resize()

  const fade = (o: number) => ({
    transparent: true,
    opacity: o,
    depthWrite: false,
  })
  const space = {
    THREE,
    scene,
    camera,
    controls,
    renderer,
    rnd,
    render,
    /** Objects a click in the scene can choose; the page raycasts against them. */
    picks: [] as { obj: THREE.Object3D; fn: () => void }[],
    pickable<T extends THREE.Object3D>(obj: T, fn: () => void) {
      space.picks.push({ obj, fn })
      return obj
    },
    glow(at: THREE.Vector3, size: number, colour = WARM, opacity = 1) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex(),
          color: colour,
          ...fade(opacity),
        }),
      )
      s.scale.set(size, size, 1)
      s.position.copy(at)
      scene.add(s)
      return s
    },
    line(
      points: THREE.Vector3[],
      colour = ACCENT,
      opacity = 0.4,
      dash?: [number, number],
    ) {
      const g = new THREE.BufferGeometry().setFromPoints(points)
      const m = dash
        ? new THREE.LineDashedMaterial({
            color: colour,
            dashSize: dash[0],
            gapSize: dash[1],
            ...fade(opacity),
          })
        : new THREE.LineBasicMaterial({ color: colour, ...fade(opacity) })
      const l = new THREE.Line(g, m)
      if (dash) l.computeLineDistances()
      scene.add(l)
      return l
    },
    arc(a: THREE.Vector3, b: THREE.Vector3, lift: number, steps = 40) {
      const mid = a.clone().lerp(b, 0.5)
      mid.y += lift
      return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(steps)
    },
    /** A dashed outline where data is missing: drawn, never filled. */
    ghost(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      opacity = 0.6,
    ) {
      const e = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
        new THREE.LineDashedMaterial({
          color: GAP,
          dashSize: 2,
          gapSize: 2,
          ...fade(opacity),
        }),
      )
      e.computeLineDistances()
      e.position.set(x, y + h / 2, z)
      scene.add(e)
      return e
    },
    /** A spider-web floor of rings and spokes. */
    web(y: number, r: number, opacity = 0.06, rings = 5, spokes = 28) {
      for (let k = 1; k <= rings; k++) {
        const pts: THREE.Vector3[] = []
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * Math.PI * 2
          pts.push(
            new THREE.Vector3(
              (Math.cos(a) * r * k) / rings,
              y,
              (Math.sin(a) * r * k) / rings,
            ),
          )
        }
        space.line(pts, ACCENT, opacity)
      }
      for (let s = 0; s < spokes; s++) {
        const a = (s / spokes) * Math.PI * 2
        space.line(
          [
            new THREE.Vector3(0, y, 0),
            new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
          ],
          ACCENT,
          opacity * 0.7,
        )
      }
    },
    project(v: THREE.Vector3): [number, number] | null {
      camera.updateMatrixWorld()
      const p = v.clone().project(camera)
      if (p.z > 1) return null
      return [
        ((p.x + 1) / 2) * el.clientWidth,
        ((1 - p.y) / 2) * el.clientHeight,
      ]
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
  return space
}
