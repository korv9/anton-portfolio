import BudgetLedger from './BudgetLedger'
import BudgetOverview from './BudgetOverview'
import BudgetLanguage, { type Language } from './BudgetLanguage'
import { useEffect, useMemo, useState } from 'react'
import './budget.css'

type BudgetRow = {
  session: string
  budget_year: number
  expenditure_area: number
  expenditure_area_name: string
  actor: string
  amount_msek: number
  deviation_msek: number
  budget_share_pct: number
  source_url: string
}

type AlignmentRow = {
  session: string
  budget_year: number
  party: string
  expenditure_area: number
  expenditure_area_name: string
  amount_msek: number
  deviation_msek: number
  budget_share_pct: number
  speech_keyword_occurrences: number
  speech_attention_pct: number
  attention_minus_budget_pp: number
  alignment_correlation: number | null
  source_url: string
}

type BudgetCoverage = {
  documents: { session: string; source_url: string; rows: number }[]
  errors: { session: string }[]
}

type SpeechRow = {
  session: string
  party: string
  expenditure_area: number
  occurrences: number
  keyword_share_pct: number | null
}

const allPartyCodes = ['C', 'KD', 'L', 'M', 'MP', 'S', 'SD', 'V']

const areaNames: Record<number, string> = {
  1: 'Government administration',
  2: 'Public finance',
  3: 'Tax & customs',
  4: 'Justice',
  5: 'International cooperation',
  6: 'Defence & crisis readiness',
  7: 'International aid',
  8: 'Migration',
  9: 'Health & social care',
  10: 'Sickness & disability benefits',
  11: 'Old-age income security',
  12: 'Family & child benefits',
  13: 'Integration & equality',
  14: 'Labour market',
  15: 'Student support',
  16: 'Education & research',
  17: 'Culture & media',
  18: 'Housing & planning',
  19: 'Regional development',
  20: 'Climate & environment',
  21: 'Energy',
  22: 'Transport & communications',
  23: 'Rural affairs & food',
  24: 'Business',
  25: 'Municipal grants',
  26: 'Public debt interest',
  27: 'EU contribution',
}
export const nameOf = (area: number) => areaNames[area] ?? `Area ${area}`
const percent = (value: number, digits = 1) =>
  value > 0 && value < 0.1 ? '<0.1%' : `${value.toFixed(digits)}%`
const signed = (value: number, digits = 1) =>
  `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
const number = (value: number) => new Intl.NumberFormat('en-GB').format(value)
const partyColors: Record<string, string> = {
  C: '#006b52',
  KD: '#415990',
  L: '#3264a6',
  M: '#335d89',
  MP: '#35701d',
  S: '#bd392d',
  SD: '#806300',
  V: '#a32265',
}

function ScatterChart({
  rows,
  selected,
  allParties,
  onSelect,
}: {
  rows: AlignmentRow[]
  selected: number
  allParties: boolean
  onSelect: (row: AlignmentRow) => void
}) {
  const width = 620,
    height = 420,
    left = 58,
    right = 22,
    top = 24,
    bottom = 54
  const maximum = Math.max(
    10,
    ...rows.flatMap((row) => [row.budget_share_pct, row.speech_attention_pct]),
  )
  const max = Math.ceil(maximum / 5) * 5
  const x = (value: number) => left + (value / max) * (width - left - right)
  const y = (value: number) =>
    height - bottom - (value / max) * (height - top - bottom)
  return (
    <svg
      className="budget-scatter"
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={`Budget share on the horizontal axis and debate keyword share on the vertical axis, one point per party and expenditure area${allParties ? ' for all available parties' : ''}`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((step) => (
        <g key={step}>
          <line
            x1={left}
            x2={width - right}
            y1={y(max * step)}
            y2={y(max * step)}
            className="budget-grid"
          />
          <text
            x={left - 10}
            y={y(max * step) + 4}
            textAnchor="end"
            className="budget-axis"
          >
            {Math.round(max * step)}%
          </text>
          <text
            x={x(max * step)}
            y={height - bottom + 20}
            textAnchor="middle"
            className="budget-axis"
          >
            {Math.round(max * step)}%
          </text>
        </g>
      ))}
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(max)}
        y2={y(max)}
        stroke="#aeb8b2"
        strokeDasharray="5 5"
        strokeWidth="1.5"
      />
      {rows.map((row) => (
        <circle
          key={`${row.party}-${row.expenditure_area}`}
          cx={x(row.budget_share_pct)}
          cy={y(row.speech_attention_pct)}
          r={selected === row.expenditure_area ? 7 : 4.5}
          className={
            selected === row.expenditure_area
              ? 'budget-dot selected'
              : 'budget-dot'
          }
          style={
            allParties
              ? { fill: partyColors[row.party] ?? '#007a75' }
              : undefined
          }
          tabIndex={0}
          role="button"
          aria-label={`${row.party}, ${nameOf(row.expenditure_area)}: ${percent(row.budget_share_pct)} of budget, ${percent(row.speech_attention_pct)} of matched debate keywords`}
          onClick={() => onSelect(row)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(row)
            }
          }}
        >
          <title>
            {row.party} · {nameOf(row.expenditure_area)}
          </title>
        </circle>
      ))}
      <text
        x={width / 2}
        y={height - 6}
        textAnchor="middle"
        className="budget-axis-title"
      >
        Share of party budget
      </text>
      <text
        transform={`translate(15 ${height / 2}) rotate(-90)`}
        textAnchor="middle"
        className="budget-axis-title"
      >
        Share of matched debate keywords
      </text>
    </svg>
  )
}

function DifferenceBars({
  rows,
  allParties,
  onSelect,
}: {
  rows: AlignmentRow[]
  allParties: boolean
  onSelect: (row: AlignmentRow) => void
}) {
  const sorted = [...rows].sort(
    (a, b) => b.attention_minus_budget_pp - a.attention_minus_budget_pp,
  )
  const selected = [...sorted.slice(0, 4), ...sorted.slice(-4)]
  const max = Math.max(
    ...selected.map((row) => Math.abs(row.attention_minus_budget_pp)),
    1,
  )
  return (
    <div className="difference-bars">
      {selected.map((row) => (
        <button
          key={`${row.party}-${row.expenditure_area}`}
          className="difference-row"
          onClick={() => onSelect(row)}
          aria-label={`${row.party}, ${nameOf(row.expenditure_area)}: ${signed(row.attention_minus_budget_pp)} percentage points`}
        >
          <span>
            {allParties && (
              <b
                className="party-initial"
                style={{ color: partyColors[row.party] }}
              >
                {row.party}
              </b>
            )}
            {nameOf(row.expenditure_area)}
          </span>
          <span className="difference-track">
            <i
              className={
                row.attention_minus_budget_pp >= 0 ? 'positive' : 'negative'
              }
              style={{
                width: `${(Math.abs(row.attention_minus_budget_pp) / max) * 48}%`,
                left:
                  row.attention_minus_budget_pp >= 0
                    ? '50%'
                    : `${50 - (Math.abs(row.attention_minus_budget_pp) / max) * 48}%`,
              }}
            />
          </span>
          <strong>{signed(row.attention_minus_budget_pp)} pp</strong>
        </button>
      ))}
    </div>
  )
}

function PartyAreaComparison({
  speechRows,
  budgetRows,
  session,
  area,
}: {
  speechRows: SpeechRow[]
  budgetRows: AlignmentRow[]
  session: string
  area: number
}) {
  const selected = allPartyCodes.map((party) => ({
    party,
    speech: speechRows.find(
      (row) =>
        row.session === session &&
        row.party === party &&
        row.expenditure_area === area,
    ),
    budget: budgetRows.find(
      (row) => row.party === party && row.expenditure_area === area,
    ),
  }))
  const max = Math.max(
    1,
    ...selected.flatMap((row) => [
      row.budget?.budget_share_pct ?? 0,
      row.speech?.keyword_share_pct ?? 0,
    ]),
  )
  return (
    <div
      className="party-area-comparison"
      aria-label={`Budget and keyword shares for ${nameOf(area)} across all eight parties`}
    >
      <div className="party-area-head">
        <strong>{nameOf(area)} · all eight parties</strong>
        <span>
          <i className="budget-key" /> Budget share{' '}
          <i className="keyword-key" /> Keyword share
        </span>
      </div>
      <div className="party-area-rows">
        {selected.map((row) => (
          <div className="party-area-row" key={row.party}>
            <b style={{ color: partyColors[row.party] }}>{row.party}</b>
            <div className="party-area-bars">
              {row.budget && (
                <span
                  className="budget-bar"
                  style={{
                    width: `${(row.budget.budget_share_pct / max) * 100}%`,
                  }}
                />
              )}
              {row.speech?.keyword_share_pct != null && (
                <span
                  className="keyword-bar"
                  style={{
                    width: `${(row.speech.keyword_share_pct / max) * 100}%`,
                  }}
                />
              )}
            </div>
            <span
              aria-label={`${row.party}: budget ${row.budget ? percent(row.budget.budget_share_pct) : 'no separate frame'}, keyword share ${row.speech?.keyword_share_pct != null ? percent(row.speech.keyword_share_pct) : 'unavailable'}`}
              title={`${row.speech?.occurrences ?? 0} keyword matches`}
            >
              {row.budget ? percent(row.budget.budget_share_pct) : '—'} /{' '}
              {row.speech?.keyword_share_pct != null
                ? percent(row.speech.keyword_share_pct)
                : '—'}
            </span>
          </div>
        ))}
      </div>
      <p>
        Budget share / keyword share. A dash means no separate party budget
        frame. Keyword shares use the selected method and archive, calculated
        separately within each party. 0.0% means zero detected matches; — means
        unavailable. They do not measure policy support.
      </p>
    </div>
  )
}

function CoverageMatrix({
  rows,
  coverage,
  session,
}: {
  rows: BudgetRow[]
  coverage: BudgetCoverage
  session: string
}) {
  const years = [
    ...new Set([
      ...coverage.documents.map((item) => item.session),
      ...coverage.errors.map((item) => item.session),
    ]),
  ]
    .sort()
    .reverse()
  const count = (year: string, actor: string) =>
    rows.filter((row) => row.session === year && row.actor === actor).length
  return (
    <details className="coverage-details">
      <summary>Coverage: all eight parties and missing budget data</summary>
      <p>
        Debate speeches are present for all eight parties in these sessions. The
        cells below count expenditure areas in the imported FiU1 budget table;
        27/27 is complete. A dash means there is no separate party budget frame
        in this export, not zero spending. GOV is the collective government
        proposal and cannot be assigned to individual parties.
      </p>
      <div
        className="coverage-scroll"
        tabIndex={0}
        aria-label="Budget coverage table scrolls horizontally on small screens"
      >
        <table>
          <caption>Imported budget areas by session and actor</caption>
          <thead>
            <tr>
              <th scope="col">Session</th>
              {allPartyCodes.map((code) => (
                <th key={code} scope="col">
                  {code}
                </th>
              ))}
              <th scope="col">GOV</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className={year === session ? 'current' : ''}>
                <th scope="row">{year}</th>
                {[...allPartyCodes, 'GOV'].map((code) => {
                  const value = count(year, code)
                  return (
                    <td
                      key={code}
                      className={
                        value === 27
                          ? 'complete'
                          : value > 0
                            ? 'partial'
                            : 'absent'
                      }
                      title={
                        value === 27
                          ? 'Complete'
                          : value > 0
                            ? 'Incomplete import'
                            : 'No separate budget frame'
                      }
                    >
                      {value ? `${value}/27` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        2017/18 and 2018/19 are incomplete imports and are excluded from
        share-based charts until repaired. In 2014/15, 2015/16, 2020/21 and
        2021/22 the importer did not find a machine-readable FiU1 comparison
        table.
      </p>
    </details>
  )
}

function BudgetHeatmap({
  rows,
  selectedArea,
  onSelect,
}: {
  rows: BudgetRow[]
  selectedArea: number
  onSelect: (area: number) => void
}) {
  const parties = [
    ...new Set(
      rows.filter((row) => row.actor !== 'GOV').map((row) => row.actor),
    ),
  ].sort()
  const byArea = [...new Set(rows.map((row) => row.expenditure_area))].map(
    (area) => ({
      area,
      rows: rows.filter(
        (row) => row.expenditure_area === area && row.actor !== 'GOV',
      ),
    }),
  )
  const ranked = byArea
    .map((item) => ({
      ...item,
      peak: Math.max(
        0,
        ...item.rows.map((row) => Math.abs(row.deviation_msek)),
      ),
    }))
    .sort((a, b) => b.peak - a.peak)
    .slice(0, 12)
  const max = Math.max(...ranked.map((row) => row.peak), 1)
  return (
    <div
      className="heatmap-scroll"
      tabIndex={0}
      aria-label="Budget deviation heatmap can scroll horizontally on small screens"
    >
      <div
        className="budget-heatmap"
        style={{
          gridTemplateColumns: `minmax(185px, 1.7fr) repeat(${parties.length}, minmax(72px, 1fr))`,
        }}
      >
        <div className="heatmap-heading">Expenditure area</div>
        {parties.map((party) => (
          <div className="heatmap-heading" key={party}>
            {party}
          </div>
        ))}
        {ranked.flatMap((item) => [
          <button
            key={`${item.area}-label`}
            className={`heatmap-label ${selectedArea === item.area ? 'selected' : ''}`}
            onClick={() => onSelect(item.area)}
          >
            {nameOf(item.area)}
          </button>,
          ...parties.map((party) => {
            const row = item.rows.find((entry) => entry.actor === party)
            if (!row)
              return (
                <span
                  key={`${item.area}-${party}`}
                  className="heatmap-cell missing"
                  aria-label={`${party}, ${nameOf(item.area)}: no comparable figure`}
                >
                  —
                </span>
              )
            const value = row.deviation_msek
            const strength = Math.min(
              0.58,
              Math.max(0.08, (Math.abs(value) / max) * 0.58),
            )
            return (
              <button
                key={`${item.area}-${party}`}
                className="heatmap-cell"
                style={{
                  background:
                    value >= 0
                      ? `rgba(0, 104, 100, ${strength})`
                      : `rgba(214, 75, 43, ${strength})`,
                  color: '#172321',
                }}
                onClick={() => onSelect(item.area)}
                aria-label={`${party}, ${nameOf(item.area)}: ${value > 0 ? '+' : ''}${number(value)} million SEK versus government proposal`}
              >
                {value > 0 ? '+' : ''}
                {number(value)}
              </button>
            )
          }),
        ])}
      </div>
    </div>
  )
}

function TrendChart({
  rows,
  party,
  area,
}: {
  rows: AlignmentRow[]
  party: string
  area: number
}) {
  const data = rows
    .filter((row) => row.party === party && row.expenditure_area === area)
    .sort((a, b) => a.budget_year - b.budget_year)
  if (data.length < 2)
    return (
      <p className="budget-empty">
        Fewer than two comparable years for this choice.
      </p>
    )
  const width = 620,
    height = 250,
    left = 44,
    right = 24,
    top = 22,
    bottom = 42
  const minYear = Math.min(...data.map((row) => row.budget_year)),
    maxYear = Math.max(...data.map((row) => row.budget_year))
  const maxValue = Math.max(
    5,
    ...data.flatMap((row) => [row.budget_share_pct, row.speech_attention_pct]),
  )
  const yMax = Math.ceil(maxValue / 5) * 5
  const x = (year: number) =>
    left +
    ((year - minYear) / Math.max(maxYear - minYear, 1)) * (width - left - right)
  const y = (value: number) =>
    height - bottom - (value / yMax) * (height - top - bottom)
  const series = [
    {
      key: 'budget_share_pct' as const,
      color: '#006864',
      label: 'Budget share',
    },
    {
      key: 'speech_attention_pct' as const,
      color: '#d64b2b',
      label: 'Keyword share',
    },
  ]
  const consecutiveRuns = data.reduce<AlignmentRow[][]>((runs, row) => {
    const current = runs[runs.length - 1]
    if (
      !current ||
      row.budget_year - current[current.length - 1].budget_year > 1
    )
      runs.push([row])
    else current.push(row)
    return runs
  }, [])
  return (
    <svg
      className="budget-trend"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Budget share and matched debate keyword share for ${party} in ${nameOf(area)} across available budget years`}
    >
      {[0, 0.5, 1].map((step) => (
        <g key={step}>
          <line
            x1={left}
            x2={width - right}
            y1={y(yMax * step)}
            y2={y(yMax * step)}
            className="budget-grid"
          />
          <text
            x={left - 7}
            y={y(yMax * step) + 4}
            textAnchor="end"
            className="budget-axis"
          >
            {Math.round(yMax * step)}%
          </text>
        </g>
      ))}
      {series.map((item) => (
        <g key={item.key}>
          {consecutiveRuns
            .filter((run) => run.length > 1)
            .map((run) => (
              <polyline
                key={run[0].budget_year}
                points={run
                  .map((row) => `${x(row.budget_year)},${y(row[item.key])}`)
                  .join(' ')}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {data.map((row) => (
            <circle
              key={row.budget_year}
              cx={x(row.budget_year)}
              cy={y(row[item.key])}
              r="4"
              fill="white"
              stroke={item.color}
              strokeWidth="2"
            >
              <title>{`${row.budget_year}: ${item.label} ${percent(row[item.key])}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {data.map((row) => (
        <text
          key={row.budget_year}
          x={x(row.budget_year)}
          y={height - 11}
          textAnchor="middle"
          className="budget-axis"
        >
          {row.budget_year}
        </text>
      ))}
    </svg>
  )
}

function CorrelationTimeline({
  rows,
  party,
}: {
  rows: AlignmentRow[]
  party: string
}) {
  const unique = [
    ...new Map(
      rows
        .filter((row) => row.party === party)
        .map((row) => [row.session, row]),
    ).values(),
  ].sort((a, b) => a.budget_year - b.budget_year)
  return (
    <div
      className="correlation-timeline"
      role="img"
      aria-label={`Correlation between budget share and keyword share by available session for ${party}`}
    >
      {unique.map((row) => {
        const value = row.alignment_correlation
        return (
          <div className="correlation-row" key={row.session}>
            <span>{row.session}</span>
            <span className="correlation-track">
              <i
                className={
                  value != null && value >= 0 ? 'positive' : 'negative'
                }
                style={{
                  width: `${Math.abs(value ?? 0) * 48}%`,
                  left:
                    value != null && value >= 0
                      ? '50%'
                      : `${50 - Math.abs(value ?? 0) * 48}%`,
                }}
              />
            </span>
            <strong>{value == null ? '—' : signed(value, 2)}</strong>
          </div>
        )
      })}
    </div>
  )
}

export default function BudgetLab() {
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [alignment, setAlignment] = useState<AlignmentRow[]>([])
  const [speechRows, setSpeechRows] = useState<SpeechRow[]>([])
  const [coverage, setCoverage] = useState<BudgetCoverage | null>(null)
  const [session, setSession] = useState('2025/26')
  const [party, setParty] = useState('ALL')
  const [area, setArea] = useState(9)
  const [error, setError] = useState(false)
  const [language, setLanguage] = useState<Language | null>(null)
  const [corpus, setCorpus] = useState('leaders')
  const [method, setMethod] = useState('exact')

  useEffect(() => {
    fetch('/data/gold/marts/budget-report.json')
      .then((response) => {
        if (!response.ok) throw new Error('Budget report unavailable')
        return response.json()
      })
      .then((report) => {
        setLanguage(report.language)
        setBudgets(report.budgets)
        setAlignment(report.alignment)
        setCoverage(report.coverage)
        setSpeechRows(report.speech_rows)
      })
      .catch(() => setError(true))
  }, [])

  const sessions = useMemo(
    () =>
      [...new Set(alignment.map((row) => row.session))]
        .filter((value) =>
          budgets
            .filter((row) => row.session === value)
            .every(
              (row) =>
                budgets.filter(
                  (item) => item.session === value && item.actor === row.actor,
                ).length === 27,
            ),
        )
        .sort(),
    [alignment, budgets],
  )
  const activeSpeechRows =
    language?.rows.filter((r) => r.corpus === corpus && r.method === method) ??
    speechRows
  const comparableAlignment = useMemo(() => {
    const speech = new Map(
      activeSpeechRows.map((r) => [
        `${r.session}|${r.party}|${r.expenditure_area}`,
        r,
      ]),
    )
    const rows = alignment
      .filter((row) => sessions.includes(row.session))
      .flatMap((row) => {
        const hit = speech.get(
          `${row.session}|${row.party}|${row.expenditure_area}`,
        )
        if (!hit || hit.keyword_share_pct == null) return []
        return [
          {
            ...row,
            speech_keyword_occurrences: hit.occurrences,
            speech_attention_pct: hit.keyword_share_pct,
            attention_minus_budget_pp:
              hit.keyword_share_pct - row.budget_share_pct,
            alignment_correlation: null as number | null,
          },
        ]
      })
    const groups = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = `${row.session}|${row.party}`
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    for (const group of groups.values()) {
      if (group.length !== 27) continue
      const x = group.reduce((n, r) => n + r.budget_share_pct, 0) / group.length
      const y =
        group.reduce((n, r) => n + r.speech_attention_pct, 0) / group.length
      const denom = Math.sqrt(
        group.reduce((n, r) => n + (r.budget_share_pct - x) ** 2, 0) *
          group.reduce((n, r) => n + (r.speech_attention_pct - y) ** 2, 0),
      )
      const corr = denom
        ? group.reduce(
            (n, r) =>
              n + (r.budget_share_pct - x) * (r.speech_attention_pct - y),
            0,
          ) / denom
        : null
      for (const row of group) row.alignment_correlation = corr
    }
    return rows
  }, [alignment, sessions, activeSpeechRows])
  const sessionBudgets = budgets.filter((row) => row.session === session)
  const availableParties = [
    ...new Set(
      comparableAlignment
        .filter((row) => row.session === session)
        .map((row) => row.party),
    ),
  ].sort()
  const activeParty =
    party === 'ALL' || availableParties.includes(party) ? party : 'ALL'
  const allParties = activeParty === 'ALL'
  const sessionAlignment = comparableAlignment.filter(
    (row) => row.session === session,
  )
  const selectedRows = allParties
    ? sessionAlignment
    : sessionAlignment.filter((row) => row.party === activeParty)
  const selectedRow = allParties
    ? undefined
    : selectedRows.find((row) => row.expenditure_area === area)
  const selectedBudget = allParties
    ? undefined
    : sessionBudgets.find(
        (row) => row.actor === activeParty && row.expenditure_area === area,
      )
  const correlation = selectedRows[0]?.alignment_correlation
  const keywordHits = selectedRows.reduce(
    (sum, row) => sum + row.speech_keyword_occurrences,
    0,
  )
  const illustrationParty = allParties && availableParties.includes('S') ? 'S' : allParties ? availableParties[0] : activeParty
  const illustration = sessionAlignment.find(row => row.party === illustrationParty && row.expenditure_area === area)
  const illustrationHits = sessionAlignment.filter(row => row.party === illustrationParty).reduce((sum, row) => sum + row.speech_keyword_occurrences, 0)
  const areaOptions = [
    ...new Set(comparableAlignment.map((row) => row.expenditure_area)),
  ].sort((a, b) => a - b)
  const chooseRow = (row: AlignmentRow) => {
    setArea(row.expenditure_area)
    if (allParties) setParty(row.party)
  }

  if (error)
    return (
      <p id="budget-comparison" className="budget-empty">
        The budget exports could not be loaded.
      </p>
    )
  if (!alignment.length || !coverage || !speechRows.length || !language)
    return (
      <p id="budget-comparison" className="budget-empty">
        Loading the budget comparison…
      </p>
    )
  return (
    <section
      className="budget-lab"
      id="budget-comparison"
      aria-labelledby="budget-lab-title"
    >
      <div className="budget-lab-head">
        <div>
          <p className="eyebrow">Budgets / proposals and annual accounts</p>
          <h3 id="budget-lab-title">
            What do the budget proposals contain?
          </h3>
          <p>
            Start with the proposed amounts for any imported year. The optional language comparison uses only sessions with complete budget frames and detectable speech keywords.
          </p>
          <a className="budget-jump" href="#budget-outturn">See approved budget versus actual spending ↓</a>
        </div>
      </div>
      <BudgetLedger rows={budgets} nameOf={nameOf} />
      <details className="budget-secondary"><summary>Compare the separate party proposals at a glance</summary>
      <BudgetOverview
        rows={sessionBudgets}
        nameOf={nameOf}
        select={(p, a) => {
          setParty(p)
          setArea(a)
        }}
      />
      </details>
      <details className="budget-secondary"><summary>Explore speech keywords beside budget shares</summary>
        <p>Select a session and party to compare complete proposals with detected topic words. These controls apply only to the language charts below.</p>
        <div className="budget-controls">
          <label>
            Session
            <select
              value={session}
              onChange={(event) => setSession(event.target.value)}
            >
              {sessions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Party
            <select
              value={activeParty}
              onChange={(event) => setParty(event.target.value)}
            >
              <option value="ALL">All available parties</option>
              {availableParties.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

      <div className="budget-summary">
        <div>
          <strong>{number(sessionBudgets.length)}</strong>
          <span>budget rows in session</span>
        </div>
        <div>
          <strong>
            {allParties ? availableParties.length : number(keywordHits)}
          </strong>
          <span>
            {allParties
              ? 'parties with comparable data'
              : `matched keyword occurrences for ${activeParty}`}
          </span>
        </div>
        <div>
          <strong>
            {allParties
              ? number(keywordHits)
              : correlation == null
                ? '—'
                : correlation.toFixed(2)}
          </strong>
          <span>
            {allParties
              ? 'matched keyword occurrences across parties'
              : `share correlation across ${selectedRows.length} areas`}
          </span>
        </div>
      </div>
      <div
        className="budget-party-status"
        aria-label={`Budget coverage for all eight parties in ${session}`}
      >
        <strong>All eight parties · {session}</strong>
        <div>
          {allPartyCodes.map((code) => {
            const count = sessionBudgets.filter(
              (row) => row.actor === code,
            ).length
            return (
              <span
                key={code}
                className={count === 27 ? 'available' : 'unavailable'}
              >
                <b>{code}</b> {count === 27 ? 'budget + debate' : 'debate only'}
              </span>
            )
          })}
        </div>
        <p>
          The FiU1 source reports one collective government proposal and
          separate budget motions for some parties. Debate data exists for all
          eight; a missing party frame cannot be inferred from GOV.
        </p>
      </div>

        <p className="evidence-note">These two percentages have different denominators. Budget share is a fraction of a party's proposed expenditure; keyword share is a fraction of matched words across 27 topic dictionaries. A difference between them is a descriptive comparison, not an amount of money, a position on an issue, or a measure of honesty. The debates span the whole session, including speeches after the budget proposal.</p>
        {illustration && <div className="comparison-walkthrough"><strong>A concrete example: {illustrationParty} · {nameOf(area)} · {session}</strong><p>The proposal assigns {percent(illustration.budget_share_pct)} of {illustrationParty}'s total proposed expenditure to this area ({number(illustration.amount_msek)} million SEK). In the selected {corpus === 'leaders' ? 'party-leader' : 'issue'} debates, {illustration.speech_keyword_occurrences} of {number(illustrationHits)} detected area-word matches fall into this dictionary ({percent(illustration.speech_attention_pct)}). Those percentages use different totals. A match does not tell us whether the speaker supported, criticised or merely mentioned the issue.</p><a href={illustration.source_url} target="_blank" rel="noreferrer">Read the budget source ↗</a></div>}
      <BudgetLanguage
        data={language}
        session={session}
        corpus={corpus}
        method={method}
        area={area}
        setCorpus={setCorpus}
        setMethod={setMethod}
      />
      <PartyAreaComparison
        speechRows={activeSpeechRows}
        budgetRows={sessionAlignment}
        session={session}
        area={area}
      />
      <div className="budget-panels">
        <section className="budget-panel scatter-panel">
          <div className="panel-heading">
            <span>01 / Budget versus debate</span>
            <h4>Where do money and words meet?</h4>
            <p>
              Each dot is one {allParties ? 'party and ' : ''}expenditure area.
              Above the diagonal: more keyword attention than budget share.{' '}
              {allParties ? 'Select a dot to focus on that party.' : ''}
            </p>
          </div>
          {allParties && (
            <div className="party-legend">
              {availableParties.map((value) => (
                <span key={value}>
                  <i style={{ background: partyColors[value] }} />
                  {value}
                </span>
              ))}
            </div>
          )}
          <ScatterChart
            rows={selectedRows}
            selected={area}
            allParties={allParties}
            onSelect={chooseRow}
          />
          {!allParties && (
            <div className="budget-selection" aria-live="polite">
              <strong>{nameOf(area)}</strong>
              <span>
                Budget{' '}
                {selectedRow ? percent(selectedRow.budget_share_pct) : '—'}
              </span>
              <span>
                Keywords{' '}
                {selectedRow ? percent(selectedRow.speech_attention_pct) : '—'}
              </span>
              <span>
                {selectedRow
                  ? number(selectedRow.speech_keyword_occurrences)
                  : '—'}{' '}
                matches
              </span>
            </div>
          )}
        </section>
        <section className="budget-panel difference-panel">
          <div className="panel-heading">
            <span>02 / Difference in shares</span>
            <h4>Most above and below budget share</h4>
            <p>
              Keyword share minus budget share, in percentage points. Select a
              row to inspect that party and area.
            </p>
          </div>
          <DifferenceBars
            rows={selectedRows}
            allParties={allParties}
            onSelect={chooseRow}
          />
        </section>
        <section className="budget-panel heatmap-panel">
          <div className="panel-heading">
            <span>03 / Money versus government</span>
            <h4>Where do party proposals differ?</h4>
            <p>
              Largest 12 deviations among the 27 expenditure areas. Figures are
              million SEK above or below the government's proposal.
            </p>
          </div>
          <div className="heatmap-legend">
            <span>− less</span>
            <i />
            <span>+ more</span>
          </div>
          <BudgetHeatmap
            rows={sessionBudgets}
            selectedArea={area}
            onSelect={setArea}
          />
          <p className="budget-small">
            GOV denotes the collective government proposal. Only parties with a
            machine-readable budget motion in this session appear.
          </p>
        </section>
        <section className="budget-panel trend-panel">
          <div className="panel-heading">
            <span>04 / Available years</span>
            <h4>Does the gap move over time?</h4>
            <p>
              Follow budget share and matched debate keyword share for{' '}
              {allParties ? 'each available party' : 'one party'} and area.
              Missing years are not estimated.
            </p>
          </div>
          <div className="trend-controls">
            <label>
              Expenditure area
              <select
                value={area}
                onChange={(event) => setArea(Number(event.target.value))}
              >
                {areaOptions.map((value) => (
                  <option value={value} key={value}>
                    {nameOf(value)}
                  </option>
                ))}
              </select>
            </label>
            <div className="trend-key">
              <span>
                <i />
                Budget share
              </span>
              <span>
                <i />
                Keyword share
              </span>
            </div>
          </div>
          {allParties ? (
            <div className="party-small-multiples">
              {availableParties.map((value) => (
                <div className="party-mini" key={value}>
                  <strong style={{ color: partyColors[value] }}>{value}</strong>
                  <TrendChart
                    rows={comparableAlignment}
                    party={value}
                    area={area}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              <TrendChart
                rows={comparableAlignment}
                party={activeParty}
                area={area}
              />
              <div className="budget-selection">
                <strong>
                  {activeParty} · {nameOf(area)}
                </strong>
                <span>
                  Current proposal{' '}
                  {selectedBudget
                    ? `${number(selectedBudget.amount_msek)} m SEK`
                    : '—'}
                </span>
                <span>
                  Versus government{' '}
                  {selectedBudget
                    ? `${selectedBudget.deviation_msek > 0 ? '+' : ''}${number(selectedBudget.deviation_msek)} m SEK`
                    : '—'}
                </span>
              </div>
            </>
          )}
        </section>
        <section className="budget-panel correlation-panel">
          <div className="panel-heading">
            <span>05 / All available sessions</span>
            <h4>How does the overall relationship change?</h4>
            <p>
              Correlation across expenditure areas{' '}
              {allParties
                ? 'for each party with comparable data'
                : `for ${activeParty}`}
              . Values near zero indicate a weak linear relationship; this is a
              compact indicator, not a score of policy consistency.
            </p>
          </div>
          {allParties ? (
            <div className="party-correlation-grid">
              {availableParties.map((value) => (
                <div key={value}>
                  <strong style={{ color: partyColors[value] }}>{value}</strong>
                  <CorrelationTimeline
                    rows={comparableAlignment}
                    party={value}
                  />
                </div>
              ))}
            </div>
          ) : (
            <CorrelationTimeline
              rows={comparableAlignment}
              party={activeParty}
            />
          )}
        </section>
      </div>
      <CoverageMatrix rows={budgets} coverage={coverage} session={session} />
      </details>
      <details className="budget-method">
        <summary>Sources, definitions & important limits</summary>
        <div>
          <p>
            Budget frames come from the Swedish Parliament's FiU1 comparisons.
            Each party amount is the government proposal plus that party's
            reported deviation, in million SEK. Tables are selected for the
            exact budget year, excluding later forecast years. Budget share
            divides an area by the party's total proposal for that session.
          </p>
          <p>
            Debate attention is the area's share of occurrences of the selected
            exact-word or Swedish-stem lexicon across the 27 mapped areas for
            that party and session in the selected archive. Only speeches of at
            least 20 words are included; reply speeches are included and
            duplicates removed within each archive. It is not a semantic reading
            of all speech, a measure of policy support, or evidence of budget
            intent. Correlation summarises the two shares across areas, but is
            not a score of consistency.
          </p>
          <p>
            Six imported sessions have complete 27-area budget frames for every
            actor listed in their FiU1 table. The incomplete 2017/18 and 2018/19
            imports are excluded from share-based charts. The heatmap shows the
            largest 12 deviations for readability. A combined semantic map of
            speeches and budget text, or a separate budget UMAP, would require
            new embeddings and modelling; no points are invented here.
          </p>
          <a
            href="https://github.com/korv9/partiledardebatt-analys"
            target="_blank"
            rel="noreferrer"
          >
            Explore methods and source code ↗
          </a>
          {selectedRow && (
            <a href={selectedRow.source_url} target="_blank" rel="noreferrer">
              Open the selected budget source ↗
            </a>
          )}
        </div>
      </details>
    </section>
  )
}
