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
  render: () => ReactNode
}

/** Six series colours from the SWEDEN dark palette; charts cycle through them. */
export const PALETTE = [
  'var(--sw-accent)',
  'var(--sw-div-pos)',
  'var(--sw-div-neg)',
  'var(--sw-stamp)',
  'var(--sw-seq-hi)',
  'var(--series-4)',
]
/** Sequential ramp ends for heatmaps: mix between them with color-mix. */
export const SEQ = ['var(--sw-seq-lo)', 'var(--sw-seq-hi)'] as const
export const seq = (t: number) =>
  `color-mix(in oklab, ${SEQ[1]} ${Math.round(Math.max(0, Math.min(1, t)) * 100)}%, ${SEQ[0]})`
export const color = (i: number) => PALETTE[i % PALETTE.length]

const cache = new Map<string, Promise<unknown>>()

/** One published dataset, fetched once per page load. null while loading; Error on failure. */
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
  return state
}

/** A row of toggle chips. The labels are legend text, so they count as legend. */
/** Whether the post is opened (full controls) or a living thumbnail. */
export const PostOpen = createContext(false)

const still =
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
  const now = useRef({ options, value, onChange })
  now.current = { options, value, onChange }
  useEffect(() => {
    if (open || still || options.length < 2) return
    const id = setInterval(
      () => {
        const { options: o, value: v, onChange: set } = now.current
        set(o[(o.indexOf(v) + 1) % o.length])
      },
      2400 + Math.random() * 2400,
    )
    return () => clearInterval(id)
  }, [open, options.length])
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

/** Wraps a chart: shows nothing while loading and an empty frame if the data is missing. */
export function Frame<T>({
  data,
  children,
}: {
  data: T | null | Error
  children: (d: T) => ReactNode
}) {
  if (data === null) return <div className="mean-wait" aria-busy="true" />
  if (data instanceof Error) return <div className="mean-wait" />
  // A withdrawn dataset ships as {state: 'unavailable'}; its post draws nothing.
  if ((data as { state?: unknown }).state === 'unavailable') return null
  return <>{children(data)}</>
}
