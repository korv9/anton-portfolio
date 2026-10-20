/**
 * The atlas page template: the SWEDEN header, a full-window space, and free text on the left
 * (no panel): kicker, question, one line on what the scene shows, what the data reveals, and
 * the Data–Reality Gap. A key sits top right, a source line bottom right, and the DATA drawer
 * bottom left lists every slot the scene reads, filled or empty.
 *
 * `build` draws the scene once the slots have loaded and returns the labels to project, and
 * optionally an `apply(live)` that moves objects in place (C's morph) without a rebuild. The
 * scene is rebuilt when `rebuild` changes (a selection), keeping the reader's camera. Objects
 * registered with `space.pickable` answer a click (not a drag); every such choice also has a
 * keyboard route in `control` or `info`.
 * "Revealed" is computed by the scene from its data; when that data is missing the page says
 * which file would produce it, never a sample sentence.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SwedenHeader } from '../Header'
import { webgl } from '../stage'
import { DataDrawer } from './DataDrawer'
import type { SlotState } from './slots'
import * as THREE from 'three'
import { createSpace, type Space, type Tag, type View } from './space'
import './atlas.css'

export const ATLAS_NAV = [
  ['#sweden-atlas', 'Atlas'],
  ['#sweden-atlas-a', 'A'],
  ['#sweden-atlas-b', 'B'],
  ['#sweden-atlas-c', 'C'],
  ['#sweden-atlas-d', 'D'],
  ['#sweden-atlas-e', 'E'],
  ['#sweden-atlas-x', '×'],
] as const

export type KeyItem = {
  label: string
  colour: string
  dashed?: boolean
  /** Makes the key entry a button that filters the scene. */
  onClick?: () => void
  pressed?: boolean
}

type Placed = Tag & { x: number; y: number }
export type Built = Tag[] | { tags: Tag[]; apply?: (live: number) => void }

export function AtlasPage({
  current,
  kicker,
  question,
  line,
  revealed,
  revealedFrom,
  gap,
  keyItems,
  foot,
  view,
  slots,
  loading,
  build,
  rebuild = '',
  live,
  control,
  info,
}: {
  /** This page's route, for the atlas navigation. */
  current: string
  kicker: ReactNode
  question: string
  line: string
  /** A finding computed from the data, or null when its data is missing. */
  revealed: string | null
  /** The slot that produces `revealed`, named when it is empty. */
  revealedFrom: string
  gap: string
  keyItems?: KeyItem[]
  foot?: string
  view: View
  slots: Record<string, SlotState>
  loading: boolean
  build: (space: Space) => Built
  /** Changes when a selection changes; the scene is rebuilt, the camera kept. */
  rebuild?: string
  /** A continuous value handed to `apply` without rebuilding. */
  live?: number
  /** The page's own control, bottom centre. */
  control?: ReactNode
  /** The chosen entity, bottom right. */
  info?: ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const [ok] = useState(webgl)
  const [tags, setTags] = useState<Placed[]>([])
  const draw = useRef(build)
  draw.current = build
  const camera = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(
    null,
  )
  const applyRef = useRef<((live: number) => void) | null>(null)
  const liveRef = useRef(live)
  liveRef.current = live
  const refresh = useRef<() => void>(() => {})

  useEffect(() => {
    const el = host.current
    if (!ok || !el || loading) return
    const space = createSpace(el, view)
    if (camera.current) {
      space.camera.position.copy(camera.current.pos)
      space.controls.target.copy(camera.current.target)
      space.controls.update()
    }
    const out = draw.current(space)
    const anchored = Array.isArray(out) ? out : out.tags
    applyRef.current = Array.isArray(out) ? null : (out.apply ?? null)
    const place = () =>
      setTags(
        anchored.flatMap((t) => {
          const p = space.project(t.at)
          return p
            ? [{ ...t, x: p[0] + (t.dx ?? 0), y: p[1] + (t.dy ?? 0) }]
            : []
        }),
      )
    refresh.current = () => {
      applyRef.current?.(liveRef.current ?? 0)
      space.render()
      place()
    }
    // A click that is not a drag picks the nearest pickable object.
    const canvas = space.renderer.domElement
    let down: [number, number] | null = null
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY])
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
        return
      const rect = canvas.getBoundingClientRect()
      const ray = new THREE.Raycaster()
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        space.camera,
      )
      const hit = ray.intersectObjects(
        space.picks.map((p) => p.obj),
        false,
      )[0]
      space.picks.find((p) => p.obj === hit?.object)?.fn()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    space.controls.addEventListener('change', place)
    const ro = new ResizeObserver(place)
    ro.observe(el)
    refresh.current()
    return () => {
      camera.current = {
        pos: space.camera.position.clone(),
        target: space.controls.target.clone(),
      }
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      ro.disconnect()
      space.dispose()
    }
    // Views are fixed per page; the scene follows loading and the page's selection key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, loading, rebuild])

  useEffect(() => {
    refresh.current()
  }, [live])

  return (
    <article className="sweden sw-atlas">
      <SwedenHeader current="#sweden" />
      <div className="sw-atlas-stage" ref={host} aria-hidden="true">
        {!ok && <p className="sw-atlas-nogl">This view needs WebGL.</p>}
      </div>
      <div className="sw-atlas-tags">
        {tags.map((t, i) => {
          const body = t.lines.map((text, j) => (
            <span key={j} className={j === 0 && t.head ? 'is-head' : undefined}>
              {text}
            </span>
          ))
          const props = {
            className: `sw-atlas-tag is-${t.tone ?? 'mono'} at-${t.anchor ?? 'center'}`,
            style: { left: t.x, top: t.y, color: t.colour },
          }
          if (t.onClick)
            return (
              <button
                key={i}
                type="button"
                aria-pressed={t.pressed}
                onClick={t.onClick}
                {...props}
              >
                {body}
              </button>
            )
          return t.href ? (
            <a key={i} href={t.href} {...props}>
              {body}
            </a>
          ) : (
            <span key={i} {...props}>
              {body}
            </span>
          )
        })}
      </div>
      <div className="sw-atlas-shade" aria-hidden="true" />
      <section className="sw-atlas-copy" aria-labelledby="sw-title">
        <nav className="sw-atlas-nav" aria-label="Atlas">
          {ATLAS_NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={href === current ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="sw-atlas-kicker">{kicker}</p>
        <h1 id="sw-title">{question}</h1>
        <p className="sw-atlas-line">{line}</p>
        <div className="sw-atlas-sec">
          <h2>Revealed</h2>
          {revealed ? (
            <p>{revealed}</p>
          ) : (
            <p className="is-pending">
              {loading
                ? 'Reading the data…'
                : `Appears when ${revealedFrom} is published.`}
            </p>
          )}
        </div>
        <div className="sw-atlas-sec is-gap">
          <h2>The Data–Reality Gap</h2>
          <p>{gap}</p>
        </div>
      </section>
      {keyItems && (
        <ul className="sw-atlas-key" aria-label="Key">
          {keyItems.map((k) => {
            const mark = (
              <i
                style={{
                  borderTopColor: k.colour,
                  borderTopStyle: k.dashed ? 'dashed' : 'solid',
                }}
              />
            )
            return (
              <li key={k.label}>
                {k.onClick ? (
                  <button
                    type="button"
                    aria-pressed={k.pressed}
                    onClick={k.onClick}
                  >
                    {k.label}
                    {mark}
                  </button>
                ) : (
                  <>
                    {k.label}
                    {mark}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {control && <div className="sw-atlas-control">{control}</div>}
      {info && (
        <aside className="sw-atlas-info" aria-live="polite">
          {info}
        </aside>
      )}
      {foot && <p className="sw-atlas-foot">{foot}</p>}
      <DataDrawer slots={slots} />
    </article>
  )
}
