/**
 * Shared parts for the "What does it even mean?" feed: the post contract, a cached JSON hook,
 * a slicer and the palette. Each file in ./posts exports `posts: Post[]` and owns its charts.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchData } from '../dataSource'

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchData(path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

export type Post = {
  /** Unique across the feed, kebab-case, e.g. 'riksdag-votes-by-party'. */
  id: string
  /** The data family, used only to colour the avatar ring. */
  domain: string
  /** 'wide' spans two feed columns on large screens. */
  size?: 'square' | 'wide' | 'tall'
  /** Readable name for the card's open and close buttons; defaults to the id read as words. */
  label?: string
  render: () => ReactNode
}

/**
 * Six series colours; charts cycle through them. The first is the focal one. meaning.css maps
 * them to the SWEDEN dark palette or, on the home page, to its light palette.
 */
export const PALETTE = [
  'var(--mean-s1)',
  'var(--mean-s2)',
  'var(--mean-s3)',
  'var(--mean-s4)',
  'var(--mean-s5)',
  'var(--mean-s6)',
]
/** Sequential ramp ends for heatmaps: mix between them with color-mix. */
export const SEQ = ['var(--mean-seq-lo)', 'var(--mean-seq-hi)'] as const
export const seq = (t: number) =>
  `color-mix(in oklab, ${SEQ[1]} ${Math.round(Math.max(0, Math.min(1, t)) * 100)}%, ${SEQ[0]})`
export const color = (i: number) => PALETTE[i % PALETTE.length]
/** A number tile in a series colour: a pale tint of it, edged with the full colour, so the
 * ink stays legible on both themes. */
export const tile = (c: string) => ({
  background: `color-mix(in srgb, ${c} 18%, var(--paper))`,
  boxShadow: `inset 3px 0 0 ${c}`,
})

const cache = new Map<string, Promise<unknown>>()

/** A dataset past its `valid_until` date; the post that reads it leaves the feed. */
export class Expired extends Error {}

/** Whether a dataset carries a `valid_until` date that has passed. */
export const expired = (v: unknown) =>
  typeof v === 'object' &&
  v !== null &&
  'valid_until' in v &&
  !(Date.parse(String(v.valid_until)) > Date.now())

/**
 * One published dataset, fetched once per page load. null while loading; Error on failure;
 * Expired once a dataset with a `valid_until` date has passed it.
 */
export function useData<T>(path: string): T | null | Error {
  const [state, setState] = useState<T | null | Error>(null)
  useEffect(() => {
    let live = true
    if (!cache.has(path)) cache.set(path, fetchJson<T>(path))
    ;(cache.get(path) as Promise<T>).then(
      (v) => live && setState(v),
      (e: Error) => live && setState(e),
    )
    return () => {
      live = false
    }
  }, [path])
  return expired(state) ? new Expired(path) : state
}

/** Whether the post is opened (full controls) or a living thumbnail. */
export const PostOpen = createContext(false)
/** Whether the post is on screen in a visible tab, so its thumbnail may tick. */
export const PostLive = createContext(false)

/** Thumbnails step their slicer twice a second; the marks glide between steps in CSS. */
const TICK_MS = 500

export const still =
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A row of toggle chips. The labels are legend text, so they count as legend. In a thumbnail
 * the chips are hidden and the slicer steps through its options by itself, so the feed moves.
 */
export function Slicer<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  /** Accessible name only; not shown. */
  label: string
}) {
  const open = useContext(PostOpen)
  const live = useContext(PostLive)
  const now = useRef({ options, value, onChange })
  now.current = { options, value, onChange }
  useEffect(() => {
    if (open || !live || still || options.length < 2) return
    const step = () => {
      const { options: o, value: v, onChange: set } = now.current
      set(o[(o.indexOf(v) + 1) % o.length])
    }
    // A random phase per card, so the feed does not tick in lockstep.
    let id = 0
    const start = setTimeout(() => {
      step()
      id = window.setInterval(step, TICK_MS)
    }, Math.random() * TICK_MS)
    return () => {
      clearTimeout(start)
      clearInterval(id)
    }
  }, [open, live, options.length])
  return (
    <div className="mean-slicer" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/**
 * Wraps a chart: shows nothing while loading and an empty frame if the data is missing. Expired
 * data is thrown, so the card's error boundary removes the whole post.
 */
export function Frame<T>({
  data,
  children,
}: {
  data: T | null | Error
  children: (d: T) => ReactNode
}) {
  if (data === null) return <div className="mean-wait" aria-busy="true" />
  if (data instanceof Expired) throw data
  if (data instanceof Error) return <div className="mean-wait" />
  // A withdrawn dataset ships as {state: 'unavailable'}; its post draws nothing.
  if ((data as { state?: unknown }).state === 'unavailable') return null
  return <>{children(data)}</>
}
