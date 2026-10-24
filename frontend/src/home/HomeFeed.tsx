/**
 * The chart feed at the end of Projects, in the home page's light colours. Its code and data
 * load only when the reader scrolls near it, so the page's first paint stays light.
 */
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const Feed = lazy(() => import('../meaning/Feed'))

/** If a section's code fails to load or render, the home page goes on without it. */
export class FeedBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children
  }
}

export default function HomeFeed() {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [inView, setInView] = useState(false)
  // The 3D map behind the page fades out while the feed fills the screen: compositing it under
  // the ticking thumbnails cut the frame rate to about a third.
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      rootMargin: '0px 0px -50% 0px',
    })
    io.observe(node)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const node = ref.current
    if (!node || near) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setNear(true),
      { rootMargin: '1200px 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [near])
  return (
    <section
      ref={ref}
      className="home-feed mean-light"
      lang="en"
      data-in-view={inView || undefined}
      aria-labelledby="home-feed-title"
    >
      <h2 id="home-feed-title" className="home-work-title">
        What does it even mean?
      </h2>
      {near && (
        <FeedBoundary>
          <Suspense fallback={null}>
            <Feed level={3} />
          </Suspense>
        </FeedBoundary>
      )}
    </section>
  )
}
