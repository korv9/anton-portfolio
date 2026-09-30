/**
 * The start of the start page is one bar chart around a centre line. Above the line, rising:
 * who Anton is and what he works with (the profile and each part of the tech stack). Below the
 * line, hanging: what he has done (each job, the education and the projects). The name and the
 * pitch sit over the chart; every bar is a button that opens what is behind it in the panel
 * where the name was, with links further in. The bars drift a little like a live chart; the
 * heights are decoration, the figures on the bars are real (a count or a period).
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import {
  CVS,
  EDUCATION,
  EXPERIENCE,
  FLAGSHIP,
  PITCH,
  PROJECTS,
  STACK,
  type Bilingual,
} from './content'

const b = (text: Bilingual) => l(text.en, text.sv)

type Kind = 'me' | 'stack' | 'work' | 'edu' | 'project'
type Bar = {
  id: string
  kind: Kind
  up: boolean
  label: string
  /** The figure on the bar: a real count or a period. */
  figure: string
  base: number
  title: string
  body: ReactNode
}

const KINDS: { kind: Kind; en: string; sv: string }[] = [
  { kind: 'me', en: 'About me', sv: 'Om mig' },
  { kind: 'stack', en: 'Tech stack', sv: 'Tech stack' },
  { kind: 'work', en: 'Experience', sv: 'Erfarenhet' },
  { kind: 'edu', en: 'Education', sv: 'Utbildning' },
  { kind: 'project', en: 'Projects', sv: 'Projekt' },
]

function years(period: Bilingual) {
  const found = [...new Set(period.en.match(/\d{4}/g) ?? [])]
  if (found.length < 2) return found[0] ?? ''
  return `${found[0]}–${found[found.length - 1].slice(2)}`
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="hero-chips">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function Contact() {
  return (
    <nav
      className="cv-actions"
      aria-label={l('Contact and CV', 'Kontakt och CV')}
    >
      <a className="cv-button primary" href={CVS[0].file} download>
        {l('Download CV', 'Ladda ned CV')} ↓
      </a>
      <a className="cv-button" href="#projekt">
        {l('See the projects', 'Se projekten')} →
      </a>
      {profile.email && (
        <a className="cv-button" href={`mailto:${profile.email}`}>
          {l('Email', 'Mejl')}
        </a>
      )}
      {profile.linkedin && (
        <a
          className="cv-button"
          href={profile.linkedin}
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn ↗
        </a>
      )}
      <a
        className="cv-button"
        href="https://github.com/korv9"
        target="_blank"
        rel="noreferrer"
      >
        GitHub ↗
      </a>
      <details className="cv-more-cvs">
        <summary>{l('CV by role', 'CV per roll')}</summary>
        <ul>
          {CVS.map((cv) => (
            <li key={cv.file}>
              <a href={cv.file} download>
                {b(cv.role)} ↓
              </a>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  )
}

function barsOf(): Bar[] {
  const ai = PROJECTS.filter((p) => p.area === 'ai')
  const data = PROJECTS.filter((p) => p.area === 'data')
  const up: Omit<Bar, 'base' | 'up'>[] = [
    {
      id: 'me',
      kind: 'me',
      label: l('About me', 'Om mig'),
      figure: 'Sthlm',
      title: 'Anton Ernstsson',
      body: (
        <>
          <p>{b(PITCH)}</p>
          <p className="hero-meta">
            {l(
              'Software Developer · Data Engineer · Analytics Engineer · Applied AI',
              'Software Developer · Data Engineer · Analytics Engineer · Tillämpad AI',
            )}
          </p>
          <p className="hero-links">
            <a href="#erfarenhet">{l('Experience', 'Erfarenhet')} →</a>
            <a href="#technical">Technical →</a>
          </p>
        </>
      ),
    },
    ...STACK.map((group) => ({
      id: `stack-${group.group.en}`,
      kind: 'stack' as const,
      label: b(group.group),
      figure: String(group.items.length),
      title: b(group.group),
      body: (
        <>
          <p>{b(group.use)}</p>
          <Chips items={group.items} />
          <p className="hero-links">
            <a href="#teknik">{l('The whole stack', 'Hela stacken')} →</a>
          </p>
        </>
      ),
    })),
  ]
  const down: Omit<Bar, 'base' | 'up'>[] = [
    ...EXPERIENCE.map((job) => ({
      id: `work-${job.org}`,
      kind: 'work' as const,
      label: job.org,
      figure: years(job.period),
      title: `${b(job.role)} · ${job.org}`,
      body: (
        <>
          <p className="hero-meta">
            {b(job.kind)} · {b(job.period)}
          </p>
          <ul className="hero-list">
            {job.did.map((d) => (
              <li key={d.sv}>{b(d)}</li>
            ))}
          </ul>
          {job.tech.length > 0 && <Chips items={job.tech} />}
        </>
      ),
    })),
    {
      id: 'edu',
      kind: 'edu',
      label: 'JENSEN',
      figure: years(EDUCATION.period),
      title: `${b(EDUCATION.role)} · ${EDUCATION.org}`,
      body: (
        <>
          <p className="hero-meta">{b(EDUCATION.period)}</p>
          <p>{b(EDUCATION.short)}</p>
        </>
      ),
    },
    ...[FLAGSHIP, ...ai, ...data]
      .filter((p) => p.href)
      .map((p) => ({
        id: `project-${p.id}`,
        kind: 'project' as const,
        label: b(p.title),
        figure: String(p.tech.length),
        title: b(p.title),
        body: (
          <>
            <p className="hero-meta">{b(p.kind)}</p>
            <p>{b(p.summary)}</p>
            <p>{b(p.result)}</p>
            <Chips items={p.tech} />
            <p className="hero-links">
              <a
                href={p.href}
                {...(p.href.startsWith('http')
                  ? { target: '_blank', rel: 'noreferrer' }
                  : {})}
              >
                {l('Open the project', 'Öppna projektet')}{' '}
                {p.href.startsWith('http') ? '↗' : '→'}
              </a>
            </p>
          </>
        ),
      })),
  ]
  // A gentle shape: the profile rises towards the right, the record hangs deeper towards the
  // middle. Decoration, stated as such on the page.
  const upH = [58, 46, 62, 74, 66, 84]
  const downH = [82, 74, 52, 60, 88, 70, 78, 64, 72, 56, 68, 50, 62]
  return [
    ...up.map((bar, i) => ({ ...bar, up: true, base: upH[i % upH.length] })),
    ...down.map((bar, i) => ({
      ...bar,
      up: false,
      base: downH[i % downH.length],
    })),
  ]
}

const still = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function HeroChart() {
  const bars = useMemo(barsOf, [])
  const ups = bars.filter((x) => x.up)
  const downs = bars.filter((x) => !x.up)
  const [open, setOpen] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [drift, setDrift] = useState<number[]>(() => bars.map(() => 0))
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (still()) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      setDrift(bars.map(() => Math.round((Math.random() - 0.5) * 12)))
    }, 1600)
    return () => window.clearInterval(id)
  }, [bars])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    // On a phone the panel is below the chart: bring it into view.
    if (window.matchMedia?.('(max-width: 760px)').matches)
      panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const chosen = bars.find((x) => x.id === open) ?? null
  const shown = bars.find((x) => x.id === hover)

  const column = (bar: Bar) => {
    const i = bars.indexOf(bar)
    const h = Math.max(18, Math.min(96, bar.base + drift[i]))
    const isOpen = open === bar.id
    return (
      <li
        key={bar.id}
        className={`hero-col ${bar.kind}${isOpen ? ' open' : ''}${open && !isOpen ? ' dim' : ''}`}
        style={{ '--h': `${h}%`, '--i': i } as CSSProperties}
      >
        <button
          type="button"
          className="hero-bar"
          aria-expanded={isOpen}
          aria-controls="hero-panel"
          aria-label={`${bar.label}: ${bar.title}`}
          onClick={() => setOpen(isOpen ? null : bar.id)}
          onMouseEnter={() => setHover(bar.id)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(bar.id)}
          onBlur={() => setHover(null)}
        >
          <span className="hero-figure">{bar.figure}</span>
        </button>
        <span className="hero-label" aria-hidden="true">
          {bar.label}
        </span>
      </li>
    )
  }

  return (
    <header className="hero" id="start">
      <div className="hero-chart">
        <ol
          className="hero-up"
          aria-label={l('About me and my stack', 'Om mig och min stack')}
        >
          {ups.map(column)}
        </ol>
        <div className="hero-axis" aria-hidden="true">
          <span>{l('who I am ↑', 'vem jag är ↑')}</span>
          <span>{l('what I have done ↓', 'vad jag har gjort ↓')}</span>
        </div>
        <ol
          className="hero-down"
          aria-label={l('Experience and projects', 'Erfarenhet och projekt')}
        >
          {downs.map(column)}
        </ol>
      </div>

      <div
        className={`hero-panel${chosen ? ' has-detail' : ''}`}
        id="hero-panel"
        ref={panel}
        aria-live="polite"
      >
        {chosen ? (
          <article className={`hero-detail ${chosen.kind}`}>
            <div className="hero-detail-head">
              <span className="hero-kind">
                {l(
                  KINDS.find((k) => k.kind === chosen.kind)!.en,
                  KINDS.find((k) => k.kind === chosen.kind)!.sv,
                )}
              </span>
              <button
                type="button"
                className="hero-close"
                onClick={() => setOpen(null)}
                aria-label={l('Close', 'Stäng')}
              >
                ✕
              </button>
            </div>
            <h2>{chosen.title}</h2>
            {chosen.body}
          </article>
        ) : (
          <div className="hero-intro">
            <p className="home-eyebrow">
              <span className="home-dot round" aria-hidden="true" />
              {l(
                'Stockholm · open to junior roles',
                'Stockholm · öppen för juniora roller',
              )}
            </p>
            <h1 className="cv-name">Anton Ernstsson</h1>
            <p className="cv-role">
              {l(
                'Software Developer · Data Engineer · Analytics Engineer · Applied AI',
                'Software Developer · Data Engineer · Analytics Engineer · Tillämpad AI',
              )}
            </p>
            <p className="cv-pitch">{b(PITCH)}</p>
            <Contact />
          </div>
        )}
      </div>

      <p className="hero-hint">
        {shown ? (
          <>
            <b>{shown.label}</b> · {shown.title}
          </>
        ) : (
          l(
            'Every bar opens: above the line who I am, below it what I have done. The heights are decoration; the figures on them are real.',
            'Varje stapel går att öppna: ovanför linjen vem jag är, under den vad jag har gjort. Höjderna är dekoration, siffrorna på dem är riktiga.',
          )
        )}
      </p>
      <ul className="hero-legend" aria-label={l('Legend', 'Förklaring')}>
        {KINDS.map((k) => (
          <li key={k.kind} className={k.kind}>
            {l(k.en, k.sv)}
          </li>
        ))}
      </ul>
    </header>
  )
}
