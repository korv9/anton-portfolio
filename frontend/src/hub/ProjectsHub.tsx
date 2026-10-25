/**
 * The projects hub (#projekt): a live dashboard of the platform, a short word on each project,
 * then the platform's machinery to drill into. A sidebar lists every group; on a phone it folds
 * into a menu above the content.
 *
 * Every figure is read at load (schema/summary.json, status/ingestion.json, the CI runs on
 * GitHub); a figure that cannot be read is left out.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { l } from '../i18n'
import {
  freshness,
  loadStatus,
  SUBJECTS,
  type Entry,
} from '../meaning/freshness'
import { ago, num, ok, reading, useFile } from '../tech/techData'
import { loadWorkflows, type Run } from '../tech/WorkflowRuns'
import { HUB_GROUPS } from './hubProjects'
import '../tech/tech.css'
import './hub.css'

const Machinery = lazy(() => import('../tech/Machinery'))

/** The latest finished CI run on main, or nothing when GitHub cannot be read. */
function useCi() {
  const [run, setRun] = useState<Run>()
  useEffect(() => {
    loadWorkflows().then(
      (workflows) =>
        setRun(
          workflows
            .find((w) => w.path.endsWith('/ci.yml'))
            ?.runs.find(
              (r) => r.head_branch === 'main' && r.status === 'completed',
            ),
        ),
      () => undefined,
    )
  }, [])
  return run
}

function useStatus() {
  const [status, setStatus] = useState<Record<string, Entry> | null>(null)
  useEffect(() => {
    loadStatus().then(setStatus)
  }, [])
  return status
}

function Figure(props: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
      {props.note && <dd className="tech-meta">{props.note}</dd>}
    </div>
  )
}

function Dashboard() {
  const summary = useFile<Record<string, number>>('schema/summary.json')
  const status = useStatus()
  const ci = useCi()
  const entries = Object.values(status ?? {})
  const last = entries
    .filter((e) => e.recorded_at)
    .sort((a, b) => b.recorded_at!.localeCompare(a.recorded_at!))[0]
  const known = Object.keys(SUBJECTS)
    .map((domain) => freshness(status, domain))
    .filter((f) => f !== undefined)
  const counts: [string, number | undefined][] = ok(summary)
    ? [
        [l('dbt models', 'dbt-modeller'), summary.models],
        [l('dbt tests', 'dbt-tester'), summary.tests],
        [l('dbt source tables', 'dbt-källtabeller'), summary.sources],
        [l('Rows in the warehouse', 'Rader i lagret'), summary.rows],
      ]
    : []
  return (
    <section id="projekt-overview" aria-labelledby="projekt-overview-title">
      <h2 id="projekt-overview-title">
        {l('The platform now', 'Plattformen nu')}
      </h2>
      {summary === null && reading}
      <dl className="tech-figures hub-figures">
        {counts.map(
          ([label, n]) =>
            typeof n === 'number' && (
              <Figure key={label} label={label} value={num(n)} />
            ),
        )}
        {last?.recorded_at && (
          <Figure
            label={l('Last pipeline run', 'Senaste pipelinekörning')}
            value={ago(last.recorded_at)}
            note={
              last.outcome === 'success'
                ? l('passed', 'gick igenom')
                : l('failed', 'föll')
            }
          />
        )}
        {known.length > 0 && (
          <Figure
            label={l('Fresh subjects', 'Färska ämnen')}
            value={`${known.filter(Boolean).length}/${known.length}`}
            note={l('within their SLA', 'inom sin SLA')}
          />
        )}
        {ci && (
          <Figure
            label={l('CI on main', 'CI på main')}
            value={
              ci.conclusion === 'success'
                ? l('Passing', 'Grön')
                : l('Failing', 'Röd')
            }
            note={ago(ci.updated_at)}
          />
        )}
      </dl>
    </section>
  )
}

const WIDE = '(min-width: 961px)'

/** Every group of the hub; open beside the content on a wide screen, a menu on a phone. */
function Sidebar() {
  const [open, setOpen] = useState(() => matchMedia(WIDE).matches)
  useEffect(() => {
    const query = matchMedia(WIDE)
    const update = () => setOpen(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return (
    <details
      className="hub-nav"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{l('All projects', 'Alla projekt')}</summary>
      <nav aria-label={l('Projects', 'Projekt')}>
        <a href="#projekt-overview">{l('Overview', 'Översikt')}</a>
        {HUB_GROUPS.map((group) => (
          <a key={group.id} href={`#projekt-${group.id}`}>
            {l(group.title.en, group.title.sv)}
          </a>
        ))}
        <a href="#tech-pipeline">
          {l('Inside the platform', 'Inuti plattformen')}
        </a>
      </nav>
    </details>
  )
}

export default function ProjectsHub({ path }: { path: string }) {
  // An address inside the hub (#projekt-jobs, #tech-er) scrolls to its section; the machinery
  // loads lazily, so its sections are looked for over a few frames.
  useEffect(() => {
    if (path === '#projekt') return
    let tries = 0
    let frame = 0
    const find = () => {
      const target = document.getElementById(path.slice(1))
      if (target) target.scrollIntoView({ block: 'start' })
      else if (tries++ < 120) frame = requestAnimationFrame(find)
    }
    frame = requestAnimationFrame(find)
    return () => cancelAnimationFrame(frame)
  }, [path])
  return (
    <div className="hub">
      <Sidebar />
      <article className="tech projects-page" id="projekt">
        <header className="tech-head">
          <h1>{l('Projects', 'Projekt')}</h1>
          <p>
            {l(
              'Most of these projects run on one data platform I built: public sources fetched on a schedule, built and tested with dbt, passed through machine learning where the data is text, and published to the pages.',
              'De flesta av projekten körs på en dataplattform jag har byggt: offentliga källor som hämtas på schema, byggs och testas med dbt, går genom maskininlärning där datan är text och publiceras till sidorna.',
            )}
          </p>
        </header>
        <Dashboard />
        {HUB_GROUPS.map((group, i) => (
          <section
            key={group.id}
            id={`projekt-${group.id}`}
            className="hub-group"
            data-lead={i === 0 || undefined}
            aria-labelledby={`projekt-${group.id}-title`}
          >
            <h2 id={`projekt-${group.id}-title`}>
              {l(group.title.en, group.title.sv)}
            </h2>
            <ul className="hub-items">
              {group.items.map((item) => (
                <li key={item.id}>
                  <a className="hub-item" href={item.href}>
                    <span className="hub-item-title">
                      {l(item.title.en, item.title.sv)}
                      {item.href.startsWith('http') && (
                        <span aria-hidden="true"> ↗</span>
                      )}
                    </span>
                    <span className="hub-item-text">
                      {l(item.text.en, item.text.sv)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Suspense fallback={reading}>
          <Machinery />
        </Suspense>
      </article>
    </div>
  )
}
