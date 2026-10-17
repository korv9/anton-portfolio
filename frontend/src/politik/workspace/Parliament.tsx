import { useMemo, useState } from 'react'
import type { Route } from '../../router'
import { Feature } from '../../charts/feature/Feature'
import MultiLineChart from '../../charts/MultiLineChart'
import RankBars from '../../charts/RankBars'
import {
  RIKSDAG_PARTIES,
  PartyTag,
  partyName,
  partyLine,
} from '../../parties/identity'
import { useViewParams } from '../useViewParams'
import { useParties, shownParties } from '../partySelection'
import { Select, num, pct, dayName } from '../controls'
import { DataState } from './Workspace'
import {
  useDataset,
  workspacePath,
  type Ballot,
  type BallotParty,
  type Pair,
  type Workspace,
} from './data'
import {
  aggregateCohesion,
  aggregatePairs,
  CONTEXT_DEFAULTS,
  inContext,
  workspaceHref,
  type Context,
} from './logic'
import DecisionExplorer from './Decisions'

export const PARLIAMENT_DEFAULTS = {
  ...CONTEXT_DEFAULTS,
  par: 'S,M',
  statsrost: '',
  kandidat: '',
  statsfran: '2014',
  statstill: '',
  enighet: 'unity',
}
export const POSITION_LABEL: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  abstain: 'Abstain',
  absent: 'Absent',
  mixed: 'Mixed',
  not_represented: 'Not represented',
  missing: 'Unavailable',
}
const symbols: Record<string, string> = {
  yes: '✓',
  no: '×',
  abstain: '○',
  absent: '·',
  mixed: '◐',
  not_represented: '—',
  missing: '?',
}
const countsText = (p: {
  yes: number
  no: number
  abstain: number
  absent: number
}) => `${p.yes} yes, ${p.no} no, ${p.abstain} abstain, ${p.absent} absent`

export function ContextFilters({
  route,
  data,
}: {
  route: Route
  data: Workspace
}) {
  const [view, set, reset] = useViewParams(route, PARLIAMENT_DEFAULTS)
  const sessions = [...data.sessions].reverse()
  return (
    <div className="po-filterbar" aria-label="Parliamentary context">
      <Select
        label="Session"
        value={view.riksmote}
        options={[
          { value: '', label: 'All sessions' },
          ...sessions.map((s) => ({ value: s.session, label: s.session })),
        ]}
        onChange={(riksmote) => set({ riksmote })}
      />
      <Select
        label="From session year"
        value={view.fran}
        options={[
          ...new Set([
            view.fran,
            ...data.sessions.map((s) => String(s.start_year)),
          ]),
        ]
          .sort()
          .map((value) => ({ value, label: value }))}
        onChange={(fran) => set({ fran, riksmote: '' })}
      />
      <Select
        label="Through session year"
        value={view.till}
        options={[
          { value: '', label: 'Latest available' },
          ...sessions.map((s) => ({
            value: String(s.start_year),
            label: String(s.start_year),
          })),
        ]}
        onChange={(till) => set({ till, riksmote: '' })}
      />
      <Select
        label="Policy area"
        value={view.omrade}
        options={[
          { value: '', label: 'All policy areas' },
          ...data.issues.map((i) => ({
            value: i.issue_key,
            label: i.issue_name_en,
          })),
        ]}
        onChange={(omrade) => set({ omrade })}
      />
      <Select
        label="Government period"
        value={view.regering}
        options={[
          { value: '', label: 'All government periods' },
          ...[...data.governments].reverse().map((g) => ({
            value: g.government_key,
            label: g.government_name,
          })),
        ]}
        onChange={(regering) => set({ regering, riksmote: '' })}
      />
      <button type="button" className="btn-text" onClick={reset}>
        Reset context
      </button>
    </div>
  )
}

function pairRows(data: Workspace, view: Context): Pair[] {
  if (view.omrade || view.regering)
    return data.pairs.filter((r) => inContext(r, view))
  return data.party_pairs
    .filter((r) => inContext(r, view))
    .map((r) => ({
      ...r,
      government_key: null,
      issue_key: null,
      compared: r.comparable_roll_calls,
      same: r.same_position,
    }))
}

export function Similarity({
  route,
  data,
  compact = false,
}: {
  route: Route
  data: Workspace
  compact?: boolean
}) {
  const [view, set] = useViewParams(route, PARLIAMENT_DEFAULTS)
  const { selected } = useParties(route)
  const context = compact
    ? { ...CONTEXT_DEFAULTS, riksmote: data.sessions.at(-1)?.session ?? '' }
    : view
  const rows = useMemo(
    () => pairRows(data, context),
    [data, JSON.stringify(context)],
  )
  const pairs = useMemo(() => aggregatePairs(rows), [rows])
  const present = shownParties(selected, RIKSDAG_PARTIES).filter((p) =>
    pairs.some((r) => r.party_a === p || r.party_b === p),
  )
  const parties =
    present.length >= 2
      ? present
      : RIKSDAG_PARTIES.filter((p) =>
          pairs.some((r) => r.party_a === p || r.party_b === p),
        )
  const rowParties =
    selected.length === 1
      ? parties.filter((p) => selected.includes(p))
      : parties
  const [a, b] = view.par.split(',')
  const [hot, setHot] = useState<string | null>(null)
  const find = (a: string, b: string) =>
    pairs.find(
      (r) =>
        (r.party_a === a && r.party_b === b) ||
        (r.party_a === b && r.party_b === a),
    )
  const contextLabel = compact
    ? data.sessions.at(-1)?.session
    : view.riksmote || `${view.fran}–${view.till || 'latest'}`
  return (
    <Feature
      id="rostlikhet"
      title="How often do parties vote alike?"
      lead={`Comparable substantive roll calls, ${contextLabel}. Fixed 0–100% scale.`}
      source={
        <a href="https://data.riksdagen.se/voteringlista/">
          Riksdagen · pairwise comparable roll calls
        </a>
      }
      table={
        !compact && (
          <table>
            <thead>
              <tr>
                <th>Party A</th>
                <th>Party B</th>
                <th>Same</th>
                <th>Comparable</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((r) => (
                <tr key={`${r.party_a}-${r.party_b}`}>
                  <td>{r.party_a}</td>
                  <td>{r.party_b}</td>
                  <td>{num(r.same)}</td>
                  <td>{num(r.compared)}</td>
                  <td>{r.pct == null ? 'Unavailable' : pct(r.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {!pairs.length ? (
        <p>
          No comparable party counts for this context. Issue and government
          filters require {data.context_sessions.join(' or ')}. Clear those
          filters for the full historical session series.
        </p>
      ) : (
        <>
          <div
            className="po-table-scroll"
            tabIndex={0}
            aria-label="Party similarity matrix"
          >
            <table className="po-similarity">
              <caption className="visually-hidden">
                Select a party pair to compare it through time. Each cell
                includes the denominator.
              </caption>
              <thead>
                <tr>
                  <td />
                  {parties.map((p) => (
                    <th scope="col" key={p}>
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowParties.map((p) => (
                  <tr key={p}>
                    <th scope="row">{p}</th>
                    {parties.map((q) => {
                      const r = find(p, q)
                      const value = r?.pct
                      const label =
                        r && value != null
                          ? `${partyName(p)} and ${partyName(q)}: ${pct(value)}, ${num(r.same)} of ${num(r.compared)} comparable votes`
                          : 'No comparison'
                      return (
                        <td key={q}>
                          {p === q ? (
                            <span aria-label="Same party, excluded">—</span>
                          ) : (
                            <button
                              type="button"
                              className={
                                [a, b].includes(p) && [a, b].includes(q)
                                  ? 'is-selected'
                                  : ''
                              }
                              style={{
                                background:
                                  value != null
                                    ? `color-mix(in srgb,var(--ink) ${4 + value * 0.26}%,var(--paper))`
                                    : undefined,
                              }}
                              aria-label={label}
                              disabled={!r}
                              onFocus={() => setHot(label)}
                              onMouseEnter={() => setHot(label)}
                              onClick={() =>
                                compact
                                  ? location.assign(
                                      workspaceHref(
                                        '#politik-riksdag',
                                        route.params,
                                        {
                                          par: `${p},${q}`,
                                          riksmote: context.riksmote,
                                        },
                                      ),
                                    )
                                  : set({ par: `${p},${q}` })
                              }
                            >
                              {value == null ? '?' : pct(value, 0)}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="po-scale">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <p className="po-note po-readout" aria-live="polite">
            {hot ??
              'Focus or point at a cell for its comparison count. Select a pair for its history.'}
          </p>
        </>
      )}
      {!compact && (
        <details>
          <summary>Definition and denominator</summary>
          <p>
            A party position is the unique plurality of its present members:
            yes, no or abstain. Abstention matches only abstention. Tied
            positions, all-absent parties and missing records are excluded
            pairwise. Each substantive roll call contributes once; results are
            weighted by comparable counts, not averaged percentages. Similarity
            does not establish ideological proximity, cooperation or an
            agreement.
          </p>
        </details>
      )}
      {compact && (
        <a href={workspaceHref('#politik-riksdag', route.params)}>
          Explore periods, issues and party pairs →
        </a>
      )}
    </Feature>
  )
}

function PairHistory({ route, data }: { route: Route; data: Workspace }) {
  const [view, set] = useViewParams(route, PARLIAMENT_DEFAULTS)
  const [rawA, rawB] = view.par.split(',')
  const a = RIKSDAG_PARTIES.includes(rawA) ? rawA : 'S',
    b =
      RIKSDAG_PARTIES.includes(rawB) && rawB !== a
        ? rawB
        : RIKSDAG_PARTIES.find((p) => p !== a)!
  const rows = pairRows(data, { ...view, riksmote: '' }).filter(
    (r) =>
      (r.party_a === a && r.party_b === b) ||
      (r.party_a === b && r.party_b === a),
  )
  const sessions = [...new Set(rows.map((r) => r.session))].sort()
  const points = sessions.flatMap((session, index) => {
    const pair = aggregatePairs(rows.filter((r) => r.session === session))[0]
    return pair?.pct != null
      ? [
          {
            date: `${session.slice(0, 4)}-09-01`,
            breakBefore:
              index > 0 &&
              Number(session.slice(0, 4)) -
                Number(sessions[index - 1].slice(0, 4)) >
                1,
            label: `${session}: ${num(pair.same)} / ${num(pair.compared)} comparable`,
            value: pair.pct,
          },
        ]
      : []
  })
  return (
    <Feature
      id="pair-history"
      title={`${a} and ${b}: how did voting similarity change?`}
      lead="One observation per parliamentary session; weighted comparable-vote denominator."
      controls={
        <>
          <Select
            label="First party"
            value={a}
            options={RIKSDAG_PARTIES.map((p) => ({
              value: p,
              label: partyName(p),
            }))}
            onChange={(p) => set({ par: `${p},${p === b ? a : b}` })}
          />
          <Select
            label="Second party"
            value={b}
            options={RIKSDAG_PARTIES.filter((p) => p !== a).map((p) => ({
              value: p,
              label: partyName(p),
            }))}
            onChange={(p) => set({ par: `${a},${p}` })}
          />
        </>
      }
      source="Existing party-pair session mart; contextual counts where filtered"
    >
      {points.length ? (
        <MultiLineChart
          yTo={100}
          series={[{ key: 'pair', name: `${a} / ${b}`, points }]}
          colorOf={() => 'var(--color-chart-neutral)'}
          format={pct}
          label="Party-pair voting similarity by session"
        />
      ) : (
        <p>No comparable sessions for this pair and context.</p>
      )}
      <p className="po-note">
        The session selector focuses the matrix and decisions; this chart
        retains the selected historical range.
      </p>
    </Feature>
  )
}

export function FormationMatrix({
  route,
  data,
  compact = false,
}: {
  route: Route
  data: Workspace
  compact?: boolean
}) {
  const [view, set] = useViewParams(route, PARLIAMENT_DEFAULTS)
  const { selected } = useParties(route)
  const [hot, setHot] = useState<string | null>(null)
  const votes = data.ballots.filter(
    (v) =>
      Number(v.date.slice(0, 4)) >= Number(view.statsfran || 2014) &&
      (!view.statstill ||
        Number(v.date.slice(0, 4)) <= Number(view.statstill)) &&
      (!view.kandidat || v.candidate === view.kandidat),
  )
  const shown = compact ? votes.slice(-4) : votes
  const active =
    shown.find((v) => v.vote_key === view.statsrost) ?? shown.at(-1)
  const select = (v: Ballot, p?: BallotParty) => {
    setHot(
      `${v.candidate}, ${dayName(v.date)}${p ? `, ${p.source_party}: ${countsText(p)}` : ''}`,
    )
  }
  return (
    <Feature
      id="prime-minister-votes"
      title="Who accepted each prime minister candidate?"
      lead={`${data.coverage.ballots_from} to ${data.coverage.ballots_to}; ${data.ballots.length} verified ballots. Rejection requires at least 175 no votes.`}
      controls={
        !compact && (
          <>
            <Select
              label="Candidate"
              value={view.kandidat}
              options={[
                { value: '', label: 'All candidates' },
                ...[...new Set(data.ballots.map((v) => v.candidate))].map(
                  (value) => ({ value, label: value }),
                ),
              ]}
              onChange={(kandidat) => set({ kandidat })}
            />
            <Select
              label="Ballots from"
              value={view.statsfran}
              options={['2014', '2018', '2021', '2022', '2026'].map(
                (value) => ({ value, label: value }),
              )}
              onChange={(statsfran) => set({ statsfran })}
            />
            <Select
              label="Ballots through"
              value={view.statstill}
              options={[
                { value: '', label: 'Latest verified' },
                ...['2014', '2018', '2019', '2021', '2022', '2026'].map(
                  (value) => ({ value, label: value }),
                ),
              ]}
              onChange={(statstill) => set({ statstill })}
            />
          </>
        )
      }
      source={
        <a href="https://www.riksdagen.se/sv/sa-fungerar-riksdagen/demokrati/sa-bildas-regeringen/tidigare-regeringsbildningar-och-statsministrar/">
          Official ballot tables and parliamentary protocols; source per ballot
        </a>
      }
    >
      <div
        className="po-table-scroll"
        tabIndex={0}
        aria-label="Prime minister voting matrix"
      >
        <table className="po-ballots">
          <caption className="visually-hidden">
            Party voting positions. Mixed means that present party members cast
            more than one vote kind. Select a cell for the ballot record.
          </caption>
          <thead>
            <tr>
              <th scope="col">Candidate / date</th>
              {RIKSDAG_PARTIES.map((p) => (
                <th scope="col" key={p}>
                  {p}
                </th>
              ))}
              <th scope="col">No / 175</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr
                key={v.vote_key}
                className={active?.vote_key === v.vote_key ? 'is-selected' : ''}
              >
                <th scope="row">
                  <button
                    className="btn-text"
                    type="button"
                    onClick={() =>
                      compact
                        ? location.assign(
                            workspaceHref('#politik-riksdag', route.params, {
                              statsrost: v.vote_key,
                            }),
                          )
                        : set({ statsrost: v.vote_key })
                    }
                  >
                    {v.candidate}
                    <small>
                      {v.date}
                      {v.kind === 'incumbent_check' ? ' · incumbent check' : ''}
                    </small>
                  </button>
                </th>
                {RIKSDAG_PARTIES.map((p) => {
                  const row = v.parties.find((r) => r.party === p)
                  const position = row?.position ?? 'missing'
                  return (
                    <td
                      key={p}
                      className={
                        selected.length && !selected.includes(p) ? 'po-dim' : ''
                      }
                    >
                      <button
                        type="button"
                        className={`po-position po-position-${position}`}
                        aria-label={`${v.date}, ${v.candidate}, ${partyName(p)}: ${POSITION_LABEL[position]}${row ? ', ' + countsText(row) : ''}`}
                        onMouseEnter={() => select(v, row)}
                        onFocus={() => select(v, row)}
                        onClick={() =>
                          compact
                            ? location.assign(
                                workspaceHref(
                                  '#politik-riksdag',
                                  route.params,
                                  { statsrost: v.vote_key },
                                ),
                              )
                            : set({ statsrost: v.vote_key })
                        }
                      >
                        {symbols[position]}
                        {!compact && <small>{POSITION_LABEL[position]}</small>}
                      </button>
                    </td>
                  )
                })}
                <td>
                  {v.totals.no}
                  <small>{v.approved ? 'Approved' : 'Rejected'}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <p>No verified ballots match these filters.</p>}
      <p className="po-note po-readout" aria-live="polite">
        {hot ??
          'Focus a cell to read the recorded member counts. Abstention is separate from absence.'}
      </p>
      <div className="po-position-key">
        {Object.entries(POSITION_LABEL).map(([key, label]) => (
          <span key={key}>
            {symbols[key]} {label}
          </span>
        ))}
      </div>
      {!compact && active && (
        <section
          className="po-ballot-detail"
          aria-labelledby="ballot-detail-title"
        >
          <h3 id="ballot-detail-title">
            {active.candidate} · {active.date}
          </h3>
          <p>
            {active.kind === 'incumbent_check'
              ? 'Incumbent confidence check'
              : 'Speaker’s appointment proposal'}
            : <strong>{active.approved ? 'approved' : 'rejected'}</strong>.{' '}
            {countsText(active.totals)};{' '}
            {Object.values(active.totals).reduce((a, b) => a + b, 0)} members
            recorded.
          </p>
          <p>
            {active.formed_government
              ? `Government took office ${active.formed_government.start_date}: ${active.formed_government.government_parties.join(' + ')}.`
              : active.approved
                ? 'Approval did not produce a government in the linked term register.'
                : 'No government appointment resulted from this rejected proposal.'}{' '}
            {active.note}
          </p>
          <div className="po-table-scroll">
            <table>
              <caption>
                Parliamentary party composition and recorded votes on this date
              </caption>
              <thead>
                <tr>
                  <th>Party as recorded</th>
                  <th>Members</th>
                  <th>Yes</th>
                  <th>No</th>
                  <th>Abstain</th>
                  <th>Absent</th>
                </tr>
              </thead>
              <tbody>
                {active.parties.map((p) => (
                  <tr key={p.party}>
                    <th scope="row">
                      {p.source_party === '-'
                        ? 'Independent / no party'
                        : p.source_party}
                    </th>
                    <td>{p.members}</td>
                    <td>{p.yes}</td>
                    <td>{p.no}</td>
                    <td>{p.abstain}</td>
                    <td>{p.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="po-related" aria-label="Ballot evidence">
            <a href={active.source_url} target="_blank" rel="noreferrer">
              Official ballot / protocol ↗
            </a>
            {active.formed_government && (
              <a
                href={workspaceHref('#politik-riksdag', route.params, {
                  regering: active.formed_government.government_key,
                  riksmote: '',
                  fran: active.date.slice(0, 4),
                })}
              >
                Explore the subsequent government →
              </a>
            )}
          </nav>
          <details>
            <summary>Coverage and provenance</summary>
            <p>
              {data.coverage.ballots_note} An absent party record means
              unavailable, unless an explicit zero-member record establishes
              non-representation. FP is displayed under canonical L with its
              original label preserved. No-confidence motions use a different
              question and are excluded.
            </p>
            <p>
              Extraction: {active.extraction}; SHA-256{' '}
              <code>{active.source_sha256}</code>.
            </p>
          </details>
        </section>
      )}
      {compact && (
        <a href={workspaceHref('#politik-riksdag', route.params)}>
          All verified ballots and member counts →
        </a>
      )}
    </Feature>
  )
}

export function GovernmentHistory({
  route,
  data,
}: {
  route: Route
  data: Workspace
}) {
  const [view, set] = useViewParams(route, PARLIAMENT_DEFAULTS)
  return (
    <Feature
      id="government-history"
      title="Which parties served in each government?"
      lead="Terms since 1991. Membership is documented independently of appointment votes or abstention."
      source={
        <a href="https://www.riksdagen.se/sv/sa-fungerar-riksdagen/demokrati/sa-bildas-regeringen/tidigare-regeringsbildningar-och-statsministrar/">
          Riksdagen government history; dated government seed
        </a>
      }
    >
      <div
        className="po-table-scroll"
        tabIndex={0}
        aria-label="Government membership history"
      >
        <table>
          <thead>
            <tr>
              <th>Government</th>
              <th>Term</th>
              {RIKSDAG_PARTIES.map((p) => (
                <th key={p}>{p}</th>
              ))}
              <th>Documented agreement context</th>
            </tr>
          </thead>
          <tbody>
            {[...data.governments].reverse().map((g) => (
              <tr
                key={g.government_key}
                className={
                  view.regering === g.government_key ? 'is-selected' : ''
                }
              >
                <th scope="row">
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() =>
                      set({
                        regering: g.government_key,
                        riksmote: '',
                        fran: g.start_date.slice(0, 4),
                        till: g.end_date?.slice(0, 4) || '',
                      })
                    }
                  >
                    {g.prime_minister}
                  </button>
                </th>
                <td>
                  {g.start_date}
                  <br />
                  {g.end_date || `open at snapshot ${data.as_of}`}
                </td>
                {RIKSDAG_PARTIES.map((p) => (
                  <td
                    key={p}
                    aria-label={`${p}: ${g.government_parties.includes(p) ? 'government member' : 'not a government member'}`}
                  >
                    <span
                      style={{
                        color: g.government_parties.includes(p)
                          ? partyLine(p)
                          : undefined,
                      }}
                    >
                      {g.government_parties.includes(p) ? '●' : '—'}
                    </span>
                  </td>
                ))}
                <td>
                  {g.agreement_name || 'None recorded'}
                  {g.agreement_parties?.length
                    ? ` (${g.agreement_parties.join(', ')})`
                    : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="po-note">
        Agreement names describe the seed’s stated cooperation period; they are
        not day-by-day support classifications. A dash means no cabinet
        membership, not proof of opposition. The 2026 caretaker status is
        retained in the source snapshot.
      </p>
    </Feature>
  )
}

function CohesionPanel({ route, data }: { route: Route; data: Workspace }) {
  const [view, set] = useViewParams(route, PARLIAMENT_DEFAULTS)
  const { selected } = useParties(route)
  const rows = aggregateCohesion(
    data.cohesion.filter((r) => inContext(r, view)),
  ).filter((r) => !selected.length || selected.includes(r.party))
  const measure =
    view.enighet === 'attendance'
      ? 'attendance'
      : view.enighet === 'pm'
        ? 'pm'
        : 'unity'
  const value = (r: (typeof rows)[number]) =>
    measure === 'attendance'
      ? r.eligible
        ? (100 * r.present) / r.eligible
        : null
      : measure === 'pm'
        ? r.pm_compared
          ? (100 * r.pm_same) / r.pm_compared
          : null
        : r.comparable_cast
          ? (100 * r.aligned_cast) / r.comparable_cast
          : null
  return (
    <Feature
      id="party-cohesion"
      title={
        measure === 'attendance'
          ? 'Who participates in roll calls?'
          : measure === 'pm'
            ? 'How often does a party match the PM’s party?'
            : 'How united are parties when they vote?'
      }
      lead={`Delivered member counts: ${data.context_sessions.join('–')}. ${measure === 'attendance' ? 'Present / eligible member-votes.' : measure === 'pm' ? 'Same yes/no plurality / comparable yes/no roll calls.' : 'Plurality-aligned / comparable cast member-votes.'}`}
      controls={
        <Select
          label="Party record measure"
          value={measure}
          options={[
            { value: 'unity', label: 'Cohesion' },
            { value: 'attendance', label: 'Participation' },
            { value: 'pm', label: 'PM-party alignment' },
          ]}
          onChange={(enighet) => set({ enighet })}
        />
      }
      source="Riksdagen; counts grouped by vote date, party and policy issue"
      table={
        <table>
          <thead>
            <tr>
              <th>Party</th>
              <th>Roll calls</th>
              <th>Present</th>
              <th>Eligible</th>
              <th>Aligned cast</th>
              <th>Comparable cast</th>
              <th>Mixed roll calls</th>
              <th>PM same / comparable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.party}>
                <th>{r.party}</th>
                <td>{num(r.roll_calls)}</td>
                <td>{num(r.present)}</td>
                <td>{num(r.eligible)}</td>
                <td>{num(r.aligned_cast)}</td>
                <td>{num(r.comparable_cast)}</td>
                <td>{num(r.mixed_roll_calls)}</td>
                <td>
                  {r.pm_same} / {r.pm_compared}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {rows.length ? (
        <RankBars
          label="Party record on a fixed zero to 100 scale"
          max={100}
          format={pct}
          rows={rows.flatMap((r) => {
            const v = value(r)
            return v == null
              ? []
              : [
                  {
                    key: r.party,
                    label: <PartyTag party={r.party} />,
                    value: v,
                    party: r.party,
                  },
                ]
          })}
        />
      ) : (
        <p>No delivered member counts match this period and context.</p>
      )}
      <details>
        <summary>What these measures mean</summary>
        <p>
          Abstentions count as participation and as a voting position; absence
          does not. Unity excludes tied pluralities from its cast-vote
          denominator, while mixed roll calls count any party casting more than
          one present vote kind. PM alignment is a comparison with the prime
          minister’s party plurality on that date, not the government’s official
          preference or a claim of support. It excludes abstentions on either
          side.
        </p>
      </details>
    </Feature>
  )
}

export default function Parliament({ route }: { route: Route }) {
  const { data, error } = useDataset<Workspace>(workspacePath)
  return (
    <>
      <h1>Parliament & Governments</h1>
      {!data ? (
        <DataState error={error} />
      ) : (
        <>
          <ContextFilters route={route} data={data} />
          <div className="dk-grid po-grid">
            <div className="po-span-12">
              <FormationMatrix route={route} data={data} />
            </div>
            <div className="po-span-6">
              <Similarity route={route} data={data} />
            </div>
            <div className="po-span-6">
              <PairHistory route={route} data={data} />
            </div>
            <div className="po-span-6">
              <CohesionPanel route={route} data={data} />
            </div>
            <div className="po-span-6">
              <Feature
                id="roll-call-activity"
                title="How much recorded voting activity is available?"
                lead="Substantive roll calls by parliamentary session. The final session may be incomplete."
                source="Parliamentary session coverage"
              >
                <MultiLineChart
                  label="Recorded roll calls by session"
                  colorOf={() => 'var(--color-chart-neutral)'}
                  format={num}
                  series={[
                    {
                      key: 'activity',
                      name: 'Substantive roll calls',
                      points: data.sessions
                        .filter((s) =>
                          inContext(s, {
                            ...CONTEXT_DEFAULTS,
                            fran: route.params.get('fran') || '1993',
                            till: route.params.get('till') || '',
                          }),
                        )
                        .map((s) => ({
                          date: `${s.start_year}-09-01`,
                          label: s.session,
                          value: s.roll_calls,
                        })),
                    },
                  ]}
                />
                <p className="po-note">
                  This coverage chart follows the historical range. It does not
                  apply party, issue or government filters.
                </p>
              </Feature>
            </div>
            <div className="po-span-12">
              <GovernmentHistory route={route} data={data} />
            </div>
            <div className="po-span-12">
              <DecisionExplorer route={route} data={data} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
