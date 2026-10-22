/**
 * One card of the chart feed (Feed.tsx): it renders near the screen, ticks while on screen and
 * opens in place. Split from the feed so each file stays small.
 */
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { PostLive, PostOpen, still, type Post } from './kit'

/** Above this many SVG elements a thumbnail steps without transitions. */
const DENSE_MARKS = 400

/** A post that throws on unexpected data leaves the feed instead of taking the page down. */
class PostBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * One IntersectionObserver per margin for the whole feed, rather than two per card.
 * `observe` returns the matching unobserve.
 */
const watchers = new Map<
  string,
  { io: IntersectionObserver; on: Map<Element, (hit: boolean) => void> }
>()
function observe(
  node: Element,
  rootMargin: string,
  cb: (hit: boolean) => void,
) {
  let w = watchers.get(rootMargin)
  if (!w) {
    const on = new Map<Element, (hit: boolean) => void>()
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => on.get(e.target)?.(e.isIntersecting)),
      { rootMargin },
    )
    w = { io, on }
    watchers.set(rootMargin, w)
  }
  const { io, on } = w
  on.set(node, cb)
  io.observe(node)
  return () => {
    on.delete(node)
    io.unobserve(node)
  }
}

/** The card's accessible name: the post's label, or its id read as words under its section. */
const nameOf = (post: Post, section: string) =>
  post.label ?? `${section}: ${post.id.split('-').slice(1).join(' ')}`

/** Whether the tab is in front; thumbnails stop ticking behind another tab. */
export function usePageVisible() {
  const [visible, setVisible] = useState(
    () => document.visibilityState === 'visible',
  )
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

/**
 * One post. It renders only near the screen and unmounts when far away, so the feed stays
 * light; it ticks only while on screen. Closed it is a living thumbnail; opened it spans the
 * grid and pushes its neighbours.
 */
export function Card({
  post,
  section,
  index,
  open,
  moving,
  toggle,
}: {
  post: Post
  section: string
  index: number
  open: boolean
  /** The tab is in front and the reader has not paused this section. */
  moving: boolean
  toggle: (id: string | null) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [onScreen, setOnScreen] = useState(false)
  const [dense, setDense] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const offNear = observe(node, '400px', setNear)
    const offSeen = observe(node, '0px', setOnScreen)
    return () => {
      offNear()
      offSeen()
    }
  }, [])
  // Opened, the card scrolls into view and takes focus on its close button; closed, focus goes
  // back to the card, unless the reader has already moved it to another card.
  const wasOpen = useRef(open)
  useEffect(() => {
    const node = ref.current
    if (open) {
      node?.scrollIntoView({
        block: 'nearest',
        behavior: still ? 'auto' : 'smooth',
      })
      node?.querySelector<HTMLElement>('.mean-close')?.focus()
    } else if (
      wasOpen.current &&
      (!document.activeElement || document.activeElement === document.body)
    )
      node?.querySelector<HTMLElement>('.mean-hit')?.focus()
    wasOpen.current = open
  }, [open])
  // Charts with thousands of marks step without gliding: tweening them all costs every frame.
  // The marks are counted once, when the chart first renders.
  useEffect(() => {
    const node = ref.current
    if (!node || !near) return
    const count = () => {
      if (!node.querySelector('svg *')) return false
      setDense(node.querySelectorAll('svg *').length > DENSE_MARKS)
      return true
    }
    if (count()) return
    const mo = new MutationObserver(() => count() && mo.disconnect())
    mo.observe(node, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [near])
  if (failed) return null
  return (
    <article
      ref={ref}
      className={`mean-post mean-${post.size ?? 'square'}${open ? ' mean-open' : ''}`}
      data-domain={post.domain}
      data-post={post.id}
      data-dense={dense || undefined}
      style={near ? { viewTransitionName: `mp-${index}` } : undefined}
    >
      <span className="mean-avatar" aria-hidden="true" />
      <div className="mean-body">
        <PostOpen.Provider value={open}>
          <PostLive.Provider value={onScreen && moving && !dense}>
            <PostBoundary onFail={() => setFailed(true)}>
              {near || open ? post.render() : null}
            </PostBoundary>
          </PostLive.Provider>
        </PostOpen.Provider>
      </div>
      {open ? (
        <button
          type="button"
          className="mean-close"
          aria-label={`Close chart: ${nameOf(post, section)}`}
          onClick={() => toggle(null)}
        >
          ×
        </button>
      ) : (
        <button
          type="button"
          className="mean-hit"
          aria-label={`Open chart: ${nameOf(post, section)}`}
          onClick={() => toggle(post.id)}
        />
      )}
    </article>
  )
}
