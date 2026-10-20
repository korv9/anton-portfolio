/**
 * The shared 3D scene of the SWEDEN matrices (A's Knowledge Cube, B's Language Landscape, E's
 * Future Landscape): one instanced box per cell of a rows × columns grid, its height the cell's
 * normalised value. Loaded lazily with three.js on the pages that use it, never on the homepage.
 *
 * Raw values stay with the caller: the scene receives heights in [0, 1] for drawing and reports
 * the picked cell back, and the page shows the raw value. Without WebGL, or with reduced motion
 * asked for and no interaction yet, the caller's 2D matrix is the view (`fallback`).
 * Perspective camera at 32°, matte material, hemisphere and one directional light, no idle
 * rotation; the device pixel ratio is capped at 2.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { l } from '../i18n'

export type Cell = {
  row: number
  col: number
  height: number
  label: string
  key: string
}

function webgl() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function BarField({
  rows,
  cols,
  cells,
  picked,
  onPick,
  label,
  fallback,
}: {
  rows: number
  cols: number
  cells: Cell[]
  picked: string | null
  onPick: (key: string) => void
  label: string
  /** The 2D view shown without WebGL. */
  fallback: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [ok] = useState(webgl)
  const [hover, setHover] = useState<string | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    const el = box.current
    if (!ok || !el) return
    const css = getComputedStyle(el)
    const colour = (name: string, fallbackValue: string) =>
      new THREE.Color(css.getPropertyValue(name).trim() || fallbackValue)
    const lo = colour('--sw-seq-lo', '#bcb1dc')
    const hi = colour('--sw-seq-hi', '#2c1f5e')
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    el.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8790, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(-30, 60, 40)
    scene.add(sun)
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(cols + 2, rows + 2),
      new THREE.MeshStandardMaterial({ color: 0xc9c7c2, roughness: 1 }),
    )
    base.rotation.x = -Math.PI / 2
    scene.add(base)
    const geometry = new THREE.BoxGeometry(0.82, 1, 0.82)
    geometry.translate(0, 0.5, 0)
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, cells.length)
    const matrix = new THREE.Matrix4()
    const span = Math.max(cols, rows)
    const tall = span * 0.32
    cells.forEach((c, i) => {
      const h = Math.max(0.02, c.height) * tall
      matrix.compose(
        new THREE.Vector3(c.col - cols / 2 + 0.5, 0, c.row - rows / 2 + 0.5),
        new THREE.Quaternion(),
        new THREE.Vector3(1, h, 1),
      )
      mesh.setMatrixAt(i, matrix)
      mesh.setColorAt(i, lo.clone().lerp(hi, Math.sqrt(c.height)))
    })
    scene.add(mesh)
    // A restrained isometric view, fitted to the grid with room for the overlay panels.
    camera.position.set(span * 1.25, span * 1.35, span * 1.9)
    camera.lookAt(-span * 0.12, 0, -span * 0.05)
    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    const ray = new THREE.Raycaster()
    const at = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      ray.setFromCamera(pointer, camera)
      const hit = ray.intersectObject(mesh)[0]
      return hit?.instanceId != null ? cells[hit.instanceId] : null
    }
    const move = (e: MouseEvent) => setHover(at(e)?.label ?? null)
    const click = (e: MouseEvent) => {
      const c = at(e)
      if (c) pick.current(c.key)
    }
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('click', click)
    resize()
    return () => {
      observer.disconnect()
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('click', click)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [ok, rows, cols, cells])

  if (!ok) return <>{fallback}</>
  return (
    <figure className="sw-barfield" aria-label={label}>
      <div ref={box} className="sw-barfield-canvas" />
      <figcaption className="sw-note">
        {hover ??
          (picked
            ? cells.find((c) => c.key === picked)?.label
            : l(
                'Point at a bar to name it; the table under Explore has every value.',
                'Peka på en stapel för att se den; tabellen under Utforska har varje värde.',
              ))}
      </figcaption>
    </figure>
  )
}
