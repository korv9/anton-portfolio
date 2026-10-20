/**
 * The atlas page template: the SWEDEN header, a full-window space, and free text on the left
 * (no panel): kicker, question, one line on what the scene shows, what the data reveals, and
 * the Data–Reality Gap. A key sits top right, a source line bottom right, and the DATA drawer
 * bottom left lists every slot the scene reads, filled or empty.
 *
 * `build` draws the scene once the slots have loaded and returns the labels to project.
 * "Revealed" is computed by the scene from its data; when that data is missing the page says
 * which file would produce it, never a sample sentence.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SwedenHeader } from '../Header'
import { webgl } from '../stage'
import { SLOTS, type SlotState } from './slots'
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

export type KeyItem = { label: string; colour: string; dashed?: boolean }

type Placed = Tag & { x: number; y: number }

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
  build: (space: Space) => Tag[]
}) {
  const host = useRef<HTMLDivElement>(null)
  const [ok] = useState(webgl)
  const [tags, setTags] = useState<Placed[]>([])
  const draw = useRef(build)
  draw.current = build

  useEffect(() => {
    const el = host.current
    if (!ok || !el || loading) return
    const space = createSpace(el, view)
    const anchored = draw.current(space)
    const place = () =>
      setTags(
        anchored.flatMap((t) => {
          const p = space.project(t.at)
          return p
            ? [{ ...t, x: p[0] + (t.dx ?? 0), y: p[1] + (t.dy ?? 0) }]
            : []
        }),
      )
    space.controls.addEventListener('change', place)
    const ro = new ResizeObserver(place)
    ro.observe(el)
    space.render()
    place()
    return () => {
      ro.disconnect()
      space.dispose()
    }
    // The scene is rebuilt only when loading finishes; views are fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, loading])

  const list = Object.values(slots)
  const filled = list.filter((s) => s.status === 'filled').length
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
          {keyItems.map((k) => (
            <li key={k.label}>
              {k.label}
              <i
                style={{
                  borderTopColor: k.colour,
                  borderTopStyle: k.dashed ? 'dashed' : 'solid',
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {foot && <p className="sw-atlas-foot">{foot}</p>}
      <details className="sw-atlas-data">
        <summary>
          DATA · {filled} of {list.length} slots filled
        </summary>
        <ul>
          {list.map((s) => {
            const def = SLOTS[s.key]
            return (
              <li key={s.key} className={`is-${s.status}`}>
                <b>
                  {s.status === 'filled' ? '●' : '○'} {def.path}
                </b>
                <span>{def.role}</span>
                {s.status !== 'filled' && (
                  <>
                    <code>{def.shape}</code>
                    {'source' in def && <span>Planned: {def.source}</span>}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </details>
    </article>
  )
}
