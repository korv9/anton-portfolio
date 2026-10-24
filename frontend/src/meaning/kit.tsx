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
  // The message is the path, so a failure names the file whatever went wrong.
  const response = await fetchData(path).catch(() => {
    throw new Error(path)
  })
  if (!response.ok) throw new Error(`${path} (HTTP ${response.status})`)
  return response.json()
}

export type Post = {
  /** Unique across the feed, kebab-case, e.g. 'riksdag-votes-by-party'. */
  id: string
  /** The data family: picks the pipeline subject whose freshness the card shows. */
  domain: string
  /** Every published data path the post reads, for its trace panel. A unit test holds each
   * file's `useData` paths to these (feed-sources.test.ts). */
  sources: readonly string[]
  /** 'wide' spans two feed columns on large screens. */
  size?: 'square' | 'wide' | 'tall'
  /** Readable name for the card's open and close buttons; defaults to the id read as words. */
  label?: string
  /** Visible heading above the chart, also in the thumbnail: a modest, checkable finding or
   * the plain topic. A function gets the post's first source once it has loaded. */
  title?: string | ((d: never) => string)
  /** One muted line under the title: unit, period or source. */
  note?: string
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
/** The fill for a number written on a `seq(t)` cell: near-black on a light cell, near-white on
 * a dark one, read from the cell's own lightness, so it holds in either theme. */
export const cellInk = (t: number) => ({
  fill: `oklch(from ${seq(t)} clamp(0.2, (0.6 - l) * 1000, 0.97) 0 0)`,
})
export const color = (i: number) => PALETTE[i % PALETTE.length]
/** Grey for every mark but the focal one: for more categories than the palette can tell apart. */
export const OTHER = 'var(--mean-other)'
export const focal = (on: boolean) => (on ? PALETTE[0] : OTHER)
/** The i-th of n greys, each paler towards the paper: parts of a whole beside one focal part,
 * told apart by step rather than hue. Every part gets its own step. */
export const shade = (i: number, n: number) =>
  `color-mix(in srgb, ${OTHER} ${Math.round(100 - (i / Math.max(1, n)) * 72)}%, var(--paper))`
/** A number tile in a series colour: a pale tint of it, edged with the full colour, so the
 * ink stays legible on both themes. */
export const tile = (c: string) => ({
  background: `color-mix(in srgb, ${c} 18%, var(--paper))`,
  boxShadow: `inset 3px 0 0 ${c}`,
})

const cache = new Map<string, Promise<unknown>>()
/** Settled fetches, so a card that remounts or shares a file knows its data at once. */
const settled = new Map<string, unknown>()

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
 * Expired once a dataset with a `valid_until` date has passed it, or once it is withdrawn
 * ({state: 'unavailable'}).
 */
export function useData<T>(path: string): T | null | Error {
  const [state, setState] = useState<T | null | Error>(
    () => (settled.get(path) as T | Error | undefined) ?? null,
  )
  useEffect(() => {
    let live = true
    if (!cache.has(path))
      cache.set(
        path,
        fetchJson<T>(path).then(
          (v) => (settled.set(path, v), v),
          (e: Error) => {
            settled.set(path, e)
            throw e
          },
        ),
      )
    ;(cache.get(path) as Promise<T>).then(
      (v) => live && setState(v),
      (e: Error) => live && setState(e),
    )
    return () => {
      live = false
    }
  }, [path])
  const withdrawn =
    (state as { state?: unknown } | null)?.state === 'unavailable'
  return expired(state) || withdrawn ? new Expired(path) : state
}

/** Whether the post is opened (full controls) or a living thumbnail. */
export const PostOpen = createContext(false)
/** Whether the post is on screen in a visible tab, so its thumbnail may tick. */
export const PostLive = createContext(false)
/** Takes the card out of the feed: its data expired or failed to load. */
export const PostLeave = createContext<() => void>(() => {})

/** Thumbnails step their slicer every 2.5 s, slow enough to read each step; the marks glide
 * between steps in CSS. */
const TICK_MS = 2500

export const still =
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

/** Extra ticks the last option holds before the loop wraps, so a sequence reads as one. */
const SEAM_HOLD = 2

/**
 * A row of toggle chips. The labels are legend text, so they count as legend. In a thumbnail
 * the chips are hidden and the slicer steps through its options by itself, so the feed moves;
 * the current option shows as a small label in the card's corner. Only ordered steps on one
 * axis (years, sessions, rounds) pass `cycles`; categorical options hold the first one.
 */
export function Slicer<T extends string | number>({
  options,
  value,
  onChange,
  label,
  cycles = false,
  format = String,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  /** Accessible name only; not shown. */
  label: string
  cycles?: boolean
  /** Plain-language text for an option, where the value is a code or an index. */
  format?: (v: T) => string
}) {
  const open = useContext(PostOpen)
  const live = useContext(PostLive)
  const now = useRef({ options, value, onChange })
  now.current = { options, value, onChange }
  useEffect(() => {
    if (open || !live || still || !cycles || options.length < 2) return
    let hold = 0
    const step = () => {
      const { options: o, value: v, onChange: set } = now.current
      const next = (o.indexOf(v) + 1) % o.length
      if (next === 0 && hold++ < SEAM_HOLD) return
      hold = 0
      set(o[next])
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
  }, [open, live, cycles, options.length])
  return (
    <>
      {!open && cycles && options.length > 1 && (
        <span className="mean-now" aria-hidden="true">
          {format(value)}
        </span>
      )}
      <div className="mean-slicer" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </>
  )
}

/** Calls the card's PostLeave once mounted; leaving during render would update the parent. */
function Leave() {
  const leave = useContext(PostLeave)
  useEffect(leave, [leave])
  return null
}

/**
 * Wraps a chart. While loading it shows the chart's empty grid. A thumbnail whose data failed
 * or expired leaves the feed; an opened post stays, so focus is not lost, and names the file.
 */
export function Frame<T>({
  data,
  children,
}: {
  data: T | null | Error
  children: (d: T) => ReactNode
}) {
  const open = useContext(PostOpen)
  if (data === null) return <div className="mean-wait" aria-busy="true" />
  if (data instanceof Error)
    return open ? (
      <p className="mean-failed">
        {data instanceof Expired ? 'Data expired' : 'Data unavailable'}:{' '}
        {data.message}
      </p>
    ) : (
      <Leave />
    )
  return <>{children(data)}</>
}
