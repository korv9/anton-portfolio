/**
 * The shared three.js stage of the SWEDEN scenes (BarField, MunicipalityField), in the look of
 * "Sverige i höjd": a 32° perspective camera with damped orbit controls, a hemisphere light and
 * one soft directional light, a shadow-catching ground, and colours read from the page's tokens.
 *
 * The camera's view is offset so the subject sits in the free area between the scene panels
 * (title on the left, legend and info on the right). It renders on change only: orbit, resize,
 * or an explicit `render()`, never in an idle loop. The device pixel ratio is capped at 2.
 */
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type Stage = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  colour: (name: string, fallback: string) => THREE.Color
  render: () => void
  /** Puts the camera at a spherical position around `target` and renders. */
  home: (
    target: THREE.Vector3,
    distance: number,
    polar: number,
    azimuth: number,
  ) => void
  dispose: () => void
}

export function webgl() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export function createStage(
  el: HTMLElement,
  /** Horizontal view offset in px for a given width; negative moves the subject right. */
  shiftFor: (width: number) => number = (w) =>
    w > 1100 ? -(400 - 340) / 2 : 0,
): Stage {
  const css = getComputedStyle(el)
  const colour = (name: string, fallback: string) =>
    new THREE.Color(css.getPropertyValue(name).trim() || fallback)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 4000)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a98a2, 1.05))
  const sun = new THREE.DirectionalLight(0xffffff, 1.25)
  sun.position.set(-90, 170, 80)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, {
    left: -180,
    right: 180,
    top: 180,
    bottom: -180,
    near: 10,
    far: 700,
  })
  scene.add(sun)
  const dark = colour('--sw-bg', '#11100e').getHSL({ h: 0, s: 0, l: 0 }).l < 0.5
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.ShadowMaterial({ opacity: dark ? 0.5 : 0.13 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  ground.receiveShadow = true
  scene.add(ground)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI * 0.48
  controls.minDistance = 30
  controls.maxDistance = 900
  controls.screenSpacePanning = false

  let frame = 0
  const draw = () => {
    frame = 0
    const moving = controls.update()
    renderer.render(scene, camera)
    if (moving) frame = requestAnimationFrame(draw)
  }
  const render = () => {
    if (!frame) frame = requestAnimationFrame(draw)
  }
  controls.addEventListener('change', render)

  // The panels take the left ~400 px and the right ~340 px on a wide screen: shift the view
  // so the subject's centre lands in the space between them.
  const resize = () => {
    const w = el.clientWidth
    const h = el.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    const shift = shiftFor(w)
    if (shift) camera.setViewOffset(w, h, shift, 0, w, h)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(el)
  resize()

  return {
    scene,
    camera,
    renderer,
    controls,
    colour,
    render,
    home(target, distance, polar, azimuth) {
      // A tall, narrow screen needs the camera further back to fit the same subject.
      const aspect = el.clientWidth / Math.max(1, el.clientHeight)
      distance *= aspect < 0.8 ? 1.7 : aspect < 1.2 ? 1.25 : 1
      controls.target.copy(target)
      camera.position.copy(
        target
          .clone()
          .add(
            new THREE.Vector3().setFromSpherical(
              new THREE.Spherical(distance, polar, azimuth),
            ),
          ),
      )
      controls.update()
      render()
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose()
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

/** Projects a 3D point to CSS pixels in the stage's element, or null behind the camera. */
export function toScreen(
  stage: Stage,
  el: HTMLElement,
  p: THREE.Vector3,
): [number, number] | null {
  const v = p.clone().project(stage.camera)
  if (v.z > 1) return null
  return [((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight]
}

/** The SWEDEN theme the header sets on <html>; scenes rebuild their colours when it changes. */
export function useSwedenThemeValue() {
  const read = () => document.documentElement.dataset.swTheme ?? 'dark'
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-sw-theme'],
    })
    return () => observer.disconnect()
  }, [])
  return theme
}
