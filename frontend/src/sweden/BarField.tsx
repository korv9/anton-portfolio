/**
 * The shared 3D scene of the SWEDEN matrices (A's Knowledge Cube, B's Language Landscape, E's
 * Future Landscape): one instanced box per cell of a rows × columns grid, its height the cell's
 * normalised value, on the shared stage (stage.ts). Loaded lazily with three.js on the pages
 * that use it, never on the homepage.
 *
 * Raw values stay with the caller: the scene receives heights in [0, 1] for drawing and reports
 * the picked cell back, and the page shows the raw value. Columns without data (`gaps`) are
 * drawn as flat, labelled ground, never as interpolated bars. Without WebGL the caller's 2D
 * matrix is the view (`fallback`).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import {
  createStage,
  ramp,
  toScreen,
  useSwedenThemeValue,
  webgl,
  type Stage,
} from './stage'

export type Cell = {
  row: number
  col: number
  height: number
  label: string
  key: string
  /** 'glass' draws the cell translucent (B: personal expectations); default matte. */
  tone?: 'matte' | 'glass' | 'stone'
}

type Label = { text: string; at: THREE.Vector3; strong?: boolean }

export default function BarField({
  rows,
  cols,
  cells,
  picked,
  onPick,
  label,
  fallback,
  rowLabels,
  colLabels,
  gaps,
}: {
  rows: number
  cols: number
  cells: Cell[]
  picked: string | null
  onPick: (key: string) => void
  label: string
  /** The 2D view shown without WebGL. */
  fallback: ReactNode
  rowLabels?: string[]
  /** Labels under chosen columns, e.g. every decade. */
  colLabels?: { col: number; text: string }[]
  /** Columns with no data at all, drawn as empty ground. */
  gaps?: number[]
}) {
  const box = useRef<HTMLDivElement>(null)
  const [ok] = useState(webgl)
  const [hover, setHover] = useState<string | null>(null)
  const [tags, setTags] = useState<
    { text: string; x: number; y: number; strong?: boolean }[]
  >([])
  const pick = useRef(onPick)
  pick.current = onPick
  const stageRef = useRef<Stage | null>(null)
  const theme = useSwedenThemeValue()
  // Rebuild only when what is drawn changes, not on every render of the page.
  const sig = [
    rows,
    cols,
    cells
      .map((c) => `${c.key}:${c.height.toFixed(4)}:${c.tone ?? ''}`)
      .join(','),
    (rowLabels ?? []).join('|'),
    (colLabels ?? []).map((c) => c.col + c.text).join('|'),
    (gaps ?? []).join(','),
  ].join('#')
  const latest = useRef({ cells, rowLabels, colLabels, gaps })
  latest.current = { cells, rowLabels, colLabels, gaps }

  useEffect(() => {
    const { cells, rowLabels, colLabels, gaps } = latest.current
    const el = box.current
    if (!ok || !el) return
    const stage = createStage(el)
    stageRef.current = stage
    const { scene, colour } = stage
    const lo = colour('--sw-seq-lo', '#34332f')
    const hi = colour('--sw-seq-hi', '#f1efe7')
    const unit = 4
    const span = Math.max(cols, rows) * unit
    const tall = span * 0.2
    const x = (c: number) => (c - (cols - 1) / 2) * unit
    const z = (r: number) => (r - (rows - 1) / 2) * unit

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(cols * unit + 4, 0.6, rows * unit + 4),
      new THREE.MeshStandardMaterial({
        color: colour('--sw-base', '#2a2925'),
        roughness: 0.95,
      }),
    )
    plate.position.y = -0.3
    plate.receiveShadow = true
    scene.add(plate)
    for (const g of gaps ?? []) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(unit * 0.9, rows * unit),
        new THREE.MeshBasicMaterial({
          color: colour('--sw-muted', '#a39e93'),
          transparent: true,
          opacity: 0.08,
        }),
      )
      m.rotation.x = -Math.PI / 2
      m.position.set(x(g), 0.02, 0)
      scene.add(m)
    }

    const geometry = new THREE.BoxGeometry(unit * 0.82, 1, unit * 0.82)
    geometry.translate(0, 0.5, 0)
    const groups = {
      matte: [] as number[],
      glass: [] as number[],
      stone: [] as number[],
    }
    cells.forEach((c, i) => groups[c.tone ?? 'matte'].push(i))
    const meshes: { mesh: THREE.InstancedMesh; idx: number[] }[] = []
    const matrix = new THREE.Matrix4()
    for (const [tone, idx] of Object.entries(groups)) {
      if (!idx.length) continue
      const material = new THREE.MeshStandardMaterial({
        roughness: tone === 'glass' ? 0.35 : tone === 'stone' ? 0.95 : 0.8,
        transparent: tone === 'glass',
        opacity: tone === 'glass' ? 0.9 : 1,
      })
      const mesh = new THREE.InstancedMesh(geometry, material, idx.length)
      mesh.castShadow = tone !== 'glass'
      mesh.receiveShadow = true
      idx.forEach((ci, j) => {
        const c = cells[ci]
        const h = Math.max(0.02, c.height) * tall
        matrix.compose(
          new THREE.Vector3(x(c.col), 0, z(c.row)),
          new THREE.Quaternion(),
          new THREE.Vector3(1, h, 1),
        )
        mesh.setMatrixAt(j, matrix)
        mesh.setColorAt(
          j,
          tone === 'stone'
            ? new THREE.Color('#8e8c97')
            : ramp(lo, hi, c.height),
        )
      })
      scene.add(mesh)
      meshes.push({ mesh, idx })
    }

    const labels: Label[] = [
      ...(rowLabels ?? []).map((text, r) => ({
        text,
        at: new THREE.Vector3(x(cols - 1) + unit, 0, z(r)),
        strong: true,
      })),
      ...(colLabels ?? []).map(({ col, text }) => ({
        text,
        at: new THREE.Vector3(x(col), 0, z(rows - 1) + unit * 1.4),
      })),
    ]
    const place = () =>
      setTags(
        labels.flatMap((t) => {
          const p = toScreen(stage, el, t.at)
          return p ? [{ text: t.text, x: p[0], y: p[1], strong: t.strong }] : []
        }),
      )
    stage.controls.addEventListener('change', place)
    stage.home(
      new THREE.Vector3(span * 0.04, tall * 0.15, 0),
      span * 2.25,
      1.0,
      0.62,
    )
    place()

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
      for (const { mesh, idx } of meshes) {
        const hit = ray.intersectObject(mesh)[0]
        if (hit?.instanceId != null) return cells[idx[hit.instanceId]]
      }
      return null
    }
    const move = (e: MouseEvent) => setHover(at(e)?.label ?? null)
    const click = (e: MouseEvent) => {
      const c = at(e)
      if (c) pick.current(c.key)
    }
    stage.renderer.domElement.addEventListener('pointermove', move)
    stage.renderer.domElement.addEventListener('click', click)
    const onResize = new ResizeObserver(place)
    onResize.observe(el)
    return () => {
      onResize.disconnect()
      stage.renderer.domElement.removeEventListener('pointermove', move)
      stage.renderer.domElement.removeEventListener('click', click)
      stage.dispose()
      stageRef.current = null
    }
  }, [ok, sig, theme])

  if (!ok) return <>{fallback}</>
  const pickedLabel = picked ? cells.find((c) => c.key === picked)?.label : null
  return (
    <figure className="sw-stage" aria-label={label}>
      <div ref={box} className="sw-stage-canvas" />
      <div className="sw-stage-labels" aria-hidden="true">
        {tags.map((t, i) => (
          <span
            key={i}
            className={t.strong ? 'sw-tag sw-tag-row' : 'sw-tag'}
            style={{ left: t.x, top: t.y }}
          >
            {t.text}
          </span>
        ))}
      </div>
      {(hover ?? pickedLabel) && (
        <figcaption className="sw-stage-tip">{hover ?? pickedLabel}</figcaption>
      )}
    </figure>
  )
}
