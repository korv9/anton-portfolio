/**
 * The start page's first screen: a diverging bar chart that fills the screen and then reveals the
 * name and the three titles. Every row is its own clipped band; the bars grow out from a vertical
 * centre line, rest, and slide down inside their band, uncovering the text under the name and
 * title bars. The filler bars above and below go the same way, and the line fades.
 *
 * The text is real HTML and laid out from the start, so nothing moves when the bars leave. The
 * animation runs once per session; on a return visit, with reduced motion, or if the timer below
 * never fires, the screen is simply the name and the titles (the bars are hidden unless the
 * section has `is-playing`).
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { l } from '../i18n'
import './intro.css'

const SEEN = 'anton-portfolio-intro'
// The last bar has left by about 1.7 s and the line has faded by 1.9 s (intro.css).
const DURATION = 2100

type Fill = { left: number; right: number; thick: number; minor: boolean }

/** Filler rows from a fixed seed, so the chart looks the same on every visit. */
function fillers(count: number, seed: number): Fill[] {
  let s = seed
  const next = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  return Array.from({ length: count }, (_, i) => {
    const long = next() < 0.22
    const length = () => (long ? 0.86 + next() * 0.11 : 0.12 + next() * 0.7)
    return {
      left: length(),
      right: length(),
      thick: 5 + Math.round(next() * 7),
      // Every third row drops out on a short or narrow screen.
      minor: i % 3 === 1,
    }
  })
}

const ABOVE = fillers(15, 7)
const BELOW = fillers(7, 31)

const TITLES: [string, string][] = [
  ['Software', 'Developer'],
  ['Data', 'Engineering'],
  ['AI', 'Engineering'],
]

/** Whether to play now: once per session, never with reduced motion. */
function shouldPlay() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return false
    return sessionStorage.getItem(SEEN) !== '1'
  } catch {
    return false
  }
}

function FillRows({ rows, from }: { rows: Fill[]; from: number }) {
  return rows.map((row, k) => (
    <div
      key={k}
      className={`intro-fill${row.minor ? ' is-minor' : ''}`}
      style={{ '--i': from + k, '--t': `${row.thick}px` } as CSSProperties}
    >
      <div className="intro-band">
        <i style={{ '--w': row.left } as CSSProperties} />
        <i style={{ '--w': row.right } as CSSProperties} />
      </div>
    </div>
  ))
}

export default function IntroChart() {
  const [playing, setPlaying] = useState(shouldPlay)
  useEffect(() => {
    if (!playing) return
    try {
      sessionStorage.setItem(SEEN, '1')
    } catch {
      /* storage blocked: the intro may play again, nothing else changes */
    }
    // Ends the intro even if the animations never run, so the bars cannot stay over the text.
    const done = window.setTimeout(() => setPlaying(false), DURATION)
    return () => window.clearTimeout(done)
  }, [playing])

  const name = ABOVE.length
  return (
    <div className={`intro${playing ? ' is-playing' : ''}`}>
      <div className="intro-half intro-above" aria-hidden="true">
        <FillRows rows={ABOVE} from={0} />
      </div>
      <h1
        id="home-name"
        className="intro-row intro-name"
        style={{ '--i': name } as CSSProperties}
      >
        <span>Anton</span> <span>Ernstsson</span>
      </h1>
      <div className="intro-half intro-below">
        <ul className="intro-titles" aria-label={l('Roles', 'Roller')}>
          {TITLES.map(([left, right], k) => (
            <li
              key={left}
              className="intro-row intro-title"
              style={{ '--i': name + 1 + k } as CSSProperties}
            >
              <span>{left}</span> <span>{right}</span>
            </li>
          ))}
        </ul>
        <div className="intro-below-fill" aria-hidden="true">
          <FillRows rows={BELOW} from={name + 1 + TITLES.length} />
        </div>
      </div>
    </div>
  )
}
