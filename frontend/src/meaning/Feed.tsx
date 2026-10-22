/**
 * The feed of every chart the site's data allows, shared by the meaning page (dark) and the
 * end of the home page (light). Posts come from ./posts/*.tsx and alternate between the four
 * families. Thumbnails animate their own slicers while on screen; a click opens one.
 */
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { PostLive, PostOpen, type Post } from './kit'
import './meaning.css'

const modules = import.meta.glob<{ posts: Post[] }>('./posts/*.tsx', {
  eager: true,
})

/**
 * Posts left out of the feed after a visual review: empty or near-uniform frames, tangles of
 * lines that read as noise at card size, squeezed scatters and repeats of a stronger number.
 */
const DROPPED = new Set<string>([
  // Empty or near-uniform.
  'pol-issue-welfare',
  'txt-plat-quality-waffle',
  'wel-ongoing-calendar',
  'wel-ess-heat',
  'job-ai-field-heat',
  'txt-act-signal-calendar',
  'txt-plat-compliance-funnel',
  // Tangles of lines.
  'wel-county-bump',
  'wel-county-parallel',
  'wel-tax-slope',
  'txt-ml-model-parallel',
  'job-occupation-slope',
  // Squeezed or too fine to read.
  'pol-cohesion-scatter',
  'txt-plat-sfs-repealed',
  'wel-church-swarm',
  'txt-plat-dataset-bubbles',
  'wel-headline-waffles',
  'wel-rate-kpis',
  'pol-ministers',
  // Single numbers beyond the strongest few.
  'txt-act-duty-total',
  'txt-act-references-kpi',
  'txt-act-characters',
  'txt-plat-gold-kpi',
  'txt-ml-observations',
])

/** Above this many SVG elements a thumbnail steps without transitions. */
const DENSE_MARKS = 400

/** Round-robin across groups so neighbouring posts come from different data. */
function interleave(groups: Post[][]) {
  const out: Post[] = []
  const longest = Math.max(0, ...groups.map((g) => g.length))
  for (let i = 0; i < longest; i++)
    for (const g of groups) if (g[i]) out.push(g[i])
  return out
}

/** Files by family (the prefix before the first dash: job, pol, txt, wel). */
const families = new Map<string, Post[][]>()
for (const key of Object.keys(modules).sort()) {
  const family = key.split('/').pop()!.split('-')[0]
  const posts = (modules[key].posts ?? []).filter((p) => !DROPPED.has(p.id))
  if (posts.length)
    families.set(family, [...(families.get(family) ?? []), posts])
}
export const FEED = interleave([...families.values()].map(interleave))

/** Grid reflow animated by the View Transitions API where the browser has it. */
function morph(change: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown
  }
  if (doc.startViewTransition) doc.startViewTransition(() => flushSync(change))
  else change()
}

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

/** Whether the tab is in front; thumbnails stop ticking behind another tab. */
function usePageVisible() {
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
function Card({
  post,
  index,
  open,
  pageVisible,
  toggle,
}: {
  post: Post
  index: number
  open: boolean
  pageVisible: boolean
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
    const nearby = new IntersectionObserver(
      ([e]) => setNear(e.isIntersecting),
      { rootMargin: '400px' },
    )
    const seen = new IntersectionObserver(([e]) =>
      setOnScreen(e.isIntersecting),
    )
    nearby.observe(node)
    seen.observe(node)
    return () => {
      nearby.disconnect()
      seen.disconnect()
    }
  }, [])
  useEffect(() => {
    if (open)
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])
  // Charts with thousands of marks step without gliding: tweening them all costs every frame.
  useEffect(() => {
    const node = ref.current
    if (!node || !near) return
    const count = () =>
      setDense(node.querySelectorAll('svg *').length > DENSE_MARKS)
    const mo = new MutationObserver(count)
    mo.observe(node, { childList: true, subtree: true })
    count()
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
          <PostLive.Provider value={onScreen && pageVisible && !dense}>
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
          aria-label="Close chart"
          onClick={() => toggle(null)}
        >
          ×
        </button>
      ) : (
        <button
          type="button"
          className="mean-hit"
          aria-label="Open chart"
          onClick={() => toggle(post.id)}
        />
      )}
    </article>
  )
}

export default function Feed() {
  const [openId, setOpenId] = useState<string | null>(null)
  const pageVisible = usePageVisible()
  const toggle = (id: string | null) => morph(() => setOpenId(id))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && toggle(null)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="mean-feed">
      {FEED.map((p, i) => (
        <Card
          key={p.id}
          post={p}
          index={i}
          open={p.id === openId}
          pageVisible={pageVisible}
          toggle={toggle}
        />
      ))}
    </div>
  )
}
