/**
 * Idea Lineage (#idea-lineage): how project ideas became decisions, experiments and software,
 * read from the public events only (idea-lineage/events.json, docs/idea-lineage.md).
 *
 * Three views, one at a time: a dated timeline, each project's current state, and the ideas set
 * aside. "Why?" on an event lights the events it came from, following stored links only; nothing
 * is joined by guesswork.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchData } from '../dataSource'
import { DataQuestion } from '../ui/Story'
import { PROJECTS } from '../projects/projectRegistry'
import {
  ancestors,
  chronological,
  effective,
  projectState,
  setAside,
  when,
  type EventType,
  type Lineage,
  type LineageEvent,
} from './logic'
import './lineage.css'

type View = 'timeline' | 'projects' | 'aside'

const TYPE_LABEL: Record<EventType, [string, string]> = {
  idea: ['Idea', 'Idé'],
  decision: ['Decision', 'Beslut'],
  hypothesis: ['Hypothesis', 'Hypotes'],
  experiment: ['Experiment', 'Experiment'],
  finding: ['Finding', 'Fynd'],
  question: ['Open question', 'Öppen fråga'],
  rejection: ['Set aside', 'Avfärdat'],
  implementation: ['Implementation', 'Implementation'],
  observation: ['Observation', 'Observation'],
}
const REL_LABEL: Record<string, [string, string]> = {
  inspired_by: ['inspired by', 'inspirerat av'],
  evolved_from: ['evolved from', 'utvecklat ur'],
  supersedes: ['supersedes', 'ersätter'],
  replaces: ['replaces', 'ersätter'],
  contradicts: ['contradicts', 'motsäger'],
  tests: ['tests', 'prövar'],
  supports: ['supports', 'stöder'],
  rejects: ['sets aside', 'avfärdar'],
  implements: ['implements', 'genomför'],
  answers: ['answers', 'besvarar'],
  results_from: ['results from', 'följer av'],
  applies_to: ['applies to', 'gäller'],
  related_to: ['related to', 'hör ihop med'],
}

const projectName = (id: string) => {
  const p = PROJECTS.find((x) => x.id === id)
  return p ? l(p.title.en, p.title.sv) : id === 'portfolio' ? 'Portfolio' : id
}
const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(l('en-GB', 'sv-SE'), {
    day: 'numeric',
    month: 'short',
  })

function Glyph({ type }: { type: EventType }) {
  return <span className={`il-glyph il-glyph-${type}`} aria-hidden="true" />
}

function EventItem({
  e,
  byId,
  status,
  traced,
  onWhy,
}: {
  e: LineageEvent
  byId: Map<string, LineageEvent>
  status: { status: string; by?: string } | undefined
  traced: boolean | null
  onWhy: (id: string) => void
}) {
  const rels = Object.entries(e.relations ?? {}).flatMap(([rel, ts]) =>
    ts.map((t) => [rel, t] as const),
  )
  return (
    <li
      id={e.id}
      className={`il-event il-${e.type}${traced ? ' il-traced' : ''}`}
    >
      <Glyph type={e.type} />
      <p className="il-kind">
        {l(...TYPE_LABEL[e.type])}
        {e.certainty && e.certainty !== 'confirmed' && (
          <span className="il-certainty"> · {e.certainty}</span>
        )}
        {status && !['active', 'open'].includes(status.status) && (
          <span className="il-status"> · {status.status}</span>
        )}
      </p>
      <h3 className="il-title">{e.title}</h3>
      {e.summary && <p className="il-summary">{e.summary}</p>}
      {e.reason && (
        <p className="il-reason">
          <span>{l('Why', 'Varför')}:</span> {e.reason}
        </p>
      )}
      {rels.length > 0 && (
        <ul className="il-rels">
          {rels.map(([rel, t]) => (
            <li key={rel + t}>
              {REL_LABEL[rel] ? l(...REL_LABEL[rel]) : rel}{' '}
              <button
                type="button"
                className="il-link"
                onClick={() => onWhy(t)}
              >
                {byId.get(t)?.title ?? t}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="il-meta">
        {(e.projects ?? []).map(projectName).join(' · ')}
        {e.implementation?.commit && (
          <>
            {' · '}
            <a
              href={`https://github.com/korv9/anton-portfolio/commit/${e.implementation.commit}`}
            >
              {e.implementation.commit}
            </a>
          </>
        )}
        {rels.length > 0 && (
          <>
            {' · '}
            <button
              type="button"
              className="il-why"
              aria-pressed={traced === true && rels.length > 0}
              onClick={() => onWhy(e.id)}
            >
              {l('Why does this exist?', 'Varför finns det här?')}
            </button>
          </>
        )}
      </p>
    </li>
  )
}

export default function IdeaLineagePage() {
  const [data, setData] = useState<Lineage | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<View>('timeline')
  const [project, setProject] = useState('')
  const [type, setType] = useState('')
  const [trace, setTrace] = useState<string | null>(null)

  useEffect(() => {
    fetchData('idea-lineage/events.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  const events = useMemo(() => chronological(data?.events ?? []), [data])
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const status = useMemo(() => effective(events), [events])
  const traced = useMemo(
    () => (trace ? ancestors(trace, events) : null),
    [trace, events],
  )
  const projects = useMemo(
    () => [...new Set(events.flatMap((e) => e.projects ?? []))],
    [events],
  )
  const shown = events.filter(
    (e) =>
      (!project || (e.projects ?? []).includes(project)) &&
      (!type || e.type === type) &&
      (!traced || traced.has(e.id)),
  )
  const days = [...new Set(shown.map(when))]

  return (
    <div className="idea-lineage ds-container">
      <DataQuestion
        level={1}
        eyebrow={l(
          'Idea Lineage · experimental',
          'Idea Lineage · experimentell',
        )}
        question={l(
          'How do ideas become decisions, experiments and software?',
          'Hur blir idéer till beslut, experiment och mjukvara?',
        )}
      >
        {l(
          'A small provenance system that records how project direction changes over time. Data Constellation shows how data moves through the platform; this shows why the platform changed.',
          'Ett litet härkomstsystem som registrerar hur projektens riktning ändras över tid. Data Constellation visar hur data rör sig genom plattformen; det här visar varför plattformen ändrades.',
        )}
      </DataQuestion>
      <p className="il-note">
        {l(
          'Only events marked public are shown. Each is a short structured note; a later event that changes direction is added, never written over the earlier one.',
          'Bara händelser som markerats som publika visas. Var och en är en kort strukturerad notering; en senare händelse som ändrar riktning läggs till och skriver aldrig över den tidigare.',
        )}
      </p>

      {failed && (
        <p className="il-empty">
          {l(
            'The public lineage could not be loaded.',
            'Den publika historiken kunde inte laddas.',
          )}
        </p>
      )}
      {data && (
        <>
          <div className="il-views" role="group" aria-label={l('View', 'Vy')}>
            {(
              [
                ['timeline', 'Timeline', 'Tidslinje'],
                ['projects', 'Projects now', 'Projekten nu'],
                ['aside', 'Set aside', 'Valdes bort'],
              ] as const
            ).map(([v, en, sv]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {l(en, sv)}
              </button>
            ))}
          </div>

          {view === 'timeline' && (
            <section aria-label={l('Timeline', 'Tidslinje')}>
              <div className="il-filters">
                <label>
                  {l('Project', 'Projekt')}{' '}
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    <option value="">{l('All', 'Alla')}</option>
                    {projects.map((p) => (
                      <option key={p} value={p}>
                        {projectName(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {l('Kind', 'Slag')}{' '}
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="">{l('All', 'Alla')}</option>
                    {[...new Set(events.map((e) => e.type))].map((t) => (
                      <option key={t} value={t}>
                        {l(...TYPE_LABEL[t])}
                      </option>
                    ))}
                  </select>
                </label>
                {trace && (
                  <p className="il-tracing">
                    {l(
                      'Showing where this came from:',
                      'Visar varifrån detta kom:',
                    )}{' '}
                    <strong>{byId.get(trace)?.title}</strong>{' '}
                    <button type="button" onClick={() => setTrace(null)}>
                      {l('Show everything', 'Visa allt')}
                    </button>
                  </p>
                )}
              </div>
              {days.length === 0 && (
                <p className="il-empty">
                  {l(
                    'No public event matches these filters.',
                    'Ingen publik händelse matchar filtren.',
                  )}
                </p>
              )}
              <ol className="il-timeline">
                {days.map((d) => (
                  <li key={d} className="il-day">
                    <p className="il-date">
                      <time dateTime={d}>{longDate(d)}</time>
                    </p>
                    <ol className="il-events">
                      {shown
                        .filter((e) => when(e) === d)
                        .map((e) => (
                          <EventItem
                            key={e.id}
                            e={e}
                            byId={byId}
                            status={status.get(e.id)}
                            traced={traced ? e.id === trace : null}
                            onWhy={(id) => {
                              setTrace(id)
                              setProject('')
                              setType('')
                            }}
                          />
                        ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {view === 'projects' && (
            <section className="il-projects">
              {projects.map((p) => {
                const s = projectState(p, events)
                return (
                  <article key={p} className="il-project">
                    <h2>{projectName(p)}</h2>
                    <p className="il-kind">
                      {l('Current direction', 'Nuvarande riktning')}
                    </p>
                    <p className="il-direction">
                      {s.direction
                        ? (s.direction.summary ?? s.direction.title)
                        : l(
                            'No decision recorded yet.',
                            'Inget beslut registrerat ännu.',
                          )}
                    </p>
                    {[
                      [l('Active decisions', 'Gällande beslut'), s.decisions],
                      [l('Latest findings', 'Senaste fynd'), s.findings],
                      [l('Open questions', 'Öppna frågor'), s.questions],
                    ].map(([label, items]) =>
                      (items as LineageEvent[]).length ? (
                        <div key={label as string}>
                          <p className="il-kind">{label as string}</p>
                          <ul className="il-list">
                            {(items as LineageEvent[]).map((e) => (
                              <li key={e.id}>{e.title}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                    <button
                      type="button"
                      className="il-why"
                      onClick={() => {
                        setProject(p)
                        setView('timeline')
                      }}
                    >
                      {l('History', 'Historik')} →
                    </button>
                  </article>
                )
              })}
            </section>
          )}

          {view === 'aside' && (
            <section className="il-aside">
              <h2>
                {l(
                  'Ideas I chose not to build',
                  'Idéer jag valde att inte bygga',
                )}
              </h2>
              <p className="il-note">
                {l(
                  'Setting an idea aside is a decision too. Each stays in the journal with the event that replaced it.',
                  'Att lägga en idé åt sidan är också ett beslut. Var och en ligger kvar i journalen med händelsen som ersatte den.',
                )}
              </p>
              {setAside(events).length === 0 ? (
                <p className="il-empty">
                  {l(
                    'Nothing has been set aside in the public record yet.',
                    'Inget har valts bort i den publika historiken ännu.',
                  )}
                </p>
              ) : (
                <ul className="il-list">
                  {setAside(events).map(({ event, status: s, by }) => (
                    <li key={event.id}>
                      <strong>{event.title}</strong> · {s}
                      {by && (
                        <>
                          {' '}
                          {l('by', 'av')} {by.title}
                          {by.reason && `: ${by.reason}`}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
