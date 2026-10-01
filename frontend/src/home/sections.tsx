/**
 * The start page's parts: a section frame, the hero, a featured project, the degree project's
 * figure, the experience timeline, the tools, the smaller work and the contact. Each reads its
 * words from content.ts; nothing here loads project data.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import { fetchJson } from '../welfare/data'
import {
  CVS,
  EDUCATION,
  EXPERIENCE,
  HERO,
  STACK,
  THESIS_SILHOUETTE,
  THESIS_STEPS,
  WORK,
  type Bilingual,
  type WorkItem,
} from './content'
import { countUp } from './reveal'

const b = (text: Bilingual) => l(text.en, text.sv)

export function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <section className="pf-section" id={id} aria-labelledby={`${id}-title`}>
      <header className="pf-section-head reveal">
        <h2 id={`${id}-title`}>{title}</h2>
        {lead && <p className="pf-section-lead">{lead}</p>}
      </header>
      {children}
    </section>
  )
}

export function Hero() {
  return (
    <header className="pf-hero" id="start">
      <p className="pf-hero-eyebrow">
        <span className="home-dot round" aria-hidden="true" />
        {l(
          'Stockholm · open to junior roles',
          'Stockholm · öppen för juniora roller',
        )}
      </p>
      <h1 className="pf-name">Anton Ernstsson</h1>
      <p className="pf-roles">{b(HERO.roles)}</p>
      <p className="pf-line">{b(HERO.line)}</p>
      <div className="pf-hero-actions">
        <a className="pf-button primary" href="#work">
          {l('View projects', 'Se projekten')} <span aria-hidden="true">↓</span>
        </a>
        <a className="pf-button" href="#om-mig">
          {l('About me', 'Om mig')}
        </a>
        <a className="pf-text-link" href={CVS[0].file} download>
          {l('Download CV', 'Ladda ned CV')} <span aria-hidden="true">↓</span>
        </a>
      </div>
    </header>
  )
}

type Summary = { models: number; tests: number; sources: number; rows: number }

/** The platform behind the politics product, four figures from the dbt schema export. */
function PlatformFigures() {
  const [s, setS] = useState<Summary | null>(null)
  useEffect(() => {
    fetchJson<Summary>('schema/summary.json')
      .then(setS)
      .catch(() => setS(null))
  }, [])
  if (!s) return null
  const figures: [number, number, string, string][] = [
    [s.models, 0, 'dbt models', 'dbt-modeller'],
    [s.tests, 0, 'data tests', 'datatester'],
    [s.sources, 0, 'source tables', 'källtabeller'],
    [s.rows / 1e6, 1, 'million rows', 'miljoner rader'],
  ]
  return (
    <dl
      className="pf-figures"
      aria-label={l('The platform in numbers', 'Plattformen i siffror')}
    >
      {figures.map(([value, decimals, en, sv]) => (
        <div key={en}>
          <dt>{l(en, sv)}</dt>
          <dd>
            <Count value={value} decimals={decimals} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Count({ value, decimals }: { value: number; decimals: number }) {
  const el = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = el.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      countUp(node, value, l('en-GB', 'sv-SE'), decimals)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [value, decimals])
  return (
    <strong ref={el}>
      {value.toLocaleString(l('en-GB', 'sv-SE'), {
        maximumFractionDigits: decimals,
      })}
    </strong>
  )
}

/** The degree project's figure: three steps and the two methods' silhouette, as reported. */
function ThesisFigure() {
  return (
    <figure className="pf-thesis">
      <ol className="pf-thesis-steps">
        {THESIS_STEPS.map((step, i) => (
          <li key={step.title.en}>
            <span className="pf-thesis-n" aria-hidden="true">
              {i + 1}
            </span>
            <b>{b(step.title)}</b>
            <p>{b(step.body)}</p>
          </li>
        ))}
      </ol>
      <div className="pf-thesis-bars">
        <p>
          {l(
            'Cluster separation (silhouette, higher is better)',
            'Klusterseparation (silhouett, högre är bättre)',
          )}
        </p>
        <ul>
          {THESIS_SILHOUETTE.map((m) => (
            <li key={m.method}>
              <span>{m.method}</span>
              <span className="pf-bar" aria-hidden="true">
                <i style={{ width: `${m.value * 100}%` }} />
              </span>
              <b>{m.value.toFixed(3)}</b>
            </li>
          ))}
        </ul>
      </div>
      <figcaption>
        {l(
          'From the case study. The incident texts are internal and not published.',
          'Från fallstudien. Incidenttexterna är interna och publiceras inte.',
        )}
      </figcaption>
    </figure>
  )
}

export function FeaturedProject({
  item,
  index,
}: {
  item: WorkItem
  index: number
}) {
  const id = `work-${item.slug}`
  return (
    <article
      className={`pf-project reveal${index % 2 ? ' is-flipped' : ''}`}
      aria-labelledby={id}
    >
      <div className="pf-project-text">
        <p className="pf-kind">
          <span className="pf-project-index">
            {String(index + 1).padStart(2, '0')}
          </span>
          {b(item.kind)}
        </p>
        <h3 id={id}>
          <a href={item.href}>{b(item.title)}</a>
        </h3>
        <p className="pf-desc">{b(item.description)}</p>
        {item.problem && (
          <p className="pf-problem">
            <span>{l('The problem', 'Problemet')}</span>
            {b(item.problem)}
          </p>
        )}
        {item.slug === 'politics' && <PlatformFigures />}
        <ul className="pf-tags" aria-label={l('Technologies', 'Tekniker')}>
          {item.tech.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <a className="pf-cta" href={item.href}>
          {b(item.cta)} <span aria-hidden="true">→</span>
        </a>
      </div>
      {item.image ? (
        <figure className="pf-preview">
          <img
            src={item.image.src}
            alt={b(item.image.alt)}
            width={item.image.width}
            height={item.image.height}
            loading="lazy"
            decoding="async"
          />
        </figure>
      ) : (
        <ThesisFigure />
      )}
    </article>
  )
}

export function SelectedWork() {
  return (
    <div className="pf-projects">
      {WORK.filter((w) => w.featured).map((item, i) => (
        <FeaturedProject key={item.slug} item={item} index={i} />
      ))}
    </div>
  )
}

/** The jobs and the education, newest first: a period, a role and one line each. */
export function ExperienceTimeline() {
  const entries = [
    ...EXPERIENCE.slice(0, 2).map((job) => ({
      key: job.org,
      period: job.period,
      role: job.role,
      org: job.org,
      kind: job.kind,
      short: job.short,
      tech: job.tech.slice(0, 4),
    })),
    {
      key: EDUCATION.org,
      period: EDUCATION.period,
      role: EDUCATION.role,
      org: EDUCATION.org,
      kind: { en: 'Education', sv: 'Utbildning' },
      short: EDUCATION.short,
      tech: [],
    },
    ...EXPERIENCE.slice(2).map((job) => ({
      key: job.org,
      period: job.period,
      role: job.role,
      org: job.org,
      kind: job.kind,
      short: job.short,
      tech: job.tech.slice(0, 4),
    })),
  ]
  return (
    <ol className="pf-timeline reveal">
      {entries.map((e) => (
        <li key={e.key}>
          <p className="pf-when">{b(e.period)}</p>
          <div>
            <h3>
              {b(e.role)} <span>· {e.org}</span>
            </h3>
            <p className="pf-timeline-kind">{b(e.kind)}</p>
            <p>{b(e.short)}</p>
            {e.tech.length > 0 && (
              <p className="pf-timeline-tech">{e.tech.join(' · ')}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The tools, grouped by what they are used for; plain lists, no badges. */
export function SkillGroups() {
  return (
    <div className="pf-skills reveal">
      {STACK.map((group) => (
        <div className="pf-skill" key={group.group.en}>
          <h3>{b(group.group)}</h3>
          <p className="pf-skill-use">{b(group.use)}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Smaller work: a name, a line, the tools and the links. */
export function OtherWork() {
  return (
    <>
      <ul className="pf-other reveal">
        {WORK.filter((w) => !w.featured).map((item) => (
          <li key={item.slug}>
            <p className="pf-kind">{b(item.kind)}</p>
            <h3>
              <a href={item.href}>{b(item.title)}</a>
            </h3>
            <p>{b(item.description)}</p>
            <p className="pf-timeline-tech">{item.tech.join(' · ')}</p>
            <p className="pf-other-links">
              <a href={item.href}>
                {b(item.cta)} <span aria-hidden="true">→</span>
              </a>
              {item.code && (
                <a href={item.code} target="_blank" rel="noreferrer">
                  GitHub <span aria-hidden="true">↗</span>
                </a>
              )}
            </p>
          </li>
        ))}
      </ul>
      <p className="pf-more reveal">
        <a href="#projekt">
          {l('Every project on the site', 'Alla projekt på sajten')}{' '}
          <span aria-hidden="true">→</span>
        </a>
      </p>
    </>
  )
}

export function ContactSection() {
  const links = [
    profile.email && {
      label: profile.email,
      kind: l('Email', 'Mejl'),
      href: `mailto:${profile.email}`,
    },
    profile.linkedin && {
      label: 'linkedin.com/in/anton-ernstsson',
      kind: 'LinkedIn',
      href: profile.linkedin,
    },
    {
      label: 'github.com/korv9',
      kind: 'GitHub',
      href: 'https://github.com/korv9',
    },
  ].filter(Boolean) as { label: string; kind: string; href: string }[]
  return (
    <div className="pf-contact reveal">
      <ul className="pf-contact-links">
        {links.map((c) => (
          <li key={c.href}>
            <span>{c.kind}</span>
            <a
              href={c.href}
              {...(c.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {c.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="pf-cvs">
        <p>{l('CV by role', 'CV per roll')}</p>
        <ul>
          {CVS.map((cv) => (
            <li key={cv.file}>
              <a href={cv.file} download>
                {b(cv.role)} <span aria-hidden="true">↓</span>
              </a>
              <span>{b(cv.focus)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
