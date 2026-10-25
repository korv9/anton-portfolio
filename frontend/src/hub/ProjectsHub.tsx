/**
 * The projects hub (#projects), one page for everything built on the platform: a headline row,
 * then each project with what it runs on, job search first, then how the platform is built as a
 * flow, the platform's own sections (PR #141's page) and its machinery to drill into. A sidebar
 * lists the same parts; on a phone it folds into a menu above the content.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { l } from '../i18n'
import {
  freshness,
  loadStatus,
  SUBJECTS,
  type Entry,
} from '../meaning/freshness'
import PlatformSections from '../tech/PlatformSections'
import type { Graph } from '../tech/PipelineTables'
import { REPO, ago, day, num, ok, reading, useFile } from '../tech/techData'
import Headline from './Headline'
import PlatformFlow from './PlatformFlow'
import { HUB_GROUPS, type HubItem } from './hubProjects'
import '../tech/tech.css'
import './hub.css'

const Machinery = lazy(() => import('../tech/Machinery'))

const STACK =
  'Python · dbt · DuckDB · GitHub Actions · Cloudflare R2 · Cloudflare Workers · Workers AI · TypeScript · React'

type Domain = { id: string; counts: Record<string, number> }

/** What a project runs on: its sources, models and ML stages, and whether its data is fresh. */
function RunsOn(props: {
  item: HubItem
  domains: Domain[]
  status: Record<string, Entry> | null
}) {
  const counts = props.domains.find((d) => d.id === props.item.domain)?.counts
  const key = props.item.fresh
  const fresh = key ? freshness(props.status, key) : undefined
  const sla = key ? SUBJECTS[key]?.[1] : undefined
  const count = (n: number | undefined, one: string, many: string) =>
    n ? `${num(n)} ${n === 1 ? one : many}` : null
  const limit = sla && (sla >= 48 ? `${sla / 24} d` : `${sla} h`)
  const what = props.item.data
    ? l(props.item.data.en, props.item.data.sv)
    : l('data', 'datan')
  const run = props.item.run ? props.status?.[props.item.run] : undefined
  const parts = [
    count(counts?.sources, l('source', 'källa'), l('sources', 'källor')),
    count(
      counts?.models,
      l('dbt model', 'dbt-modell'),
      l('dbt models', 'dbt-modeller'),
    ),
    count(counts?.ml, l('ML stage', 'ML-steg'), l('ML stages', 'ML-steg')),
    fresh !== undefined &&
      (fresh
        ? l(
            `${what} updated within its ${limit} limit`,
            `${what} uppdaterad inom sin gräns på ${limit}`,
          )
        : l(
            `${what} older than its ${limit} limit`,
            `${what} äldre än sin gräns på ${limit}`,
          )),
    run?.outcome &&
      run.outcome !== 'success' &&
      run.recorded_at &&
      l(
        `last run failed ${ago(run.recorded_at)}`,
        `senaste körningen föll ${ago(run.recorded_at)}`,
      ),
  ].filter(Boolean)
  return parts.length ? (
    <span className="hub-item-runs">{parts.join(' · ')}</span>
  ) : null
}

/** Every part of the hub; beside the content on a wide screen, a menu above it on a phone. */
function Sidebar() {
  const wide = '(min-width: 961px)'
  const [open, setOpen] = useState(() => matchMedia(wide).matches)
  useEffect(() => {
    const query = matchMedia(wide)
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
        <a href="#projects-overview">{l('Overview', 'Översikt')}</a>
        {HUB_GROUPS.map((group) => (
          <a key={group.id} href={`#projects-${group.id}`}>
            {l(group.title.en, group.title.sv)}
          </a>
        ))}
        <a href="#projects-flow">{l('Platform', 'Plattformen')}</a>
        <ul>
          <li>
            <a href="#projects-platform">
              {l('Ask the platform', 'Fråga plattformen')}
            </a>
          </li>
          <li>
            <a href="#platform-pipeline">{l('Pipeline', 'Pipeline')}</a>
          </li>
          <li>
            <a href="#platform-health">{l('Run health', 'Körhälsa')}</a>
          </li>
          <li>
            <a href="#tech-stages">{l('Lineage', 'Härkomst')}</a>
          </li>
          <li>
            <a href="#tech-quality">
              {l('Tests and quality', 'Tester och kvalitet')}
            </a>
          </li>
          <li>
            <a href="#tech-er">{l('Data model', 'Datamodell')}</a>
          </li>
          <li>
            <a href={`https://github.com/${REPO}/tree/main/docs/incidents`}>
              {l('Incidents', 'Incidenter')} <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </nav>
    </details>
  )
}

export default function ProjectsHub({ path }: { path: string }) {
  const graph = useFile<Graph & { domains: Domain[] }>(
    'architecture/graph.json',
  )
  const [status, setStatus] = useState<Record<string, Entry> | null>(null)
  useEffect(() => {
    loadStatus().then(setStatus)
  }, [])
  // An address inside the hub (#projects-jobs, #tech-er) scrolls to its section. The parts above
  // it fill in as their data arrives, so the section is kept in place while the page settles,
  // until the reader scrolls or after four seconds.
  useEffect(() => {
    if (path === '#projects') return
    const keep = () =>
      document.getElementById(path.slice(1))?.scrollIntoView({ block: 'start' })
    const observer = new ResizeObserver(keep)
    observer.observe(document.body)
    const stop = () => observer.disconnect()
    const timer = setTimeout(stop, 4000)
    const events = ['wheel', 'touchstart', 'keydown'] as const
    for (const e of events) addEventListener(e, stop, { once: true })
    return () => {
      stop()
      clearTimeout(timer)
      for (const e of events) removeEventListener(e, stop)
    }
  }, [path])
  const domains = ok(graph) ? graph.domains : []
  // The projects that run on the platform, job search first; then the others.
  const platform = {
    id: 'projects-work',
    title: l('Running on the platform', 'Körs på plattformen'),
    groups: HUB_GROUPS.filter((g) => g.id !== 'other'),
  }
  const other = {
    id: 'projects-other',
    title: l('Other projects', 'Övriga projekt'),
    groups: HUB_GROUPS.filter((g) => g.id === 'other'),
  }
  return (
    <div className="hub">
      <Sidebar />
      <article className="tech hub-main" id="projects">
        <header className="tech-head hub-head">
          <h1>{l('Projects', 'Projekt')}</h1>
          <div className="hub-intro">
            <p>
              {l(
                'The projects under Running on the platform run on one data platform I built: public sources fetched on a schedule, modelled and tested with dbt, passed through machine learning where the data is text, and published to these pages only when every blocking check has passed.',
                'Projekten under Körs på plattformen körs på en dataplattform jag har byggt: offentliga källor som hämtas på schema, modelleras och testas med dbt, går genom maskininlärning där datan är text och publiceras till sidorna först när alla blockerande kontroller har gått igenom.',
              )}
            </p>
            <p className="hub-stack">{STACK}</p>
            <a className="hub-jump" href="#projects-flow">
              {l('How the platform is built', 'Så är plattformen byggd')}{' '}
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </header>
        <Headline />
        {[platform, other].map((part) => (
          <section
            key={part.id}
            id={part.id}
            className="hub-group"
            aria-labelledby={`${part.id}-title`}
          >
            <h2 id={`${part.id}-title`}>{part.title}</h2>
            {part === platform && ok(graph) && (
              <p className="tech-meta">
                {l(
                  `Counts on each card: architecture/graph.json, the lineage graph · built ${day(graph.generated_at)} UTC (${ago(graph.generated_at)})`,
                  `Siffrorna på varje kort: architecture/graph.json, härkomstgrafen · byggd ${day(graph.generated_at)} UTC (${ago(graph.generated_at)})`,
                )}
              </p>
            )}
            <ul className="hub-items">
              {part.groups.flatMap((group) =>
                group.items.map((item, i) => (
                  <li
                    key={item.id}
                    id={
                      part === platform && i === 0
                        ? `projects-${group.id}`
                        : undefined
                    }
                    data-lead={group.id === 'jobs' || undefined}
                  >
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
                      <RunsOn item={item} domains={domains} status={status} />
                    </a>
                  </li>
                )),
              )}
            </ul>
          </section>
        ))}
        <PlatformFlow />
        <PlatformSections />
        <Suspense fallback={reading}>
          <Machinery />
        </Suspense>
      </article>
    </div>
  )
}
