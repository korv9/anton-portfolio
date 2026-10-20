/**
 * Sweden's 290 municipalities as extruded 3D shapes on the shared stage (stage.ts), for C, D and
 * the hub. Geometry is SCB's boundaries in SWEREF99 TM, 100 m units (sweden/similarity/
 * geometry.json); one scene unit is 10 km.
 *
 * `t` moves every municipality that has a `target` from its map position (0) to its place in a
 * second space (1), such as C's principal components: the shape lifts, shrinks and travels along
 * a drawn path. The path is a picture of the transformation, not a movement on the ground.
 * Heights and colours arrive normalised; the page keeps the raw values for its panels.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Geometry } from './map'
import {
  createStage,
  ramp,
  toScreen,
  useSwedenThemeValue,
  webgl,
  type Stage,
} from './stage'

export type Place = {
  code: string
  /** A categorical colour, or */
  colour?: string
  /** a position on the page's sequential ramp, 0–1. */
  ramp?: number
  /** Normalised height in [0, 1]; null draws a thin neutral slab (no value). */
  height: number | null
  /** Position in the second space, roughly in [-1, 1]; absent stays on the map. */
  target?: [number, number]
}

const SCALE = 0.01 // 100 m units → 10 km scene units
const TALL = 34

type Built = {
  mesh: THREE.Mesh
  edge: THREE.LineSegments
  gx: number
  gz: number
  px: number
  pz: number
  moves: boolean
  trail: THREE.Line
}

export default function MunicipalityField({
  geo,
  places,
  t = 0,
  trails = true,
  selected,
  marked = [],
  names,
  points,
  onPick,
  label,
  fallback,
  shiftFor,
}: {
  shiftFor?: (width: number) => number
  geo: Geometry
  places: Place[]
  t?: number
  trails?: boolean
  selected: string | null
  /** Codes to outline and label besides the selected one, e.g. nearest neighbours. */
  marked?: string[]
  names: Map<string, string>
  /** Point features in SWEREF99 TM, drawn as lights on their municipality's roof. */
  points?: { x: number; y: number; code: string }[]
  onPick: (code: string) => void
  label: string
  fallback: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [ok] = useState(webgl)
  const [hover, setHover] = useState<string | null>(null)
  const [tags, setTags] = useState<{ text: string; x: number; y: number }[]>([])
  const theme = useSwedenThemeValue()
  const lastTags = useRef('')
  const stageRef = useRef<Stage | null>(null)
  const built = useRef(new Map<string, Built>())
  const pick = useRef(onPick)
  pick.current = onPick
  const latest = useRef({ places, points, t, trails, selected, marked, names })
  latest.current = { places, points, t, trails, selected, marked, names }
  const sig =
    places
      .map(
        (p) =>
          `${p.code}${p.colour}${p.ramp?.toFixed(3)}${p.height?.toFixed(3)}${p.target ? 1 : 0}`,
      )
      .join() + (points?.length ?? 0)

  // Positions for a given t, and the projected labels.
  const pose = () => {
    const stage = stageRef.current
    const el = box.current
    if (!stage || !el) return
    const { t, trails, selected, marked, names } = latest.current
    const e = t * t * (3 - 2 * t)
    for (const b of built.current.values()) {
      const k = b.moves ? e : 0
      const cx = b.gx + (b.px - b.gx) * k
      const cz = b.gz + (b.pz - b.gz) * k
      const lift = k * 46
      const s = 1 - 0.7 * k
      b.mesh.position.set(cx, lift, cz)
      b.mesh.scale.set(s, b.mesh.scale.y, s)
      b.trail.visible = trails && b.moves && k > 0.01
      if (b.trail.visible) {
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(b.gx, 0.05, b.gz),
          new THREE.Vector3(
            b.gx + (cx - b.gx) * 0.2,
            lift * 0.9,
            b.gz + (cz - b.gz) * 0.2,
          ),
          new THREE.Vector3(cx, lift, cz),
        )
        b.trail.geometry.setFromPoints(curve.getPoints(16))
      }
    }
    const show = [selected, ...marked].filter((c): c is string => !!c)
    const next = show.flatMap((code) => {
      const b = built.current.get(code)
      if (!b) return []
      const top = new THREE.Vector3(
        b.mesh.position.x,
        b.mesh.position.y + b.mesh.scale.y + 3,
        b.mesh.position.z,
      )
      const p = toScreen(stage, el, top)
      return p
        ? [
            {
              text: names.get(code) ?? code,
              x: Math.round(p[0]),
              y: Math.round(p[1]),
            },
          ]
        : []
    })
    const key = JSON.stringify(next)
    if (key !== lastTags.current) {
      lastTags.current = key
      setTags(next)
    }
    stage.render()
  }

  useEffect(() => {
    const el = box.current
    if (!ok || !el) return
    const stage = createStage(el, shiftFor)
    stageRef.current = stage
    const { scene, colour } = stage
    const { places, points } = latest.current
    const byCode = new Map(places.map((p) => [p.code, p]))
    const all = geo.municipalities.flatMap((m) => m.rings.flat())
    const xs = all.map((p) => p[0])
    const ys = all.map((p) => p[1])
    const cx0 = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy0 = (Math.min(...ys) + Math.max(...ys)) / 2
    const targets = places.filter((p) => p.target)
    const neutral = colour('--sw-div-mid', '#3a3935')
    const lo = colour('--sw-seq-lo', '#3a3256')
    const hi = colour('--sw-seq-hi', '#e3d8ff')
    const tint = (p: Place) =>
      p.ramp != null
        ? ramp(lo, hi, p.ramp)
        : new THREE.Color(p.colour ?? '#888888')
    const lineMat = new THREE.LineBasicMaterial({
      color: colour('--sw-accent', '#c9bcf2'),
      transparent: true,
      opacity: 0.18,
    })
    built.current.clear()
    // The map stays on the ground as a flat base while the municipalities lift off it.
    const baseMat = new THREE.MeshBasicMaterial({
      color: colour('--sw-base', '#2a2925'),
    })
    for (const m of geo.municipalities) {
      const flat = new THREE.ShapeGeometry(
        m.rings.map(
          (r) =>
            new THREE.Shape(
              r.map(
                ([x, y]) =>
                  new THREE.Vector2((x - cx0) * SCALE, (y - cy0) * SCALE),
              ),
            ),
        ),
      )
      flat.rotateX(-Math.PI / 2)
      const b = new THREE.Mesh(flat, baseMat)
      b.position.y = 0.01
      scene.add(b)
    }
    for (const m of geo.municipalities) {
      const pts = m.rings[0]
      const gx = (pts.reduce((s, p) => s + p[0], 0) / pts.length - cx0) * SCALE
      const gy = (pts.reduce((s, p) => s + p[1], 0) / pts.length - cy0) * SCALE
      const shapes = m.rings.map(
        (r) =>
          new THREE.Shape(
            r.map(
              ([x, y]) =>
                new THREE.Vector2(
                  (x - cx0) * SCALE - gx,
                  (y - cy0) * SCALE - gy,
                ),
            ),
          ),
      )
      const g = new THREE.ExtrudeGeometry(shapes, {
        depth: 1,
        bevelEnabled: false,
      })
      g.rotateX(-Math.PI / 2)
      const place = byCode.get(m.code)
      const mesh = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color: place && place.height != null ? tint(place) : neutral,
          roughness: 0.8,
        }),
      )
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.scale.y = place?.height != null ? 0.6 + place.height * TALL : 0.4
      mesh.userData.code = m.code
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(g, 30),
        new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.18,
        }),
      )
      mesh.add(edge)
      scene.add(mesh)
      const trail = new THREE.Line(new THREE.BufferGeometry(), lineMat)
      scene.add(trail)
      const target = place?.target
      built.current.set(m.code, {
        mesh,
        edge,
        gx,
        gz: -gy,
        px: target ? target[0] * 85 : gx,
        pz: target ? -target[1] * 85 : -gy,
        moves: !!target,
        trail,
      })
    }
    if (points?.length) {
      const lamps = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xff9f43 }),
        points.length,
      )
      const tmp = new THREE.Object3D()
      points.forEach((p, i) => {
        const roof = built.current.get(p.code)?.mesh.scale.y ?? 0.4
        tmp.position.set((p.x - cx0) * SCALE, roof + 0.6, -(p.y - cy0) * SCALE)
        tmp.updateMatrix()
        lamps.setMatrixAt(i, tmp.matrix)
      })
      scene.add(lamps)
    }
    stage.controls.addEventListener('change', pose)
    const moving = targets.length > 0 && latest.current.t > 0.5
    stage.home(
      new THREE.Vector3(0, moving ? 20 : 6, 4),
      moving ? 300 : 250,
      moving ? 1.08 : 0.98,
      0.42,
    )
    pose()

    const meshes = [...built.current.values()].map((b) => b.mesh)
    const ray = new THREE.Raycaster()
    const at = (event: MouseEvent) => {
      const rect = stage.renderer.domElement.getBoundingClientRect()
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        stage.camera,
      )
      return (
        (ray.intersectObjects(meshes, false)[0]?.object.userData.code as
          string | undefined) ?? null
      )
    }
    const move = (e: MouseEvent) => setHover(at(e))
    const click = (e: MouseEvent) => {
      const c = at(e)
      if (c) pick.current(c)
    }
    stage.renderer.domElement.addEventListener('pointermove', move)
    stage.renderer.domElement.addEventListener('click', click)
    return () => {
      stage.renderer.domElement.removeEventListener('pointermove', move)
      stage.renderer.domElement.removeEventListener('click', click)
      lineMat.dispose()
      stage.dispose()
      stageRef.current = null
      built.current.clear()
    }
    // Rebuild only when the drawn data or theme changes; t and selection go through pose().
  }, [ok, geo, sig, theme])

  // Move, outline and label without rebuilding.
  useEffect(() => {
    for (const [code, b] of built.current) {
      const on = code === selected || marked.includes(code)
      const m = b.edge.material as THREE.LineBasicMaterial
      m.color.set(on ? 0xffffff : 0x000000)
      m.opacity = on ? 0.95 : 0.18
    }
    pose()
  })

  if (!ok) return <>{fallback}</>
  return (
    <figure className="sw-stage" aria-label={label}>
      <div ref={box} className="sw-stage-canvas" />
      <div className="sw-stage-labels" aria-hidden="true">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="sw-tag sw-tag-name"
            style={{ left: tag.x, top: tag.y }}
          >
            {tag.text}
          </span>
        ))}
      </div>
      {hover && (
        <figcaption className="sw-stage-tip">
          {names.get(hover) ?? hover}
        </figcaption>
      )}
    </figure>
  )
}
