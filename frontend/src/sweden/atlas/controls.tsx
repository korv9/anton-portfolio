import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../stage'

/** A value between 0 and 1 that `play` eases to the other end; reduced motion jumps. */
export function useTween(initial: number) {
  const [t, setT] = useState(initial)
  const anim = useRef(0)
  const stop = () => cancelAnimationFrame(anim.current)
  useEffect(() => stop, [])
  const play = () => {
    stop()
    const to = t > 0.5 ? 0 : 1
    if (reducedMotion()) return setT(to)
    const from = t
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1400)
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      setT(from + (to - from) * e)
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }
  return [t, setT, play, stop] as const
}

/** Small keyboard-reachable controls shared by the atlas pages. */
export function MuniSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { code: string; name: string }[]
  value: string | null
  onChange: (code: string | null) => void
}) {
  return (
    <label>
      <span className="sw-atlas-visually-hidden">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{label}</option>
        {[...options]
          .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
          .map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
      </select>
    </label>
  )
}

export function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; text: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="sw-atlas-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.text}
        </button>
      ))}
    </div>
  )
}

/** C's control: play, the map-to-similarity slider and the paths switch. */
export function MorphControl({
  t,
  onPlay,
  onSlide,
  trails,
  onTrails,
}: {
  t: number
  onPlay: () => void
  onSlide: (t: number) => void
  trails: boolean
  onTrails: (on: boolean) => void
}) {
  return (
    <>
      <button
        type="button"
        className="sw-atlas-play"
        aria-label={t > 0.5 ? 'Back to the map' : 'Play the transition'}
        onClick={onPlay}
      >
        <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
          <path
            d={t > 0.5 ? 'M13 1L1 8l12 7z' : 'M1 1l12 7-12 7z'}
            fill="currentColor"
          />
        </svg>
      </button>
      <label className="sw-atlas-range">
        <span className="sw-atlas-visually-hidden">Map to similarity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(t * 100)}
          onChange={(e) => onSlide(Number(e.target.value) / 100)}
        />
        <span aria-hidden="true">
          <span>MAP</span>
          <span>SIMILARITY</span>
        </span>
      </label>
      <label className="sw-atlas-check">
        <input
          type="checkbox"
          checked={trails}
          onChange={(e) => onTrails(e.target.checked)}
        />
        PATHS
      </label>
    </>
  )
}
