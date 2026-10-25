/**
 * The projects hub (#projects), ivory on charcoal like the start page ("Site v2" on the Intro
 * sketches canvas): one project per row, its words on the left and its picture on the right, in
 * three parts (on the data platform, experiments, other projects), with Arbetsförmedla first
 * beside the job-ads map; then how the platform is built as a flow, its sections and machinery.
 */
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import JobsMap from '../home/JobsMap'
import { SWEDEN_PRODUCTS } from '../sweden/products'
import { l } from '../i18n'
import PlatformSections from '../tech/PlatformSections'
import { reading } from '../tech/techData'
import Headline from './Headline'
import JobsPulse from './JobsPulse'
import { ConceptChart, PhilosophyChart, SymbolChart } from './mini/cardsLabs'
import {
  ClusterChart,
  DrugChart,
  HomieChart,
  ThesisChart,
  ReplikChart,
} from './mini/cardsOther'
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
  'cluster-visuals': <ClusterChart />,
  thesis: <ThesisChart />,
  drugcomb: <DrugChart />,
  homie: <HomieChart />,
  replik: <ReplikChart />,
}

/** A repository on GitHub: text only, set as a compact pair after the other projects. */
const isRepo = (item: HubItem) => item.href.startsWith('http')

/** The quiet way into a project under its text: Open →, or GitHub ↗ for a repository. */
function Open({ item }: { item: HubItem }) {
  const away = isRepo(item)
  return (
    <span className="hub-item-open">
      {away ? 'GitHub' : l('Open', 'Öppna')}{' '}
      <span aria-hidden="true">{away ? '↗' : '→'}</span>
    </span>
  )
}

export default function ProjectsHub({ path }: { path: string }) {
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
  const [lead, ...rest] = HUB_GROUPS
  // One project per row: its words on the left, its picture on the right.
  const card = (group: HubGroup, item: HubItem, i: number) => {
    const visual =
      group === lead ? (
        <JobsMap />
      ) : item.id === 'platform' ? (
        <Headline />
      ) : (
        CHARTS[item.id] && (
          <Near className="hub-item-chart">{CHARTS[item.id]}</Near>
        )
      )
    return (
      <li
        key={item.id}
        // The first card of a group keeps the group's old address (#projects-sweden); the
        // platform card links to its own sections, which hold #projects-platform.
        id={
          i === 0 && group.id !== 'platform'
            ? `projects-${group.id}`
            : undefined
        }
        data-lead={group === lead || undefined}
      >
        <div className="hub-row-text">
          <a className="hub-item" href={item.href}>
            <span className="hub-item-title">
              {l(item.title.en, item.title.sv)}
            </span>
            <span className="hub-item-text">
              {l(item.text.en, item.text.sv)}
            </span>
            <Open item={item} />
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
          {group === lead && (
            <Near className="hub-item-chart">{CHARTS[item.id]}</Near>
          )}
        </div>
        {visual && <div className="hub-row-visual">{visual}</div>}
      </li>
    )
  }
  return (
    <div className="hub">
      <article className="tech hub-main" id="projects">
        <header className="hub-head">
          <h1>{l('Projects', 'Projekt')}</h1>
        </header>
        <ul className="hub-items hub-lead">
          {lead.items.map((item, i) => card(lead, item, i))}
        </ul>
        {PARTS.map((part) => {
          const cards = rest
            .filter((group) => group.part === part.id)
            .flatMap((group) =>
              group.items.map((item, i) => ({
                item,
                li: card(group, item, i),
              })),
            )
          const repos = cards.filter((c) => isRepo(c.item))
          return (
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
              <ul className="hub-items">
                {cards.filter((c) => !isRepo(c.item)).map((c) => c.li)}
              </ul>
              {repos.length > 0 && (
                <ul className="hub-items hub-repos">
                  {repos.map((c) => c.li)}
                </ul>
              )}
            </section>
          )
        })}
        <PlatformFlow />
        <PlatformSections />
        <Suspense fallback={reading}>
          <Machinery />
        </Suspense>
      </article>
    </div>
  )
}
