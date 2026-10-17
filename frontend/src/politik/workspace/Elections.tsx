import { useMemo } from 'react'
import type { Route } from '../../router'
import {
  type Elections as ElectionData,
  type Poll,
} from '../../parliament/data'
import MultiLineChart from '../../charts/MultiLineChart'
import RankBars from '../../charts/RankBars'
import { Dumbbell } from '../../charts/Compare'
import { Feature, Pick } from '../../charts/feature/Feature'
import { PartyTag, partyLine, partyName } from '../../parties/identity'
import { useParties, shownParties } from '../partySelection'
import { useViewParams } from '../useViewParams'
import { Select, monthName, pct, signed, num } from '../controls'
import { DataState } from './Workspace'
import { useDataset } from './data'
import { workspaceHref } from './logic'
import SeatLines from '../features/SeatLines'

const defaults = {
  fran: '2014',
  till: '',
  matt: 'psu',
  ar: '',
  jamfor: '',
  osakerhet: '1',
}

export function SupportTrend({
  route,
  compact = false,
}: {
  route: Route
  compact?: boolean
}) {
  const { data, error } = useDataset<{ polls: Poll[] }>('parliament/polls.json')
  const [view, set] = useViewParams(route, defaults)
  const { selected } = useParties(route)
  const parties = shownParties(selected)
  const from = /^\d{4}$/.test(view.fran) ? Number(view.fran) : 2014
  const to = /^\d{4}$/.test(view.till)
    ? Number(view.till)
    : new Date().getFullYear()
  const rows = useMemo(
    () =>
      (data?.polls ?? []).filter(
        (p) =>
          p.survey_month >= `${from}-01-01` &&
          p.survey_month <= `${to}-12-31` &&
          p.survey_month <= new Date().toISOString().slice(0, 10),
      ),
    [data, from, to],
  )
  const dates = [...new Set(rows.map((r) => r.survey_month))].sort()
  return (
    <Feature
      id="opinionen"
      title="How has party support changed?"
      lead={`SCB Party Preference Survey, ${dates[0] ? monthName(dates[0]) : '…'} to ${dates.at(-1) ? monthName(dates.at(-1)!) : '…'}. Estimates, not election results.`}
      controls={
        <>
          <Select
            label="From year"
            value={String(from)}
            options={[
              ...new Set([
                String(from),
                '1972',
                '1994',
                '2006',
                '2014',
                '2022',
              ]),
            ]
              .sort()
              .map((value) => ({
                value,
                label: value,
              }))}
            onChange={(fran) => set({ fran })}
          />
          {!compact && (
            <Select
              label="Through year"
              value={view.till}
              options={[
                { value: '', label: 'Latest available' },
                ...[
                  ...new Set(
                    (data?.polls ?? []).map((r) => r.survey_month.slice(0, 4)),
                  ),
                ]
                  .sort()
                  .reverse()
                  .map((value) => ({ value, label: value })),
              ]}
              onChange={(till) => set({ till })}
            />
          )}
          {!compact && (
            <label className="po-check">
              <input
                type="checkbox"
                checked={view.osakerhet !== '0'}
                onChange={(e) =>
                  set({ osakerhet: e.target.checked ? '1' : '0' })
                }
              />
              Published uncertainty
            </label>
          )}
        </>
      }
      source={
        <a href="https://www.scb.se/hitta-statistik/statistik-efter-amne/demokrati/partisympatier/partisympatiundersokningen-psu/">
          SCB PSU · survey month and published margin of error
        </a>
      }
      table={
        <table>
          <caption>
            Survey estimates, percent; uncertainty is the source margin in
            percentage points
          </caption>
          <thead>
            <tr>
              <th>Survey</th>
              <th>Party</th>
              <th>Estimate</th>
              <th>Margin ±</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => parties.includes(r.party))
              .map((r) => (
                <tr key={`${r.survey_month}-${r.party}`}>
                  <td>{monthName(r.survey_month)}</td>
                  <td>{r.party}</td>
                  <td>{pct(r.share_pct)}</td>
                  <td>
                    {r.margin_of_error_pp == null
                      ? 'Unavailable'
                      : `${num(r.margin_of_error_pp, 1)} pp`}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      }
    >
      {!data ? (
        <DataState error={error} />
      ) : !rows.length ? (
        <p>No observations in this period.</p>
      ) : (
        <MultiLineChart
          label="Party support in SCB surveys"
          series={parties.map((p) => ({
            key: p,
            party: p,
            name: partyName(p),
            points: rows
              .filter((r) => r.party === p)
              .map((r, i, series) => ({
                date: r.survey_month,
                label: monthName(r.survey_month),
                value: r.share_pct,
                breakBefore:
                  i > 0 &&
                  Date.parse(r.survey_month) -
                    Date.parse(series[i - 1].survey_month) >
                    220 * 86400000,
                low:
                  view.osakerhet !== '0' && r.margin_of_error_pp != null
                    ? Math.max(0, r.share_pct - r.margin_of_error_pp)
                    : null,
                high:
                  view.osakerhet !== '0' && r.margin_of_error_pp != null
                    ? r.share_pct + r.margin_of_error_pp
                    : null,
              })),
          }))}
          format={pct}
          colorOf={partyLine}
        />
      )}
      {!compact && (
        <details>
          <summary>Method and missing observations</summary>
          <p>
            Dates identify the survey month. Lines use calendar spacing and
            break when observations are more than 220 days apart. Margins
            describe individual estimates; a change between surveys is not
            automatically statistically significant. Parliamentary session,
            government and issue filters do not filter survey respondents.
          </p>
        </details>
      )}
    </Feature>
  )
}

export function Composition({
  route,
  compact = false,
}: {
  route: Route
  compact?: boolean
}) {
  const { data, error } = useDataset<ElectionData>('parliament/elections.json')
  const [view, set] = useViewParams(route, defaults)
  const { selected } = useParties(route)
  const years = (data?.years ?? []).filter((y) => y <= new Date().getFullYear())
  const year = years.includes(Number(view.ar)) ? Number(view.ar) : years.at(-1)
  const rows = (data?.results ?? []).filter(
    (r) => r.election_year === year && r.seats > 0,
  )
  const total = rows.reduce((s, r) => s + r.seats, 0)
  return (
    <Feature
      id="seat-distribution"
      title={`Who won the seats in ${year ?? '…'}?`}
      lead={`${total || '…'} seats allocated at the election; subsequent membership changes are not shown.`}
      controls={
        !compact && (
          <Select
            label="Election year"
            value={String(year)}
            options={[...years]
              .reverse()
              .map((y) => ({ value: String(y), label: String(y) }))}
            onChange={(ar) => set({ ar })}
          />
        )
      }
      source="SCB ME0104 and Valmyndigheten, official election allocation"
    >
      {!data ? (
        <DataState error={error} />
      ) : (
        <>
          <div
            className="po-seat-strip"
            aria-label={`Election ${year} seat distribution`}
          >
            {rows.map((r) => (
              <span
                key={r.party}
                title={`${partyName(r.party)}: ${r.seats}`}
                style={{
                  flex: r.seats,
                  background: partyLine(r.party),
                  opacity:
                    selected.length && !selected.includes(r.party) ? 0.25 : 1,
                }}
              />
            ))}
          </div>
          <RankBars
            rows={rows
              .filter((r) => !selected.length || selected.includes(r.party))
              .sort((a, b) => b.seats - a.seats)
              .map((r) => ({
                key: r.party,
                label: <PartyTag party={r.party} />,
                value: r.seats,
                party: r.party,
              }))}
            format={num}
            max={total}
            label="Allocated parliamentary seats by party"
          />
          {compact && (
            <a
              href={workspaceHref('#politik-val', route.params, {
                matt: 'mandat',
                ar: String(year),
              })}
            >
              Compare election years →
            </a>
          )}
        </>
      )}
    </Feature>
  )
}

export default function Elections({ route }: { route: Route }) {
  const { data: polls, error } = useDataset<{ polls: Poll[] }>(
    'parliament/polls.json',
  )
  const { data: elections } = useDataset<ElectionData>(
    'parliament/elections.json',
  )
  const [view, set] = useViewParams(route, defaults)
  const { selected } = useParties(route)
  const chosen = shownParties(selected)
  const dates = [...new Set((polls?.polls ?? []).map((p) => p.survey_month))]
    .filter((d) => d <= new Date().toISOString().slice(0, 10))
    .sort()
  const latest = dates.at(-1),
    previous = dates.at(-2)
  const diff = chosen.flatMap((p) => {
    const a = polls?.polls.find(
        (r) => r.party === p && r.survey_month === previous,
      ),
      b = polls?.polls.find((r) => r.party === p && r.survey_month === latest)
    return a && b
      ? [
          {
            key: p,
            label: (
              <span>
                <PartyTag party={p} />
                <small>{signed(b.share_pct - a.share_pct, 1)} pp</small>
              </span>
            ),
            from: a.share_pct,
            to: b.share_pct,
            colour: partyLine(p),
          },
        ]
      : []
  })
  const years = (elections?.years ?? []).filter(
    (y) => y <= new Date().getFullYear(),
  )
  const year = years.includes(Number(view.ar)) ? Number(view.ar) : years.at(-1)!
  const earlier = years.includes(Number(view.jamfor))
    ? Number(view.jamfor)
    : years.at(-2)!
  const measure = ['val', 'mandat'].includes(view.matt) ? view.matt : 'psu'
  const results = (elections?.results ?? []).filter(
    (r) =>
      r.election_year === year &&
      (!selected.length || selected.includes(r.party)),
  )
  const electionValue = (r: ElectionData['results'][number]) =>
    measure === 'mandat'
      ? (100 * r.seats) / (r.election_year === 1973 ? 350 : 349)
      : r.share_pct
  const electionRows = results.flatMap((r) => {
    const old = elections?.results.find(
      (o) => o.party === r.party && o.election_year === earlier,
    )
    const to = electionValue(r),
      from = old ? electionValue(old) : null
    return to != null && from != null
      ? [
          {
            key: r.party,
            label: <PartyTag party={r.party} />,
            from,
            to,
            colour: partyLine(r.party),
          },
        ]
      : []
  })
  const historyYears = years.filter(
    (y) =>
      y >= Number(view.fran || 1973) && (!view.till || y <= Number(view.till)),
  )
  return (
    <>
      <h1>Elections & Voters</h1>
      <Pick
        label="Election and survey measure"
        value={measure}
        options={[
          { value: 'psu', label: 'Survey estimates' },
          { value: 'val', label: 'Election vote share' },
          { value: 'mandat', label: 'Seat share' },
        ]}
        onChange={(matt) => set({ matt })}
      />
      <div className="dk-grid po-grid">
        {measure === 'psu' ? (
          <>
            <div className="po-span-8">
              <SupportTrend route={route} />
            </div>
            <div className="po-span-4">
              <Feature
                id="poll-change"
                title="What changed since the previous survey?"
                lead={`${previous ? monthName(previous) : '…'} → ${latest ? monthName(latest) : '…'}; changes in percentage points.`}
                source="SCB PSU; same party in successive surveys"
              >
                {!polls ? (
                  <DataState error={error} />
                ) : (
                  <Dumbbell
                    rows={diff}
                    fromLabel={previous ? monthName(previous) : ''}
                    toLabel={latest ? monthName(latest) : ''}
                    format={(v) => pct(v)}
                    label="Latest and previous survey estimates"
                  />
                )}
                <p className="po-note">
                  Published uncertainty is available in the trend and table. The
                  difference alone does not establish a significant change.
                </p>
              </Feature>
            </div>
          </>
        ) : (
          <>
            <div className="po-span-8">
              <Feature
                id="election-history"
                title={
                  measure === 'mandat'
                    ? 'How has parliamentary representation changed?'
                    : 'How has election support changed?'
                }
                lead={`${historyYears[0] ?? '…'}–${historyYears.at(-1) ?? '…'}; ${measure === 'mandat' ? 'seats' : 'share of valid votes'}.`}
                controls={
                  <Select
                    label="History from"
                    value={view.fran}
                    options={[
                      ...new Set([
                        view.fran,
                        '1973',
                        '1994',
                        '2006',
                        '2014',
                        '2022',
                      ]),
                    ]
                      .sort()
                      .map((value) => ({ value, label: value }))}
                    onChange={(fran) => set({ fran })}
                  />
                }
                source="SCB and Valmyndigheten; election years on a calendar axis"
              >
                {!elections ? (
                  <DataState />
                ) : measure === 'mandat' ? (
                  <SeatLines
                    label="Seats allocated at each election"
                    ceiling={200}
                    years={historyYears}
                    lines={chosen.map((p) => ({
                      key: p,
                      seats: historyYears.map(
                        (y) =>
                          elections.results.find(
                            (r) => r.party === p && r.election_year === y,
                          )?.seats ?? 0,
                      ),
                    }))}
                  />
                ) : (
                  <MultiLineChart
                    label="Vote share in Riksdag elections"
                    series={chosen.map((p) => ({
                      key: p,
                      party: p,
                      name: partyName(p),
                      points: elections.results
                        .filter(
                          (r) =>
                            r.party === p &&
                            historyYears.includes(r.election_year) &&
                            r.share_pct != null,
                        )
                        .map((r) => ({
                          date: `${r.election_year}-09-01`,
                          label: String(r.election_year),
                          value: r.share_pct!,
                        })),
                    }))}
                    format={pct}
                    colorOf={partyLine}
                  />
                )}
                <details>
                  <summary>Historical coverage</summary>
                  <p>
                    {elections?.note} Axis dates identify election years, not
                    inferred election days. Seat lines connect election
                    allocations, not voter flows.
                  </p>
                </details>
              </Feature>
            </div>
            <div className="po-span-4">
              <Feature
                id="election-compare"
                title="How do two elections compare?"
                lead={
                  measure === 'mandat'
                    ? 'Share of seats, percent.'
                    : 'Share of valid votes, percent.'
                }
                controls={
                  <>
                    <Select
                      label="Election"
                      value={String(year)}
                      options={[...years]
                        .reverse()
                        .map((y) => ({ value: String(y), label: String(y) }))}
                      onChange={(ar) => set({ ar })}
                    />
                    <Select
                      label="Compare with"
                      value={String(earlier)}
                      options={[...years]
                        .reverse()
                        .map((y) => ({ value: String(y), label: String(y) }))}
                      onChange={(jamfor) => set({ jamfor })}
                    />
                  </>
                }
                source="Official election allocations, matched by canonical party"
              >
                <Dumbbell
                  rows={electionRows}
                  fromLabel={String(earlier)}
                  toLabel={String(year)}
                  format={pct}
                  label="Two-election comparison"
                />
              </Feature>
            </div>
          </>
        )}
        <div className="po-span-12">
          <Composition route={route} />
        </div>
      </div>
      <nav className="po-related" aria-label="Election research">
        <a href={workspaceHref('#politik-valjarna', route.params)}>
          Advanced comparison builder
        </a>
        <a href={workspaceHref('#politik-mandat', route.params)}>
          Seat calculator
        </a>
        <a href={workspaceHref('#politik-partier', route.params)}>
          Party profiles and municipal results
        </a>
      </nav>
    </>
  )
}
