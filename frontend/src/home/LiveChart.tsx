/**
 * The profile as a live bar chart: one bar per job, the education, each part of the stack and
 * the projects. The bars drift slightly like a chart on a live feed (decoration: the heights
 * are not data). Hovering lifts a bar; clicking it grows the bar to the top and opens what is
 * behind it, with links further in. Escape, the close button or a second click closes it.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { l } from '../i18n'
import {
  EDUCATION,
  EXPERIENCE,
  FLAGSHIP,
  PROJECTS,
  STACK,
  type Bilingual,
} from './content'

const b = (text: Bilingual) => l(text.en, text.sv)

/** A period as years only, short enough to sit on a bar: "Nov 2025–Jan 2026" → "2025–26". */
function years(period: Bilingual) {
  const found = [...new Set(period.en.match(/\d{4}/g) ?? [])]
  if (found.length < 2) return found[0] ?? ''
  const [first, last] = [found[0], found[found.length - 1]]
  return `${first}–${last.slice(2)}`
}

type Kind = 'work' | 'edu' | 'stack' | 'project'
type Bar = {
  id: string
  kind: Kind
  label: string
  /** The small figure on top of the bar: a real count or a period, never a made-up value. */
  top: string
  base: number
  title: string
  body: ReactNode
}

const KINDS: { kind: Kind; en: string; sv: string }[] = [
  { kind: 'work', en: 'Experience', sv: 'Erfarenhet' },
  { kind: 'edu', en: 'Education', sv: 'Utbildning' },
  { kind: 'stack', en: 'Tech stack', sv: 'Tech stack' },
  { kind: 'project', en: 'Projects', sv: 'Projekt' },
]

function chips(items: string[]) {
  return (
    <ul className="live-chips">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function barsOf(): Bar[] {
  const ai = PROJECTS.filter((p) => p.area === 'ai')
  const heights = [78, 70, 44, 66, 84, 72, 62, 58, 50, 90, 80]
  const bars: Omit<Bar, 'base'>[] = [
    ...EXPERIENCE.map((job) => ({
      id: `work-${job.org}`,
      kind: 'work' as const,
      label: job.org,
      top: years(job.period),
      title: `${b(job.role)} · ${job.org}`,
      body: (
        <>
          <p className="live-meta">
            {b(job.kind)} · {b(job.period)}
          </p>
          <ul className="live-list">
            {job.did.map((d) => (
              <li key={d.sv}>{b(d)}</li>
            ))}
          </ul>
          {job.tech.length > 0 && chips(job.tech)}
          <p className="live-links">
            <a href="#erfarenhet">{l('All experience', 'All erfarenhet')} →</a>
          </p>
        </>
      ),
    })),
    {
      id: 'edu',
      kind: 'edu',
      label: 'JENSEN',
      top: years(EDUCATION.period),
      title: `${b(EDUCATION.role)} · ${EDUCATION.org}`,
      body: (
        <>
          <p className="live-meta">{b(EDUCATION.period)}</p>
          <p>{b(EDUCATION.short)}</p>
          <p className="live-links">
            <a href="#erfarenhet">{l('Experience', 'Erfarenhet')} →</a>
          </p>
        </>
      ),
    },
    ...STACK.map((group) => ({
      id: `stack-${group.group.en}`,
      kind: 'stack' as const,
      label: b(group.group),
      top: String(group.items.length),
      title: b(group.group),
      body: (
        <>
          <p>{b(group.use)}</p>
          {chips(group.items)}
          <p className="live-links">
            <a href="#teknik">{l('The whole stack', 'Hela stacken')} →</a>
            <a href="#technical">
              {l('How it is used: Technical', 'Hur den används: Technical')} →
            </a>
          </p>
        </>
      ),
    })),
    {
      id: 'politics',
      kind: 'project',
      label: 'Political Observatory',
      top: String(FLAGSHIP.tech.length),
      title: b(FLAGSHIP.title),
      body: (
        <>
          <p>{b(FLAGSHIP.summary)}</p>
          {chips(FLAGSHIP.tech)}
          <p className="live-links">
            <a href="#politik">
              {l('Open the dashboard', 'Öppna dashboarden')} →
            </a>
          </p>
        </>
      ),
    },
    {
      id: 'ai',
      kind: 'project',
      label: l('AI projects', 'AI-projekt'),
      top: String(ai.length),
      title: l('AI and machine learning', 'AI och maskininlärning'),
      body: (
        <>
          <ul className="live-list links">
            {ai.map((p) => (
              <li key={p.id}>
                {p.href ? (
                  <a
                    href={p.href}
                    {...(p.href.startsWith('http')
                      ? { target: '_blank', rel: 'noreferrer' }
                      : {})}
                  >
                    {b(p.title)}
                  </a>
                ) : (
                  b(p.title)
                )}
                <small> · {b(p.kind)}</small>
              </li>
            ))}
          </ul>
          <p className="live-links">
            <a href="#projekt">{l('All projects', 'Alla projekt')} →</a>
          </p>
        </>
      ),
    },
  ]
  return bars.map((bar, i) => ({ ...bar, base: heights[i % heights.length] }))
}

const still = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function LiveChart() {
  const bars = barsOf()
  const [open, setOpen] = useState<string | null>(null)
  const [drift, setDrift] = useState<number[]>(() => bars.map(() => 0))

  // The live feed: every bar drifts a few percent, smoothly, while the tab is visible.
  useEffect(() => {
    if (still()) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      setDrift(bars.map(() => Math.round((Math.random() - 0.5) * 14)))
    }, 1500)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <section
      className={`live${open ? ' has-open' : ''}`}
      aria-labelledby="live-title"
    >
      <div className="live-head">
        <h2 id="live-title" className="home-section-title">
          {l('My profile, live', 'Min profil, live')}
        </h2>
        <p className="live-status">
          <span className="home-dot" aria-hidden="true" /> Live
        </p>
        <ul className="live-legend" aria-label={l('Legend', 'Förklaring')}>
          {KINDS.map((k) => (
            <li key={k.kind} className={k.kind}>
              {l(k.en, k.sv)}
            </li>
          ))}
        </ul>
      </div>
      <p className="live-hint">
        {l(
          'Hover to lift a bar, click to open it. The heights are decoration, the content is not.',
          'Hovra för att lyfta en stapel, klicka för att öppna den. Höjderna är dekoration, innehållet är det inte.',
        )}
      </p>
      <div className="live-scroll">
        <ol className="live-bars">
          {bars.map((bar, i) => {
            const isOpen = open === bar.id
            const h = Math.max(20, Math.min(96, bar.base + drift[i]))
            return (
              <li
                key={bar.id}
                className={`live-col ${bar.kind}${isOpen ? ' open' : ''}`}
                style={{ '--h': `${h}%`, '--i': i } as CSSProperties}
              >
                <div className="live-track">
                  <button
                    type="button"
                    className="live-fill"
                    aria-expanded={isOpen}
                    aria-controls={`live-${bar.id}`}
                    onClick={() => setOpen(isOpen ? null : bar.id)}
                  >
                    <span className="live-top">{bar.top}</span>
                    <span className="sr-only">{bar.title}</span>
                  </button>
                  <div
                    className="live-detail"
                    id={`live-${bar.id}`}
                    hidden={!isOpen}
                  >
                    <div className="live-detail-head">
                      <h3>{bar.title}</h3>
                      <button
                        type="button"
                        className="live-close"
                        onClick={() => setOpen(null)}
                        aria-label={l('Close', 'Stäng')}
                      >
                        ✕
                      </button>
                    </div>
                    {bar.body}
                  </div>
                </div>
                <span className="live-label" aria-hidden="true">
                  {bar.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
