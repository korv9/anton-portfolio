import { currentLocale, l, t } from './i18n'
import { fetchData } from './dataSource'
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
export const nameOf = (area: number) => t(areaNames[area] ?? `Area ${area}`)
const percent = (value: number, digits = 1) =>
  value > 0 && value < 0.1
    ? currentLocale() === 'sv'
      ? '<0,1%'
      : '<0.1%'
    : `${value.toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
const signed = (value: number, digits = 1) =>
  `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
const number = (value: number) =>
  new Intl.NumberFormat(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB').format(
    value,
  )
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
      aria-label={l(
        `Budget share on the horizontal axis and debate keyword share on the vertical axis, one point per party and expenditure area${allParties ? ' for all available parties' : ''}`,
        `Budgetandel på den vågräta axeln och andel debattnyckelord på den lodräta, en punkt per parti och utgiftsområde${allParties ? ' för alla tillgängliga partier' : ''}`,
      )}
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
          aria-label={l(
            `${row.party}, ${nameOf(row.expenditure_area)}: ${percent(row.budget_share_pct)} of budget, ${percent(row.speech_attention_pct)} of matched debate keywords`,
            `${row.party}, ${nameOf(row.expenditure_area)}: ${percent(row.budget_share_pct)} av budgeten, ${percent(row.speech_attention_pct)} av matchade debattnyckelord`,
          )}
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
        {t('Share of party budget\n      ')}
      </text>
      <text
        transform={`translate(15 ${height / 2}) rotate(-90)`}
        textAnchor="middle"
        className="budget-axis-title"
      >
        {t('Share of matched debate keywords\n      ')}
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
          aria-label={l(
            `${row.party}, ${nameOf(row.expenditure_area)}: ${signed(row.attention_minus_budget_pp)} percentage points`,
            `${row.party}, ${nameOf(row.expenditure_area)}: ${signed(row.attention_minus_budget_pp)} procentenheter`,
          )}
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
          <strong>
            {signed(row.attention_minus_budget_pp)} {t('pp')}
          </strong>
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
      aria-label={l(
        `Budget and keyword shares for ${nameOf(area)} across all eight parties`,
        `Budgetandelar och nyckelordsandelar för ${nameOf(area)} för alla åtta partier`,
      )}
    >
      <div className="party-area-head">
        <strong>
          {nameOf(area)} {t('· all eight parties')}
        </strong>
        <span>
          <i className="budget-key" /> {t('Budget share')}{' '}
          <i className="keyword-key" /> {t('Keyword share\n        ')}
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
              aria-label={l(
                `${row.party}: budget ${row.budget ? percent(row.budget.budget_share_pct) : 'no separate frame'}, keyword share ${row.speech?.keyword_share_pct != null ? percent(row.speech.keyword_share_pct) : 'unavailable'}`,
                `${row.party}: budget ${row.budget ? percent(row.budget.budget_share_pct) : 'ingen separat ram'}, nyckelordsandel ${row.speech?.keyword_share_pct != null ? percent(row.speech.keyword_share_pct) : 'saknas'}`,
              )}
              title={l(
                `${row.speech?.occurrences ?? 0} keyword matches`,
                `${row.speech?.occurrences ?? 0} nyckelordsträffar`,
              )}
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
        {t(
          'Budget share / keyword share. A dash means no separate party budget\n        frame. Keyword shares use the selected method and archive, calculated\n        separately within each party. 0.0% means zero detected matches; — means\n        unavailable. They do not measure policy support.\n      ',
        )}
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
      <summary>
        {t('Coverage: all eight parties and missing budget data')}
      </summary>
      <p>
        {t(
          'Debate speeches are present for all eight parties in these sessions. The\n        cells below count expenditure areas in the imported FiU1 budget table;\n        27/27 is complete. A dash means there is no separate party budget frame\n        in this export, not zero spending. GOV is the collective government\n        proposal and cannot be assigned to individual parties.\n      ',
        )}
      </p>
      <div
        className="coverage-scroll"
        tabIndex={0}
        aria-label={t(
          'Budget coverage table scrolls horizontally on small screens',
        )}
      >
        <table>
          <caption>{t('Imported budget areas by session and actor')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Session')}</th>
              {allPartyCodes.map((code) => (
                <th key={code} scope="col">
                  {code}
                </th>
              ))}
              <th scope="col">{t('GOV')}</th>
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
        {t(
          '2017/18 and 2018/19 are incomplete imports and are excluded from\n        share-based charts until repaired. In 2014/15, 2015/16, 2020/21 and\n        2021/22 the importer did not find a machine-readable FiU1 comparison\n        table.\n      ',
        )}
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
      aria-label={t(
        'Budget deviation heatmap can scroll horizontally on small screens',
      )}
    >
      <div
        className="budget-heatmap"
        style={{
          gridTemplateColumns: `minmax(185px, 1.7fr) repeat(${parties.length}, minmax(72px, 1fr))`,
        }}
      >
        <div className="heatmap-heading">{t('Expenditure area')}</div>
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
                  aria-label={l(
                    `${party}, ${nameOf(item.area)}: no comparable figure`,
                    `${party}, ${nameOf(item.area)}: ingen jämförbar siffra`,
                  )}
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
                aria-label={l(
                  `${party}, ${nameOf(item.area)}: ${value > 0 ? '+' : ''}${number(value)} million SEK versus government proposal`,
                  `${party}, ${nameOf(item.area)}: ${value > 0 ? '+' : ''}${number(value)} miljoner kronor jämfört med regeringens förslag`,
                )}
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
        {t('Fewer than two comparable years for this choice.\n      ')}
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
      aria-label={l(
        `Budget share and matched debate keyword share for ${party} in ${nameOf(area)} across available budget years`,
        `Budgetandel och andel matchade debattnyckelord för ${party} inom ${nameOf(area)} över tillgängliga budgetår`,
      )}
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
      aria-label={l(
        `Correlation between budget share and keyword share by available session for ${party}`,
        `Korrelation mellan budgetandel och nyckelordsandel per tillgängligt riksmöte för ${party}`,
      )}
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
  const [party, setParty] = useState('S')
  const [chart, setChart] = useState('heatmap')
  const [area, setArea] = useState(9)
  const [error, setError] = useState(false)
  const [language, setLanguage] = useState<Language | null>(null)
  const [corpus, setCorpus] = useState('leaders')
  const [method, setMethod] = useState('exact')

  useEffect(() => {
    fetchData('gold/marts/budget-report.json')
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
  const illustrationParty =
    allParties && availableParties.includes('S')
      ? 'S'
      : allParties
        ? availableParties[0]
        : activeParty
  const illustration = sessionAlignment.find(
    (row) => row.party === illustrationParty && row.expenditure_area === area,
  )
  const illustrationHits = sessionAlignment
    .filter((row) => row.party === illustrationParty)
    .reduce((sum, row) => sum + row.speech_keyword_occurrences, 0)
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
        {t('The budget exports could not be loaded.\n      ')}
      </p>
    )
  if (!alignment.length || !coverage || !speechRows.length || !language)
    return (
      <p id="budget-comparison" className="budget-empty">
        {t('Loading the budget comparison…\n      ')}
      </p>
    )
  return (
    <section
      className="budget-lab compact-budget"
      id="budget-comparison"
      aria-labelledby="budget-lab-title"
    >
      <div className="budget-lab-head">
        <div>
          <p className="eyebrow">
            {l('Budget / three perspectives', 'Budget / tre perspektiv')}
          </p>
          <h3 id="budget-lab-title">
            {l(
              'Compare proposals, priorities and outcomes',
              'Jämför förslag, prioriteringar och utfall',
            )}
          </h3>
          <p>
            {l(
              'Three large charts. Choose the year, party and view; open the tables for every figure.',
              'Tre stora grafer. Välj år, parti och vy; öppna tabellerna för alla siffror.',
            )}
          </p>
          <nav
            className="budget-view-nav"
            aria-label={l('Budget charts', 'Budgetgrafer')}
          >
            <a href="#budget-proposals">{l('01 Proposals', '01 Förslag')}</a>
            <a href="#budget-explore">{l('02 Compare', '02 Jämför')}</a>
            <a href="#budget-outturn">{l('03 Outcomes', '03 Utfall')}</a>
          </nav>
        </div>
      </div>
      <div id="budget-proposals" data-testid="budget-chart-proposals">
        <BudgetLedger rows={budgets} nameOf={nameOf} />
      </div>
      <section
        id="budget-explore"
        className="budget-explore"
        data-testid="budget-chart-explore"
      >
        <p className="eyebrow">
          {l('02 / Explore the comparison', '02 / Fördjupa jämförelsen')}
        </p>
        <h4>{l('What do you want to compare?', 'Vad vill du jämföra?')}</h4>
        <div className="budget-controls">
          <label>
            {l('Chart', 'Graf')}
            <select
              aria-label={l('Chart', 'Graf')}
              value={chart}
              onChange={(e) => {
                setChart(e.target.value)
                if (
                  party === 'ALL' &&
                  ['trend', 'correlation'].includes(e.target.value)
                )
                  setParty(illustrationParty)
              }}
            >
              <option value="heatmap">
                {l('Parties vs government', 'Partier mot regeringen')}
              </option>
              <option value="scatter">
                {l('Budget share vs debate', 'Budgetandel mot debatt')}
              </option>
              <option value="difference">
                {l('Difference in shares', 'Skillnad mellan andelar')}
              </option>
              <option value="trend">
                {l('Shares over time', 'Andelar över tid')}
              </option>
              <option value="correlation">
                {l('Correlation over time', 'Korrelation över tid')}
              </option>
              <option value="parties">
                {l('All parties in one area', 'Alla partier inom ett område')}
              </option>
            </select>
          </label>
          <label>
            {l('Session', 'Riksmöte')}
            <select
              aria-label={l('Session', 'Riksmöte')}
              value={session}
              onChange={(e) => setSession(e.target.value)}
            >
              {sessions.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {l('Party', 'Parti')}
            <select
              aria-label={l('Party', 'Parti')}
              value={
                ['heatmap', 'parties'].includes(chart) ? 'ALL' : activeParty
              }
              disabled={['heatmap', 'parties'].includes(chart)}
              onChange={(e) => setParty(e.target.value)}
            >
              {!['trend', 'correlation'].includes(chart) && (
                <option value="ALL">
                  {l('All available parties', 'Alla tillgängliga partier')}
                </option>
              )}
              {availableParties.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {l('Expenditure area', 'Utgiftsområde')}
            <select
              aria-label={l('Expenditure area', 'Utgiftsområde')}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
            >
              {areaOptions.map((value) => (
                <option key={value} value={value}>
                  {nameOf(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="budget-small">
          {chart === 'heatmap'
            ? l(
                'Amounts above or below the government proposal in the same year, in million SEK. Missing proposals are not zero.',
                'Belopp över eller under regeringens förslag samma år, i miljoner kronor. Saknade förslag är inte noll.',
              )
            : l(
                'Budget and keyword shares have different denominators. This describes attention, not support or causation.',
                'Budgetandel och nyckelordsandel har olika nämnare. Jämförelsen beskriver uppmärksamhet, inte stöd eller orsakssamband.',
              )}
        </p>
        <div className="budget-panels single-budget-chart">
          {chart === 'scatter' && (
            <section className="budget-panel scatter-panel">
              <div className="panel-heading">
                <span>{t('01 / Budget versus debate')}</span>
                <h4>{t('Where do money and words meet?')}</h4>
                <p>
                  {t('Each dot is one ')}
                  {allParties ? 'party and ' : ''}
                  {t(
                    'expenditure area.\n              Above the diagonal: more keyword attention than budget share.',
                  )}{' '}
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
                    {t('Budget')}{' '}
                    {selectedRow ? percent(selectedRow.budget_share_pct) : '—'}
                  </span>
                  <span>
                    {t('Keywords')}{' '}
                    {selectedRow
                      ? percent(selectedRow.speech_attention_pct)
                      : '—'}
                  </span>
                  <span>
                    {selectedRow
                      ? number(selectedRow.speech_keyword_occurrences)
                      : '—'}{' '}
                    {t('matches\n              ')}
                  </span>
                </div>
              )}
            </section>
          )}
          {chart === 'difference' && (
            <section className="budget-panel difference-panel">
              <div className="panel-heading">
                <span>{t('02 / Difference in shares')}</span>
                <h4>{t('Most above and below budget share')}</h4>
                <p>
                  {t(
                    'Keyword share minus budget share, in percentage points. Select a\n              row to inspect that party and area.\n            ',
                  )}
                </p>
              </div>
              <DifferenceBars
                rows={selectedRows}
                allParties={allParties}
                onSelect={chooseRow}
              />
            </section>
          )}
          {chart === 'heatmap' && (
            <section className="budget-panel heatmap-panel">
              <div className="panel-heading">
                <span>{t('03 / Money versus government')}</span>
                <h4>{t('Where do party proposals differ?')}</h4>
                <p>
                  {t(
                    "Largest 12 deviations among the 27 expenditure areas. Figures are\n              million SEK above or below the government's proposal.\n            ",
                  )}
                </p>
              </div>
              <div className="heatmap-legend">
                <span>{t('− less')}</span>
                <i />
                <span>{t('+ more')}</span>
              </div>
              <BudgetHeatmap
                rows={sessionBudgets}
                selectedArea={area}
                onSelect={setArea}
              />
              <p className="budget-small">
                {t(
                  'GOV denotes the collective government proposal. Only parties with a\n            machine-readable budget motion in this session appear.\n          ',
                )}
              </p>
            </section>
          )}
          {chart === 'trend' && (
            <section className="budget-panel trend-panel">
              <div className="panel-heading">
                <span>{t('04 / Available years')}</span>
                <h4>{t('Does the gap move over time?')}</h4>
                <p>
                  {t(
                    'Follow budget share and matched debate keyword share for',
                  )}{' '}
                  {t(allParties ? 'each available party' : 'one party')}{' '}
                  {t(
                    'and area.\n              Missing years are not estimated.\n            ',
                  )}
                </p>
              </div>
              <div className="trend-controls">
                <div className="trend-key">
                  <span>
                    <i />
                    {t('Budget share\n              ')}
                  </span>
                  <span>
                    <i />
                    {t('Keyword share\n              ')}
                  </span>
                </div>
              </div>
              <>
                <TrendChart
                  rows={comparableAlignment}
                  party={illustrationParty}
                  area={area}
                />
                <div className="budget-selection">
                  <strong>
                    {illustrationParty} · {nameOf(area)}
                  </strong>
                  <span>
                    {t('Current proposal')}{' '}
                    {selectedBudget
                      ? `${number(selectedBudget.amount_msek)} m SEK`
                      : '—'}
                  </span>
                  <span>
                    {t('Versus government')}{' '}
                    {selectedBudget
                      ? `${selectedBudget.deviation_msek > 0 ? '+' : ''}${number(selectedBudget.deviation_msek)} m SEK`
                      : '—'}
                  </span>
                </div>
              </>
            </section>
          )}
          {chart === 'correlation' && (
            <section className="budget-panel correlation-panel">
              <div className="panel-heading">
                <span>{t('05 / All available sessions')}</span>
                <h4>{t('How does the overall relationship change?')}</h4>
                <p>
                  {t('Correlation across expenditure areas')}{' '}
                  {allParties
                    ? 'for each party with comparable data'
                    : `for ${activeParty}`}
                  {t(
                    '. Values near zero indicate a weak linear relationship; this is a\n              compact indicator, not a score of policy consistency.\n            ',
                  )}
                </p>
              </div>
              <CorrelationTimeline
                rows={comparableAlignment}
                party={illustrationParty}
              />
            </section>
          )}
          {chart === 'parties' && (
            <PartyAreaComparison
              speechRows={activeSpeechRows}
              budgetRows={sessionAlignment}
              session={session}
              area={area}
            />
          )}
        </div>
        <details className="budget-secondary">
          <summary>
            {l(
              'Debate selection, matching words and coverage',
              'Debatturval, matchade ord och täckning',
            )}
          </summary>
          <BudgetLanguage
            data={language}
            session={session}
            corpus={corpus}
            method={method}
            area={area}
            setCorpus={setCorpus}
            setMethod={setMethod}
          />
          <p>
            {number(keywordHits)} {l('keyword matches', 'nyckelordsträffar')} ·{' '}
            {allParties || correlation == null ? '—' : correlation.toFixed(2)}{' '}
            {l(
              'correlation for the selected party',
              'korrelation för valt parti',
            )}
          </p>
          {illustration && (
            <p>
              {illustrationParty} · {nameOf(area)}:{' '}
              {percent(illustration.budget_share_pct)}{' '}
              {l('of the budget', 'av budgeten')},{' '}
              {illustration.speech_keyword_occurrences}/
              {number(illustrationHits)}{' '}
              {l('keyword matches', 'nyckelordsträffar')} (
              {percent(illustration.speech_attention_pct)}).
            </p>
          )}
          <CoverageMatrix
            rows={budgets}
            coverage={coverage}
            session={session}
          />
        </details>
        <details className="budget-secondary">
          <summary>
            {l(
              'All party proposals and their largest changes',
              'Alla partiförslag och deras största förändringar',
            )}
          </summary>
          <BudgetOverview
            rows={sessionBudgets}
            nameOf={nameOf}
            select={(p, a) => {
              setParty(p)
              setArea(a)
              setChart('trend')
            }}
          />
          <p>
            {allPartyCodes.join(' · ')}.{' '}
            {l(
              'The government proposal is collective; separate party proposals are only shown where available.',
              'Regeringens förslag är gemensamt; separata partiförslag visas bara där de finns.',
            )}
          </p>
        </details>
      </section>
      <details className="budget-method">
        <summary>{t('Sources, definitions & important limits')}</summary>
        <div>
          <p>
            {t(
              "Budget frames come from the Swedish Parliament's FiU1 comparisons.\n            Each party amount is the government proposal plus that party's\n            reported deviation, in million SEK. Tables are selected for the\n            exact budget year, excluding later forecast years. Budget share\n            divides an area by the party's total proposal for that session.\n          ",
            )}
          </p>
          <p>
            {t(
              "Debate attention is the area's share of occurrences of the selected\n            exact-word or Swedish-stem lexicon across the 27 mapped areas for\n            that party and session in the selected archive. Only speeches of at\n            least 20 words are included; reply speeches are included and\n            duplicates removed within each archive. It is not a semantic reading\n            of all speech, a measure of policy support, or evidence of budget\n            intent. Correlation summarises the two shares across areas, but is\n            not a score of consistency.\n          ",
            )}
          </p>
          <p>
            {t(
              'Six imported sessions have complete 27-area budget frames for every\n            actor listed in their FiU1 table. The incomplete 2017/18 and 2018/19\n            imports are excluded from share-based charts. The heatmap shows the\n            largest 12 deviations for readability. A combined semantic map of\n            speeches and budget text, or a separate budget UMAP, would require\n            new embeddings and modelling; no points are invented here.\n          ',
            )}
          </p>
          <a
            href="https://github.com/korv9/partiledardebatt-analys"
            target="_blank"
            rel="noreferrer"
          >
            {t('Explore methods and source code ↗\n          ')}
          </a>
          {selectedRow && (
            <a href={selectedRow.source_url} target="_blank" rel="noreferrer">
              {t('Open the selected budget source ↗\n            ')}
            </a>
          )}
        </div>
      </details>
    </section>
  )
}
