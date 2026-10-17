import { useState } from 'react'
import type { Route } from '../../router'
import { Feature } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
import MultiLineChart from '../../charts/MultiLineChart'
import { RIKSDAG_PARTIES, partyName, partyLine } from '../../parties/identity'
import { useViewParams } from '../useViewParams'
import { useParties, shownParties } from '../partySelection'
import { Select, num, pct } from '../controls'
import type { DebateIndex, IssueDebate } from '../debatter/data'
import { DataState } from './Workspace'
import { useDataset, workspacePath, type Workspace } from './data'
import { ContextFilters, PARLIAMENT_DEFAULTS } from './Parliament'
import DecisionExplorer from './Decisions'
import { CONTEXT_DEFAULTS, inContext, workspaceHref } from './logic'
import ReportMaps from '../../clusters/ReportMaps'

type Studies = {
  latest: {
    key: string
    designation: string
    title: string
    url: string
    bills: { bill: string; title: string; url: string }[]
  }[]
  recent_laws: {
    bill: string
    title: string
    url: string
    decided: string
    studies: { designation: string; title: string | null; url: string }[]
  }[]
}
const defaults = {
  ...PARLIAMENT_DEFAULTS,
  amnesgrund: 'documented',
  ledardebatt: '',
  experiment: '0',
}

export function DebateActivity({
  route,
  data,
  compact = false,
}: {
  route: Route
  data: Workspace
  compact?: boolean
}) {
  const { selected } = useParties(route)
  const parties = shownParties(
    selected,
    compact ? ['S', 'M', 'SD'] : RIKSDAG_PARTIES,
  )
  const [view] = useViewParams(route, defaults)
  const rows = data.debate_activity.filter((r) =>
    inContext(r, { ...CONTEXT_DEFAULTS, fran: view.fran, till: view.till }),
  )
  return (
    <Feature
      id="speech-activity"
      title="How has speech activity changed?"
      lead="Issue-debate utterances, including replies, by parliamentary session. Final-session coverage may be incomplete."
      source="Riksdagen speech cards; per-party session summaries"
    >
      <MultiLineChart
        label="Issue-debate speech activity by party"
        format={num}
        colorOf={partyLine}
        series={parties.map((p) => ({
          key: p,
          party: p,
          name: partyName(p),
          points: rows
            .filter((r) => r.party === p)
            .map((r) => ({
              date: `${r.session.slice(0, 4)}-09-01`,
              label: r.session,
              value: r.speeches,
            })),
        }))}
      />
      <p className="po-note">
        Counts reflect recorded speech activity, not policy influence. This
        chart follows parties and the historical range; issue, session and
        government selectors do not filter this coverage series.
      </p>
      {compact && (
        <a href={workspaceHref('#politik-tal', route.params)}>
          Explore topics, replies and source speeches →
        </a>
      )}
    </Feature>
  )
}

function ReplyMatrix({ route, index }: { route: Route; index: DebateIndex }) {
  const [view, set] = useViewParams(route, defaults)
  const [hot, setHot] = useState<string | null>(null)
  const { selected } = useParties(route)
  const leaders = index.leaders.filter(
    (d) => d.date <= new Date().toISOString().slice(0, 10),
  )
  const debate =
    leaders.find((d) => d.id === view.ledardebatt) ?? leaders.at(-1)
  const parties = shownParties(selected)
  const top = Math.max(
    1,
    ...Object.values(debate?.replied_to ?? {}).flatMap((r) => Object.values(r)),
  )
  return (
    <Feature
      id="reply-matrix"
      title="Who replies to whom in a leader debate?"
      lead={`${debate?.date ?? '…'}; directed reply/answer counts. Rows address columns.`}
      controls={
        <Select
          label="Leader debate"
          value={debate?.id ?? ''}
          options={[...leaders]
            .reverse()
            .map((d) => ({ value: d.id, label: `${d.date} · ${d.session}` }))}
          onChange={(ledardebatt) => set({ ledardebatt })}
        />
      }
      source="Riksdagen speech order and reply flags; existing directed-reply export"
    >
      {debate ? (
        <>
          <div
            className="po-table-scroll"
            tabIndex={0}
            aria-label="Party reply interactions"
          >
            <table className="po-similarity">
              <caption className="visually-hidden">
                Replies from each row party to each column party
              </caption>
              <thead>
                <tr>
                  <td />
                  {parties.map((p) => (
                    <th key={p}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parties.map((p) => (
                  <tr key={p}>
                    <th scope="row">{p}</th>
                    {parties.map((q) => {
                      const value = debate.replied_to[p]?.[q] ?? 0
                      const label = `${partyName(p)} to ${partyName(q)}: ${num(value)} recorded replies`
                      return (
                        <td key={q}>
                          <button
                            type="button"
                            style={{
                              background: `color-mix(in srgb,var(--ink) ${4 + (26 * value) / top}%,var(--paper))`,
                            }}
                            aria-label={label}
                            onMouseEnter={() => setHot(label)}
                            onFocus={() => setHot(label)}
                            onClick={() => setHot(label)}
                          >
                            {value}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="po-note" aria-live="polite">
            {hot ??
              'Focus a cell to read its directed count. The scale belongs to this debate.'}
          </p>
          <a
            href={workspaceHref('#politik-debatt', route.params, {
              typ: 'partiledare',
              id: debate.id,
              riksmote: debate.session,
            })}
          >
            Read the complete debate and replies →
          </a>
        </>
      ) : (
        <p>No leader debate is available.</p>
      )}
    </Feature>
  )
}

function StudyChain({ route }: { route: Route }) {
  const { data, error } = useDataset<Studies>('parliament/studies.json')
  const [all, setAll] = useState(false)
  return (
    <Feature
      id="legislative-process"
      title="Which studies are cited by bills considered in Parliament?"
      lead="Explicit preparation-section citations. A bill/report link alone does not establish enactment of every provision."
      source="Riksdagen bill preparation text and committee report links"
    >
      {!data ? (
        <DataState error={error} />
      ) : (
        <>
          <ol className="po-study-chain">
            {data.recent_laws.slice(0, all ? 60 : 6).map((law) => (
              <li key={law.bill}>
                <div>
                  <time>{law.decided}</time>
                  <a href={law.url}>
                    {law.bill}: {law.title}
                  </a>
                </div>
                <ul>
                  {law.studies.map((study) => (
                    <li key={study.url + study.designation}>
                      <a href={study.url}>{study.designation}</a>
                      {study.title && <small>{study.title}</small>}
                    </li>
                  ))}
                </ul>
                <a
                  href={workspaceHref('#politik-riksdag', route.params, {
                    sok: law.title,
                  })}
                >
                  Find matching committee decisions →
                </a>
              </li>
            ))}
          </ol>
          <button
            className="btn-text"
            type="button"
            onClick={() => setAll(!all)}
          >
            {all ? 'Show fewer' : 'Show all delivered bill links'}
          </button>
        </>
      )}
      <a href={workspaceHref('#politik-utredningar', route.params)}>
        Search studies, publication history and sources →
      </a>
    </Feature>
  )
}

export default function Debates({ route }: { route: Route }) {
  const { data: workspace, error } = useDataset<Workspace>(workspacePath)
  const { data: index, error: indexError } = useDataset<DebateIndex>(
    'politics/parliament/debate-stats/index.json',
  )
  const [view, set] = useViewParams(route, defaults)
  const { selected } = useParties(route)
  const sessions =
    index?.sessions.filter((s) =>
      inContext(s, { ...view, riksmote: '', regering: '', omrade: '' }),
    ) ?? []
  const current =
    sessions.find((s) => s.session === view.riksmote) ?? sessions.at(-1)
  const { data: session, error: sessionError } = useDataset<{
    debates: IssueDebate[]
  }>(current?.path ?? null)
  const eligible = (session?.debates ?? []).filter(
    (d) => d.date <= new Date().toISOString().slice(0, 10),
  )
  const selectedCount = (d: IssueDebate) =>
    selected.length
      ? Object.entries(d.parties)
          .filter(([p]) => selected.includes(p))
          .reduce((s, [, counts]) => s + counts[0] + counts[1], 0)
      : d.speeches
  const total = eligible.reduce((s, d) => s + selectedCount(d), 0)
  const topicCounts = new Map<string, number>()
  for (const debate of eligible) {
    if (view.amnesgrund !== 'all' && debate.issues_via !== 'beslut') continue
    for (const issue of debate.issues)
      topicCounts.set(
        issue,
        (topicCounts.get(issue) ?? 0) +
          selectedCount(debate) / debate.issues.length,
      )
  }
  const topics = [...topicCounts].sort((a, b) => b[1] - a[1])
  const debates = eligible.filter(
    (d) =>
      (!view.omrade || d.issues.includes(view.omrade)) &&
      (view.amnesgrund === 'all' || d.issues_via === 'beslut'),
  )
  return (
    <>
      <h1>Debates & Legislation</h1>
      {!workspace ? (
        <DataState error={error} />
      ) : (
        <>
          <ContextFilters route={route} data={workspace} />
          <p className="po-note">
            Debate topics follow parties, session and policy area.
            Government-period filtering applies to the decision explorer; a
            matching debate title is a candidate relationship.
          </p>
          <div className="dk-grid po-grid">
            <div className="po-span-6">
              <Feature
                id="debate-topics"
                title="Which policy areas receive speaking time?"
                lead={`${current?.session ?? '…'}; weighted share of ${num(total)} selected utterances, including replies. Multiple topics split each utterance’s weight.`}
                controls={
                  <>
                    <Select
                      label="Topic assignment"
                      value={view.amnesgrund}
                      options={[
                        {
                          value: 'documented',
                          label: 'Committee/report title matches',
                        },
                        { value: 'all', label: 'Include lexical candidates' },
                      ]}
                      onChange={(amnesgrund) => set({ amnesgrund })}
                    />
                    <Select
                      label="Debate session"
                      value={current?.session ?? ''}
                      options={[...sessions]
                        .reverse()
                        .map((s) => ({ value: s.session, label: s.session }))}
                      onChange={(riksmote) => set({ riksmote })}
                    />
                  </>
                }
                source="Existing committee-title matches and separately identified lexical topic candidates"
              >
                {!current && index ? (
                  <p>No debate sessions match this historical range.</p>
                ) : !session ? (
                  <DataState error={sessionError ?? indexError} />
                ) : topics.length ? (
                  <RankBars
                    max={100}
                    label="Share of selected speech activity by issue"
                    format={pct}
                    rows={topics.map(([key, n]) => ({
                      key,
                      label:
                        index?.issues.find((i) => i.key === key)?.en ?? key,
                      value: total ? (100 * n) / total : 0,
                    }))}
                    onPick={(omrade) => set({ omrade })}
                    picked={view.omrade}
                  />
                ) : (
                  <p>
                    No assigned topic observations in this coverage. Try another
                    session or include lexical candidates.
                  </p>
                )}
                <p className="po-note">
                  Unassigned or excluded speeches remain in the denominator, so
                  topic shares can sum to less than 100%. Source matching
                  describes the topic; it does not link a statement causally to
                  a vote.
                </p>
              </Feature>
            </div>
            <div className="po-span-6">
              {index ? (
                <ReplyMatrix route={route} index={index} />
              ) : (
                <DataState error={indexError} />
              )}
            </div>
            <div className="po-span-12">
              <DebateActivity route={route} data={workspace} />
            </div>
            <div className="po-span-12">
              <Feature
                id="debate-evidence"
                title="Which debates relate to this policy area?"
                lead={`${debates.length} covered debates in ${current?.session ?? '…'}. Open a reader or a title-matched decision.`}
                source="Existing speech/debate index with committee-report candidate links"
              >
                <ul className="po-debate-list">
                  {debates.slice(0, 15).map((d) => (
                    <li key={d.id}>
                      <time>{d.date}</time>
                      <a
                        href={workspaceHref('#politik-debatt', route.params, {
                          typ: 'sak',
                          id: d.id,
                          riksmote: current?.session ?? '',
                        })}
                      >
                        {d.title}
                      </a>
                      <span>{num(selectedCount(d))} utterances</span>
                      {d.decision?.points[0] && (
                        <a
                          href={workspaceHref(
                            '#politik-riksdag',
                            route.params,
                            {
                              riksmote: current?.session ?? '',
                              rost: d.decision.points[0].id,
                            },
                          )}
                        >
                          Inspect matched decision →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <nav className="po-related" aria-label="Debate readers">
                  <a href={workspaceHref('#politik-sakdebatter', route.params)}>
                    All issue debates and topic comparisons
                  </a>
                  <a
                    href={workspaceHref(
                      '#politik-partiledardebatter',
                      route.params,
                    )}
                  >
                    Leader debates and lexical comparisons
                  </a>
                  <a href={workspaceHref('#politik-sok', route.params)}>
                    Search the speech corpus
                  </a>
                </nav>
              </Feature>
            </div>
            <div className="po-span-12">
              <DecisionExplorer route={route} data={workspace} />
            </div>
            <div className="po-span-12">
              <StudyChain route={route} />
            </div>
          </div>
          <details className="po-experiment">
            <summary>Experimental debate projections</summary>
            <p>
              Existing speech-chunk embeddings and topic models are retained as
              exploratory projections. Map distance is not a measured political
              distance. Inspect each map’s period, sample size and method.
            </p>
            {view.experiment === '1' ? (
              <ReportMaps ids={['debates', 'research-debates']} />
            ) : (
              <button
                className="btn-quiet"
                type="button"
                onClick={() => set({ experiment: '1' })}
              >
                Load existing debate maps
              </button>
            )}
          </details>
        </>
      )}
    </>
  )
}
