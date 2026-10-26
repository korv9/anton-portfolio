/**
 * SWEDEN on one page: the platform's question, a jump row, and every research product as a short
 * section (template.tsx), A to F and Connections. A product's own address (router.ts
 * SWEDEN_PATHS) scrolls to its section. A product whose data cannot be read shows its question
 * and an EmptyState, never sample findings.
 */
import { lazy, Suspense, useEffect } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { SWEDEN_PRODUCTS } from './products'
import { sectionId } from './template'
import './sweden.css'

const SECTIONS = {
  A: lazy(() => import('./Measurement')),
  B: lazy(() => import('./Language')),
  C: lazy(() => import('./Similarity')),
  D: lazy(() => import('./Belonging')),
  E: lazy(() => import('./Futures')),
  F: lazy(() => import('./Welfare')),
  X: lazy(() => import('./Connections')),
}
const b = (text: { en: string; sv: string }) => l(text.en, text.sv)

/** The reader's last pointer or key input, so a section's own controls never scroll the page. */
let lastInput = { target: null as EventTarget | null, at: 0 }
const noteInput = (e: Event) => {
  lastInput = { target: e.target, at: Date.now() }
}

/**
 * Keep the route's section at the top while the sections above it load and grow, until it holds
 * or the reader scrolls themselves. A change made inside the section (its filters write the
 * address) leaves the page where it is.
 */
function useScrollToSection(path: string) {
  useEffect(() => {
    const product = SWEDEN_PRODUCTS.find((p) => p.href === path)
    if (!product) return
    const own = document.getElementById(sectionId(product))
    if (
      own &&
      lastInput.target instanceof Node &&
      own.contains(lastInput.target) &&
      Date.now() - lastInput.at < 1500
    )
      return
    let held = 0
    const tick = setInterval(() => {
      const section = document.getElementById(sectionId(product))
      if (!section) return
      // Where scrollIntoView puts it: below the sticky jump row (its scroll-margin and the
      // page's scroll-padding).
      const offset =
        section.getBoundingClientRect().top -
        parseFloat(getComputedStyle(section).scrollMarginTop) -
        (parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) || 0)
      if (Math.abs(offset) < 4) held += 1
      else {
        held = 0
        section.scrollIntoView({ behavior: 'instant' })
      }
      if (held >= 4) stop()
    }, 250)
    const limit = setTimeout(() => stop(), 8000)
    const events = ['wheel', 'touchstart', 'keydown'] as const
    const stop = () => {
      clearInterval(tick)
      clearTimeout(limit)
      events.forEach((e) => window.removeEventListener(e, stop))
    }
    events.forEach((e) => window.addEventListener(e, stop, { passive: true }))
    return stop
  }, [path])
}

export default function SwedenPage({ route }: { route: Route }) {
  useScrollToSection(route.path)
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'change'] as const
    events.forEach((e) => document.addEventListener(e, noteInput, true))
    return () =>
      events.forEach((e) => document.removeEventListener(e, noteInput, true))
  }, [])
  return (
    <article className="sweden sw-one">
      <header className="sw-intro">
        <a className="sw-back" href="#projects">
          ← {l('Projects', 'Projekt')}
        </a>
        <p className="sw-kicker">SWEDEN</p>
        <h1>
          {l(
            'What do we measure, what do we value, and what do we overlook?',
            'Vad mäter vi, vad värderar vi, och vad förbiser vi?',
          )}
        </h1>
        <p className="sw-lead">
          {l(
            'Six research questions about Sweden, and the connections between them, on public data.',
            'Sex forskningsfrågor om Sverige, och sambanden mellan dem, på offentliga data.',
          )}
        </p>
      </header>
      <nav className="sw-jump" aria-label={l('Sections', 'Avsnitt')}>
        {SWEDEN_PRODUCTS.map((p) => (
          <a
            key={p.id}
            href={p.href}
            aria-current={p.href === route.path ? 'location' : undefined}
          >
            <b>{p.id === 'X' ? '×' : p.id}</b> {b(p.short)}
          </a>
        ))}
      </nav>
      {SWEDEN_PRODUCTS.map((p) => {
        const Section = SECTIONS[p.id]
        return (
          <Suspense
            key={p.id}
            fallback={
              <p className="sw-section sw-note" role="status">
                {l('Loading…', 'Laddar…')}
              </p>
            }
          >
            {/* Each product owns its address: its filters live in the query only while it is
                the current one, so two products never read each other's parameters. */}
            <Section
              route={{
                ...route,
                path: p.href,
                params:
                  p.href === route.path ? route.params : new URLSearchParams(),
              }}
            />
          </Suspense>
        )
      })}
    </article>
  )
}
