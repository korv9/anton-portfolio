/**
 * The opening: the name, very large in white on black, first drawn as an outline and then
 * filled, word by word; after about 1.5 seconds it shrinks into the header's wordmark and the
 * portfolio is there underneath. Shown every time the site opens on the start page; a shared
 * link to another page opens straight on its content. A click, Enter or Escape skips it; with
 * reduced motion it is a short fade. Setting `ae-intro-seen` in sessionStorage skips it too
 * (the browser tests do, so they start on the content).
 */
import { useEffect, useRef, useState } from 'react'
import './intro.css'

const SKIP = 'ae-intro-seen'
const NAME = ['Anton', 'Ernstsson']

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
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Leave: move the name onto the header wordmark (FLIP), then remove the overlay.
  const leave = (fast = false) => {
    setPhase((current) => (current === 'in' ? 'leave' : current))
    const el = name.current
    const target = document.querySelector('.wordmark-name')
    if (el && target && !reduced && !fast) {
      const from = el.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      const scale = to.height / from.height
      el.style.transformOrigin = 'top left'
      el.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${Math.max(scale, 0.05)})`
    }
    window.setTimeout(() => setPhase('gone'), fast ? 160 : reduced ? 250 : 520)
  }

  useEffect(() => {
    if (phase !== 'in') return
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => leave(), reduced ? 700 : 1500)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        leave(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
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
      <p className="intro-name" ref={name}>
        {NAME.map((word, w) => (
          <span className="intro-word" key={word}>
            {[...word].map((letter, i) => (
              <span
                className="intro-letter"
                key={i}
                style={{ animationDelay: `${(w * word.length + i) * 28}ms` }}
              >
                {letter}
              </span>
            ))}
          </span>
        ))}
      </p>
    </div>
  )
}
