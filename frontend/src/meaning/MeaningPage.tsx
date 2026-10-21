/**
 * What does it even mean? An overwhelming feed of every chart the site's data allows. No prose:
 * only the title, the charts and their legends. Posts come from ./posts/*.tsx, interleaved by
 * domain like a feed. Thumbnails animate their own slicers; a click opens one with its legend.
 */
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { PostOpen, type Post } from './kit'
import '../sweden/sweden.css'
import './meaning.css'

const modules = import.meta.glob<{ posts: Post[] }>('./posts/*.tsx', {
  eager: true,
})

/** Round-robin across files so neighbouring posts come from different data. */
function interleave(groups: Post[][]) {
  const out: Post[] = []
  const longest = Math.max(0, ...groups.map((g) => g.length))
  for (let i = 0; i < longest; i++)
    for (const g of groups) if (g[i]) out.push(g[i])
  return out
}

const FEED = interleave(
  Object.keys(modules)
    .sort()
    .map((k) => modules[k].posts ?? []),
)

/** Grid reflow animated by the View Transitions API where the browser has it. */
function morph(change: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown
  }
  if (doc.startViewTransition) doc.startViewTransition(() => flushSync(change))
  else change()
}

/**
 * One post. It renders only near the screen and unmounts when far away, so the feed stays
 * light. Closed it is a living thumbnail; opened it spans the grid and pushes its neighbours.
 */
function Card({
  post,
  index,
  open,
  toggle,
}: {
  post: Post
  index: number
  open: boolean
  toggle: (id: string | null) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: '400px',
    })
    io.observe(node)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (open)
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])
  return (
    <article
      ref={ref}
      className={`mean-post mean-${post.size ?? 'square'}${open ? ' mean-open' : ''}`}
      data-domain={post.domain}
      data-post={post.id}
      style={near ? { viewTransitionName: `mp-${index}` } : undefined}
    >
      <span className="mean-avatar" aria-hidden="true" />
      <div className="mean-body">
        <PostOpen.Provider value={open}>
          {near || open ? post.render() : null}
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

export default function MeaningPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = (id: string | null) => morph(() => setOpenId(id))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && toggle(null)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  return (
    <main className="sweden mean-page">
      <h1 className="mean-title">What does it even mean?</h1>
      <div className="mean-feed">
        {FEED.map((p, i) => (
          <Card
            key={p.id}
            post={p}
            index={i}
            open={p.id === openId}
            toggle={toggle}
          />
        ))}
      </div>
    </main>
  )
}
