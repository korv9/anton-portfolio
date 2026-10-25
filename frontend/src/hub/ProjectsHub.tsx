/**
 * The projects hub (#projects), ivory on charcoal like the start page ("Projects II" on the
 * Intro sketches canvas): the job assistant as the lead beside the job-ads map, then every
 * project as a picture and a few lines in three parts (on the data platform, experiments, other
 * projects), then how the platform is built as a flow, its own sections and its machinery.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import JobsMap from '../home/JobsMap'
import { SWEDEN_PRODUCTS } from '../sweden/products'
import { l } from '../i18n'
import {
  freshness,
  loadStatus,
  SUBJECTS,
  type Entry,
} from '../meaning/freshness'
import PlatformSections from '../tech/PlatformSections'
import type { Graph } from '../tech/PipelineTables'
import { ago, day, num, ok, reading, useFile } from '../tech/techData'
import Headline from './Headline'
import JobsPulse from './JobsPulse'
import { ConceptChart, PhilosophyChart, SymbolChart } from './mini/cardsLabs'
import { FeedChart, LawChart, SwedenChart } from './mini/cardsPlatform'
import { Near } from './mini/MiniChart'
import PlatformFlow from './PlatformFlow'
import { HUB_GROUPS, PARTS, type HubGroup, type HubItem } from './hubProjects'
import '../tech/tech.css'
import './hub.css'
import './hub-cards.css'
import './hub-flow.css'
import './mini.css'

const Machinery = lazy(() => import('../tech/Machinery'))

/**
 * Each platform project's mini dashboard: one finding from its own published files, mounted as
 * its card nears the screen (Near). The job assistant's hero shows the job market it reads.
 */
const CHARTS: Record<string, ReactNode> = {
  jobs: <JobsPulse />,
  sweden: <SwedenChart />,
  meaning: <FeedChart />,
  'ask-the-law': <LawChart />,
  'philosophy-atlas': <PhilosophyChart />,
  'symbolic-atlas': <SymbolChart />,
  'concept-constellation': <ConceptChart />,
}

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
    count(
      counts?.sources,
      l('publisher', 'utgivare'),
      l('publishers', 'utgivare'),
    ),
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

/** Status and address under a card, in mono: LIVE · #jobs →, or REPO · GitHub ↗. */
function Where({ item }: { item: HubItem }) {
  const away = item.href.startsWith('http')
  return (
    <span className="hub-item-where">
      <span className="hub-item-status">
        {l(item.status.en, item.status.sv)}
      </span>{' '}
      · {away ? 'GitHub' : item.href}{' '}
      <span aria-hidden="true">{away ? '↗' : '→'}</span>
    </span>
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
  const [lead, ...rest] = HUB_GROUPS
  const card = (group: HubGroup, item: HubItem, i: number) => (
    <li
      key={item.id}
      // The first card of a group keeps the group's old address (#projects-sweden); the platform
      // card links to its own sections, which hold #projects-platform.
      id={
        i === 0 && group.id !== 'platform' ? `projects-${group.id}` : undefined
      }
      data-lead={group === lead || undefined}
    >
      {CHARTS[item.id] && group !== lead && (
        <Near className="hub-item-chart">{CHARTS[item.id]}</Near>
      )}
      <a className="hub-item" href={item.href}>
        <span className="hub-item-title">
          {l(item.title.en, item.title.sv)}
        </span>
        <span className="hub-item-text">{l(item.text.en, item.text.sv)}</span>
        <RunsOn item={item} domains={domains} status={status} />
        <Where item={item} />
      </a>
      {item.id === 'sweden' && (
        <ul
          className="hub-products"
          aria-label={l('The six products', 'De sex produkterna')}
        >
          {SWEDEN_PRODUCTS.map((p) => (
            <li key={p.id}>
              <a href={p.href}>
                <span className="hub-products-id">{p.id}</span>{' '}
                {l(p.title.en, p.title.sv)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {item.id === 'platform' && <Headline />}
      {group === lead && (
        <>
          <Near className="hub-item-chart">{CHARTS[item.id]}</Near>
          <JobsMap />
        </>
      )}
    </li>
  )
  return (
    <div className="hub">
      <article className="tech hub-main" id="projects">
        <header className="hub-head">
          <h1>{l('Projects', 'Projekt')}</h1>
        </header>
        <ul className="hub-items hub-lead">
          {lead.items.map((item, i) => card(lead, item, i))}
        </ul>
        {PARTS.map((part) => (
          <section
            key={part.id}
            id={
              part.id === 'platform' ? 'projects-work' : `projects-${part.id}`
            }
            className="hub-group"
            aria-labelledby={`hub-part-${part.id}`}
          >
            <h2 id={`hub-part-${part.id}`}>
              {l(part.title.en, part.title.sv)}
            </h2>
            {part.id === 'platform' && ok(graph) && (
              <p className="tech-meta">
                {l(
                  `Counts on each card: architecture/graph.json, the lineage graph · built ${day(graph.generated_at)} UTC (${ago(graph.generated_at)})`,
                  `Siffrorna på varje kort: architecture/graph.json, härkomstgrafen · byggd ${day(graph.generated_at)} UTC (${ago(graph.generated_at)})`,
                )}
              </p>
            )}
            <ul className="hub-items">
              {rest
                .filter((group) => group.part === part.id)
                .flatMap((group) =>
                  group.items.map((item, i) => card(group, item, i)),
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
