/**
 * The opening, as a small data story: a black bar chart on white, one bar per letter of the
 * name, whose bars and little value labels move up and down like a live feed. Then the bars fall
 * one by one, and as each falls its letter of "Anton Ernstsson" drops into its place. Software,
 * Data and AI rise in underneath; then the white screen fades and slides down, and the
 * portfolio is there underneath. Black on white, centred on every screen. The values are decoration, not data. Shown every time the site opens on the start page; a shared
 * link to another page opens straight on its content. A click, Enter or Escape skips it; with
 * reduced motion it is a short fade. Setting `ae-intro-seen` in sessionStorage skips it too
 * (the browser tests do, so they start on the content).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './intro.css'

const SKIP = 'ae-intro-seen'
const NAME = ['Anton', 'Ernstsson']
/** What he works with, rising in one after another under the name. */
const FIELDS = ['Software', 'Data', 'AI']
const LETTERS = NAME.join('').length
/** When the first bar falls, and the time between one bar and the next. */
const FALL = 1250
const STEP = 70
/** When the fields rise in and when the intro leaves. */
const FIELDS_AT = FALL + LETTERS * STEP + 250
const LEAVE_AT = FIELDS_AT + 900

const bars = () =>
  Array.from({ length: LETTERS }, () => ({
    h: 12 + Math.random() * 34,
    v: Math.round(10 + Math.random() * 89),
  }))

function shouldShow() {
  const hash = window.location.hash
  if (hash && !['#start', '#'].includes(hash)) return false
  try {
    return sessionStorage.getItem(SKIP) !== '1'
  } catch {
    return true
  }
}

export default function Intro() {
  const [phase, setPhase] = useState<'in' | 'leave' | 'gone'>(() =>
    shouldShow() ? 'in' : 'gone',
  )
  const name = useRef<HTMLParagraphElement>(null)
  const [values, setValues] = useState(bars)
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Leave: the white screen fades and slides down, and the start page is there underneath.
  const leave = (fast = false) => {
    setPhase((current) => (current === 'in' ? 'leave' : current))
    window.setTimeout(() => setPhase('gone'), fast ? 220 : reduced ? 250 : 750)
  }

  useEffect(() => {
    if (phase !== 'in') return
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => leave(), reduced ? 900 : LEAVE_AT)
    // The bars move like a live chart until they fall.
    const live = reduced ? 0 : window.setInterval(() => setValues(bars), 170)
    const stop = window.setTimeout(() => window.clearInterval(live), FALL)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        leave(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(stop)
      window.clearInterval(live)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // leave reads only refs and stable setters.
  }, [phase])

  if (phase === 'gone') return null
  return (
    <div
      className={`intro-screen${phase === 'leave' ? ' leaving' : ''}${reduced ? ' reduced' : ''}`}
      aria-hidden="true"
      onClick={() => leave(true)}
    >
      <div className="intro-stack">
        <p className="intro-name" ref={name}>
          {NAME.map((word, w) => (
            <span className="intro-word" key={word}>
              {[...word].map((letter, i) => {
                const index = w * NAME[0].length + i
                const bar = values[index]
                return (
                  <span
                    className="intro-letter"
                    key={i}
                    style={
                      {
                        '--i': index,
                        '--h': `${bar.h}vh`,
                        '--fall': `${FALL}ms`,
                        '--step': `${STEP}ms`,
                      } as CSSProperties
                    }
                  >
                    <span className="intro-bar" data-v={bar.v} />
                    <span className="intro-glyph">{letter}</span>
                  </span>
                )
              })}
            </span>
          ))}
        </p>
        <p className="intro-fields">
          {FIELDS.map((field, i) => (
            <span
              className="intro-field"
              key={field}
              style={{ ['--d' as string]: `${FIELDS_AT + i * 200}ms` }}
            >
              {field}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
