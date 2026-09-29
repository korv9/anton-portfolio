/**
 * The start page, airy on purpose: who Anton is in two sentences, the platform behind the site
 * in four real numbers (read from the dbt schema export), the politics product, three chosen
 * projects with a link to all of them, then experience and the stack. Sections rise into view
 * as the reader scrolls.
 */
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
import { useEffect, useRef, useState } from 'react'
import { fetchJson } from '../welfare/data'
import ProjectTile from '../projects/ProjectTile'
import LiveChart from './LiveChart'
import { countUp, useReveal } from './reveal'
import './home.css'

const b = (text: Bilingual) => l(text.en, text.sv)

/** The politics product as a pipeline: each step is a skill a recruiter can check. */
const PIPELINE: [string, string][] = [
  ['Sources', 'Källor'],
  ['Python ingestion', 'Inläsning i Python'],
  ['dbt + DuckDB, tested', 'dbt + DuckDB, testat'],
  ['Parquet in R2', 'Parquet i R2'],
  ['React dashboard', 'React-dashboard'],
]

type Stat = { value: number; decimals?: number; en: string; sv: string }

/** Four numbers about the platform, read from the dbt schema export the Technical page uses. */
function useStats(): Stat[] | null {
  const [stats, setStats] = useState<Stat[] | null>(null)
  useEffect(() => {
    type Schema = {
      tests: number
      layers: Record<string, number>
      nodes: { kind: string; rows: number | null }[]
    }
    fetchJson<Schema>('schema/models.json')
      .then((schema) =>
        setStats([
          {
            value: schema.nodes.filter((n) => n.kind === 'model').length,
            en: 'dbt models',
            sv: 'dbt-modeller',
          },
          { value: schema.tests, en: 'data tests', sv: 'datatester' },
          {
            value: schema.layers.source ?? 0,
            en: 'source tables from agencies',
            sv: 'källtabeller från myndigheter',
          },
          {
            value:
              schema.nodes.reduce((sum, n) => sum + (n.rows ?? 0), 0) / 1e6,
            decimals: 1,
            en: 'million rows in the warehouse',
            sv: 'miljoner rader i lagret',
          },
        ]),
      )
      .catch(() => setStats(null))
  }, [])
  return stats
}

function StatValue({ stat }: { stat: Stat }) {
  const el = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = el.current
    if (!node) return
    const locale = l('en-GB', 'sv-SE')
    const run = () => countUp(node, stat.value, locale, stat.decimals ?? 0)
    if (!('IntersectionObserver' in window)) return run()
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      run()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [stat])
  return (
    <strong ref={el}>
      {stat.value.toLocaleString(l('en-GB', 'sv-SE'), {
        maximumFractionDigits: stat.decimals ?? 0,
      })}
    </strong>
  )
}

const HIGHLIGHTS = ['tallman', 'drugcomb', 'thesis']

export default function HomePage() {
  const stats = useStats()
  const root = useReveal<HTMLDivElement>([stats])
  return (
    <div className="cv home" ref={root}>
      <p className="home-notice" role="note">
        <span aria-hidden="true">⚒</span>
        {l(
          'This site is still being built. I am a developer and data engineer, not a frontend designer or UX person, so some parts may look a little messy for now.',
          'Sajten byggs fortfarande. Jag är utvecklare och data engineer, inte frontend-designer eller UX:are, så vissa delar kan se lite röriga ut just nu.',
        )}
      </p>

      <header className="home-hero" id="start">
        <div className="home-hero-bg" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
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
      </header>

      <LiveChart />

      {stats && (
        <section
          className="home-stats reveal"
          aria-label={l('The platform in numbers', 'Plattformen i siffror')}
        >
          <ul>
            {stats.map((stat, i) => (
              <li key={stat.sv} style={{ ['--i' as string]: i }}>
                <StatValue stat={stat} />
                <span>{l(stat.en, stat.sv)}</span>
              </li>
            ))}
          </ul>
          <a href="#technical">
            {l(
              'How it all fits together: Technical',
              'Hur allt hänger ihop: Technical',
            )}{' '}
            →
          </a>
        </section>
      )}

      <section className="home-section reveal" aria-labelledby="flagship-title">
        <h2 className="home-section-title" id="flagship-title">
          {l('The main project', 'Huvudprojektet')}
        </h2>
        <a className="cv-flagship" href={FLAGSHIP.href}>
          <div>
            <span className="cv-kind">{b(FLAGSHIP.kind)}</span>
            <h3>
              {b(FLAGSHIP.title)} <span aria-hidden="true">→</span>
            </h3>
            <p>{b(FLAGSHIP.result)}</p>
          </div>
          <ol
            className="cv-pipeline"
            aria-label={l('How it is built', 'Hur den är byggd')}
          >
            {PIPELINE.map(([en, sv], i) => (
              <li key={en} style={{ ['--i' as string]: i }}>
                {l(en, sv)}
              </li>
            ))}
          </ol>
          <span className="cv-flagship-cta">
            {l('Open the dashboard', 'Öppna dashboarden')} →
          </span>
        </a>
      </section>

      <section className="home-section reveal" aria-labelledby="picked-title">
        <div className="home-section-head">
          <h2 className="home-section-title" id="picked-title">
            {l('AI projects', 'AI-projekt')}
          </h2>
          <a className="home-more" href="#projekt">
            {l(
              `All ${PROJECTS.length + 1} projects`,
              `Alla ${PROJECTS.length + 1} projekt`,
            )}{' '}
            →
          </a>
        </div>
        <ul className="cv-tiles">
          {HIGHLIGHTS.map((id) => PROJECTS.find((p) => p.id === id)!).map(
            (project) => (
              <ProjectTile key={project.id} project={project} />
            ),
          )}
        </ul>
      </section>

      <div className="cv-overview reveal">
        <section
          className="cv-panel"
          id="erfarenhet"
          aria-labelledby="erfarenhet-title"
        >
          <h2 className="cv-panel-title" id="erfarenhet-title">
            {l('Experience', 'Erfarenhet')}
          </h2>
          <ol className="cv-jobs">
            {EXPERIENCE.map((job) => (
              <li key={job.org} className="cv-job">
                <p className="cv-job-head">
                  <b>{b(job.role)}</b> · {job.org}
                  <span className="cv-when">{b(job.period)}</span>
                </p>
                <p className="cv-job-short">{b(job.short)}</p>
              </li>
            ))}
            <li className="cv-job education">
              <p className="cv-job-head">
                <b>{b(EDUCATION.role)}</b> · {EDUCATION.org}
                <span className="cv-when">{b(EDUCATION.period)}</span>
              </p>
              <p className="cv-job-short">{b(EDUCATION.short)}</p>
            </li>
          </ol>
        </section>

        <section
          className="cv-panel"
          id="teknik"
          aria-labelledby="teknik-title"
        >
          <h2 className="cv-panel-title" id="teknik-title">
            Tech stack
          </h2>
          <dl className="cv-stack">
            {STACK.map((group) => (
              <div key={group.group.sv} title={b(group.use)}>
                <dt>{b(group.group)}</dt>
                <dd>
                  <ul className="cv-chips">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
