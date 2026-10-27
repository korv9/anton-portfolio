/**
 * SWEDEN on one page: the shared head (name, one sentence, KPIs), a jump row, and every research product as a short
 * section (template.tsx), A to F and Connections. A product's own address (router.ts
 * SWEDEN_PATHS) scrolls to its section. A product whose data cannot be read shows its question
 * and an EmptyState, never sample findings.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import { count } from '../format'
import PageHead, { type Kpi } from '../ui/PageHead'
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

/** The page's KPIs, from the four small coverage files; a file that cannot be read drops its KPI. */
function useKpis() {
  const [kpis, setKpis] = useState<Kpi[]>([])
  useEffect(() => {
    const read = <T,>(
      path: string,
      pick: (d: T) => number,
      label: string,
    ): Promise<Kpi | null> =>
      fetchJson<T>(path).then(
        (d) => ({ value: count(pick(d)), label }),
        () => null,
      )
    Promise.all([
      read<{ totals: { items: number }[] }>(
        'sweden/measurement/summary.json',
        (d) => d.totals.reduce((n, t) => n + t.items, 0),
        l(
          'Official statistics catalogued',
          'Officiell statistik katalogiserad',
        ),
      ),
      read<{ archives: { distinct_texts: number }[] }>(
        'sweden/language/coverage.json',
        (d) => d.archives.reduce((n, a) => n + a.distinct_texts, 0),
        l('Job-ad texts read', 'Annonstexter lästa'),
      ),
      read<{ sessions: { speeches: number }[] }>(
        'sweden/futures/coverage.json',
        (d) => d.sessions.reduce((n, s) => n + s.speeches, 0),
        l('Riksdag speeches read', 'Riksdagsanföranden lästa'),
      ),
      read<{ public_libraries_registered: number }>(
        'sweden/belonging/coverage.json',
        (d) => d.public_libraries_registered,
        l('Public libraries mapped', 'Folkbibliotek kartlagda'),
      ),
    ]).then((all) => setKpis(all.filter((k) => k !== null)))
  }, [])
  return kpis
}

export default function SwedenPage({ route }: { route: Route }) {
  useScrollToSection(route.path)
  const kpis = useKpis()
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'change'] as const
    events.forEach((e) => document.addEventListener(e, noteInput, true))
    return () =>
      events.forEach((e) => document.removeEventListener(e, noteInput, true))
  }, [])
  return (
    <article className="sweden sw-one">
      <PageHead
        title="SWEDEN"
        sentence={l(
          'Six questions about Sweden, answered with public data.',
          'Sex frågor om Sverige, besvarade med öppna data.',
        )}
        kpis={kpis}
      />
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
