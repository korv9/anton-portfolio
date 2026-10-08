/**
 * The whole job market since 2020: every ad in Arbetsförmedlingen's historical archives,
 * counted by month, occupation field, occupation group (SSYK 4) and county
 * (platform/ingest/jobtech/ingest_market.py, dbt tag:market, export_market.py).
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import TopicNav from '../TopicNav'
import { l } from '../i18n'
import MultiLineChart, {
  MAX_SERIES,
  SERIES_COLORS,
  type Series,
} from '../charts/MultiLineChart'
import { fetchJson } from '../welfare/data'
import '../welfare/welfare.css'
import '../parliament/parliament.css'
import './jobs.css'

type YearValues = Record<string, number>
type Conditions = {
  employment: Record<string, number>
  hours: Record<string, number>
  experience: Record<string, number>
}
export type Market = {
  generated_at: string
  years: number[]
  latest_year: number
  ytd_months: number
  last_month: string
  fields: { id: string; name: string; groups: number }[]
  monthly: Record<string, [string, number, number][]>
  occupations: {
    id: string
    ssyk: string | null
    name: string
    field: string
    ads: YearValues
    ytd: YearValues
  }[]
  regions: {
    region: string
    ads: Record<string, YearValues>
    ytd: Record<string, YearValues>
  }[]
  conditions: Record<string, Record<string, Conditions>>
  archives: {
    archive: string
    source_url: string
    sha256: string
    ads: number
  }[]
  /** New ads per publication day and field ('all' for every field), from JobTech's daily
   * stream: only the days it has read whole. Preliminary until the quarter's archive. */
  daily?: Record<string, [string, number, number][]>
  /** Months counted from the daily stream rather than an archive. */
  preliminary?: string[]
  method: string
}

/** English names for the occupation fields (Arbetsförmedlingen's taxonomy). */
export const FIELD_EN: Record<string, string> = {
  'Administration, ekonomi, juridik': 'Administration, finance, law',
  'Bygg och anläggning': 'Construction',
  'Chefer och verksamhetsledare': 'Managers',
  'Data/IT': 'Data/IT',
  'Försäljning, inköp, marknadsföring': 'Sales, purchasing, marketing',
  Hantverk: 'Crafts',
  'Hotell, restaurang, storhushåll': 'Hotels, restaurants, catering',
  'Hälso- och sjukvård': 'Health care',
  'Industriell tillverkning': 'Manufacturing',
  'Installation, drift, underhåll': 'Installation, operation, maintenance',
  'Kropps- och skönhetsvård': 'Beauty and body care',
  'Kultur, media, design': 'Culture, media, design',
  'Militära yrken': 'Military',
  Naturbruk: 'Agriculture, forestry, fishing',
  Naturvetenskap: 'Natural sciences',
  Pedagogik: 'Education',
  'Sanering och renhållning': 'Cleaning and sanitation',
  'Säkerhet och bevakning': 'Security',
  'Transport, distribution, lager': 'Transport, distribution, warehousing',
  'Yrken med social inriktning': 'Social work',
  'Yrken med teknisk inriktning': 'Engineering and technical work',
}
const fieldName = (name: string) => l(FIELD_EN[name] ?? name, name)

export const EMPLOYMENT_EN: Record<string, string> = {
  'Vanlig anställning': 'Regular employment',
  Behovsanställning: 'On-call employment',
  'Sommarjobb / feriejobb': 'Summer job',
  'Arbete utomlands': 'Work abroad',
  Okänd: 'Not stated',
}
export const HOURS_EN: Record<string, string> = {
  Heltid: 'Full time',
  Deltid: 'Part time',
  Okänd: 'Not stated',
}

const number = (value: number) =>
  Math.round(value).toLocaleString(l('en-GB', 'sv-SE'))
const change = (now: number, before: number | undefined) =>
  before ? ((now - before) / before) * 100 : null
const signedPct = (value: number | null) =>
  value == null
    ? '–'
    : `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(
        value,
      ).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 0 })} %`
const MONTHS_SV = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
]
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return l(`${MONTHS_EN[m - 1]} ${y}`, `${MONTHS_SV[m - 1]} ${y}`)
}
/** 'January–June' for the months the latest year covers. */
const ytdLabel = (months: number) =>
  months >= 12
    ? l('the whole year', 'hela året')
    : l(`January–${MONTHS_EN[months - 1]}`, `januari–${MONTHS_SV[months - 1]}`)

export default function JobMarketPage({ view }: { view: string }) {
  const [data, setData] = useState<Market | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<Market>('jobs/market.json')
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  return (
    <div className="project-page welfare-page job-market-page">
      <div className="page-lead">
        <p className="eyebrow">
          {l('Swedish job market', 'Svensk arbetsmarknad')}
        </p>
        <h1>{l('The Swedish job market.', 'Den svenska arbetsmarknaden.')}</h1>
        <p>
          {l(
            'Every job ad on Arbetsförmedlingen since 2020, by occupation, county and conditions: what employers are looking for, and how it has changed. The IT report looks closer at software and data roles.',
            'Varje jobbannons hos Arbetsförmedlingen sedan 2020, efter yrke, län och villkor: vad arbetsgivarna söker, och hur det har förändrats. IT-rapporten går närmare in på mjukvaru- och dataroller.',
          )}
        </p>
        <TopicNav
          active={view}
          items={[
            ['#job-market', 'Overview', 'Översikt'],
            ['#job-market-occupations', 'Occupations', 'Yrken'],
            ['#job-market-regions', 'Counties', 'Län'],
            ['#job-market-conditions', 'Conditions', 'Villkor'],
            ['#job-market-tech', 'IT report', 'IT-rapport'],
            ['#jobb-kluster', 'Semantic clusters', 'Semantiska kluster'],
          ]}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}
      {data && view === '#job-market' && <Overview data={data} />}
      {data && view === '#job-market-occupations' && (
        <Occupations data={data} />
      )}
      {data && view === '#job-market-regions' && <Regions data={data} />}
      {data && view === '#job-market-conditions' && (
        <ConditionsView data={data} />
      )}
      {data && (
        <section
          className="report welfare-section"
          aria-label={l('Method', 'Metod')}
        >
          <details className="method">
            <summary>{l('Source and method', 'Källa och metod')}</summary>
            <p>
              {l(
                data.method,
                'Varje annons i Arbetsförmedlingens historiska arkiv (JobTech) från 2020, räknad efter publiceringsmånad, yrkesgrupp (SSYK 4) och yrkesområde, och arbetsplatsens län. Varje arkiv räknas bara för sitt eget år eller kvartal. En annons är inte en anställning; en annons utan antal tjänster räknas som en. Det senaste året är ofullständigt, så förändringar jämför samma månader.',
              )}
            </p>
            <ul>
              {data.archives.map((a) => (
                <li key={a.archive}>
                  <a href={a.source_url}>{a.archive}</a>: {number(a.ads)}{' '}
                  {l('ads', 'annonser')}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  )
}

/** Sum of the whole-market months in a year, in full or up to the latest year's months. */
function yearTotal(data: Market, field: string, year: number, ytd = false) {
  return (data.monthly[field] ?? [])
    .filter(
      ([m]) =>
        Number(m.slice(0, 4)) === year &&
        (!ytd || Number(m.slice(5, 7)) <= data.ytd_months),
    )
    .reduce((sum, [, ads]) => sum + ads, 0)
}

function Overview({ data }: { data: Market }) {
  const latest = data.latest_year
  const fullYears = data.years.filter(
    (y) => y < latest || data.ytd_months === 12,
  )
  const lastFull = fullYears.at(-1)!
  const ytdNow = yearTotal(data, 'all', latest, true)
  const ytdBefore = yearTotal(data, 'all', latest - 1, true)
  const ytdChange = change(ytdNow, ytdBefore)
  const peak = data.years
    .filter((y) => fullYears.includes(y))
    .map((y) => [y, yearTotal(data, 'all', y)] as const)
    .sort((a, b) => b[1] - a[1])[0]

  const ranking = useMemo(
    () =>
      data.fields
        .map((f) => ({
          ...f,
          full: yearTotal(data, f.id, lastFull),
          now: yearTotal(data, f.id, latest, true),
          before: yearTotal(data, f.id, latest - 1, true),
          first: yearTotal(data, f.id, data.years[0]),
        }))
        .map((f) => ({ ...f, change: change(f.now, f.before) }))
        .sort((a, b) => b.full - a.full),
    [data, lastFull, latest],
  )
  // Growth only among fields large enough for a change to mean something.
  const rising = [...ranking]
    .filter((f) => f.change != null && f.before >= 5000)
    .sort((a, b) => b.change! - a.change!)
  const [picked, setPicked] = useState<string[]>(['all'])
  const [metric, setMetric] = useState('ads')
  const [slots, setSlots] = useState<Record<string, number>>({ all: 0 })
  const toggleField = (id: string) => {
    if (!picked.includes(id)) {
      const used = picked.map((key) => slots[key])
      setSlots((current) => ({
        ...current,
        [id]: SERIES_COLORS.findIndex((_, index) => !used.includes(index)),
      }))
    }
    toggle(id)
  }
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id)
        ? current.length > 1
          ? current.filter((p) => p !== id)
          : current
        : current.length < MAX_SERIES
          ? [...current, id]
          : current,
    )
  const baselineMonth = (data.monthly[picked[0]] ?? []).find(
    ([month, ads]) =>
      ads > 0 &&
      picked.every((id) =>
        (data.monthly[id] ?? []).some(([m, value]) => m === month && value > 0),
      ),
  )?.[0]
  const series: Series[] = picked.map((id) => ({
    key: id,
    name:
      id === 'all'
        ? l('All occupations', 'Alla yrken')
        : fieldName(data.fields.find((f) => f.id === id)!.name),
    points: (data.monthly[id] ?? [])
      .filter(
        ([m]) =>
          metric !== 'index' || (baselineMonth != null && m >= baselineMonth),
      )
      .map(([m, ads]) => ({
        date: `${m}-01`,
        label: monthLabel(m),
        value:
          metric === 'index'
            ? (ads /
                (data.monthly[id].find(([m]) => m === baselineMonth)?.[1] ??
                  1)) *
              100
            : ads,
      })),
  }))
  const maxFull = Math.max(...ranking.map((f) => f.full))

  return (
    <>
      <section
        className="report welfare-section"
        aria-label={l('In short', 'I korthet')}
      >
        <p className="eyebrow">{l('In short', 'I korthet')}</p>
        <dl className="market-kpis">
          <div>
            <dt>
              {l('Ads', 'Annonser')}, {lastFull}
            </dt>
            <dd>{number(yearTotal(data, 'all', lastFull))}</dd>
            <small>{l('Latest complete year', 'Senaste hela året')}</small>
          </div>
          <div>
            <dt>
              {l('Change', 'Förändring')}, {latest}
            </dt>
            <dd>{signedPct(ytdChange)}</dd>
            <small>
              {ytdLabel(data.ytd_months)},{' '}
              {l(
                'vs the same months last year',
                'mot samma månader året innan',
              )}
            </small>
          </div>
          <div>
            <dt>{l('Coverage through', 'Data till och med')}</dt>
            <dd className="market-date">{monthLabel(data.last_month)}</dd>
            <small>
              {l(
                'Source: Arbetsförmedlingen / JobTech',
                'Källa: Arbetsförmedlingen / JobTech',
              )}
            </small>
          </div>
        </dl>
        <details className="market-summary-details">
          <summary>
            {l(
              'Read the market summary',
              'Läs sammanfattningen av marknadsläget',
            )}
          </summary>
          <ul className="plain-summary" data-testid="market-summary">
            <li>
              {l(
                `${number(yearTotal(data, 'all', lastFull))} job ads were published in ${lastFull}; the most since 2020 was ${number(peak[1])} in ${peak[0]}.`,
                `${number(yearTotal(data, 'all', lastFull))} jobbannonser publicerades ${lastFull}; flest sedan 2020 var det ${peak[0]} med ${number(peak[1])}.`,
              )}
            </li>
            {latest > lastFull && (
              <li>
                {l(
                  `${ytdLabel(data.ytd_months)} ${latest}: ${number(ytdNow)} ads, ${signedPct(ytdChange)} on the same months of ${latest - 1}.`,
                  `${ytdLabel(data.ytd_months)} ${latest}: ${number(ytdNow)} annonser, ${signedPct(ytdChange)} mot samma månader ${latest - 1}.`,
                )}
              </li>
            )}
            <li>
              {l(
                `Most ads are in ${fieldName(ranking[0].name)} (${number(ranking[0].full)} in ${lastFull}). Compared with the same months a year earlier, ${fieldName(rising[0].name)} grew most (${signedPct(rising[0].change)}) and ${fieldName(rising.at(-1)!.name)} fell most (${signedPct(rising.at(-1)!.change)}).`,
                `Flest annonser finns inom ${fieldName(ranking[0].name)} (${number(ranking[0].full)} år ${lastFull}). Jämfört med samma månader året innan ökade ${fieldName(rising[0].name)} mest (${signedPct(rising[0].change)}) och ${fieldName(rising.at(-1)!.name)} minskade mest (${signedPct(rising.at(-1)!.change)}).`,
              )}
            </li>
          </ul>
        </details>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="market-monthly"
      >
        <p className="eyebrow">
          {l('New ads per month', 'Nya annonser per månad')}
        </p>
        <h2 id="market-monthly">
          {l('Ads per month since 2020', 'Annonser per månad sedan 2020')}
        </h2>
        <div className="market-chart-toolbar">
          <label>
            {l('Measure', 'Mått')}
            <select
              aria-label={l('Measure', 'Mått')}
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
            >
              <option value="ads">
                {l('Number of ads', 'Antal annonser')}
              </option>
              <option value="index">
                {l(
                  'Compare development, index 100',
                  'Jämför utveckling, index 100',
                )}
              </option>
            </select>
          </label>
          <span>
            {metric === 'ads'
              ? l(
                  'Monthly volume, zero baseline',
                  'Månadsvolym, nollbaserad skala',
                )
              : `${l('Index', 'Index')}: ${baselineMonth ? monthLabel(baselineMonth) : '–'} = 100`}
          </span>
        </div>
        <details className="market-field-picker">
          <summary>
            {l('Choose occupation fields', 'Välj yrkesområden')}{' '}
            <span>{picked.length}/5</span>
          </summary>
          <div
            className="party-picker"
            role="group"
            aria-label={l('Fields', 'Områden')}
          >
            {[{ id: 'all', name: '' }, ...ranking].map((f) => (
              <button
                key={f.id}
                type="button"
                className={
                  picked.includes(f.id) ? 'party-chip on' : 'party-chip'
                }
                aria-pressed={picked.includes(f.id)}
                disabled={!picked.includes(f.id) && picked.length >= MAX_SERIES}
                onClick={() => toggleField(f.id)}
              >
                {picked.includes(f.id) && (
                  <span
                    className="legend-swatch"
                    style={{ background: SERIES_COLORS[slots[f.id]] }}
                  />
                )}
                {f.id === 'all'
                  ? l('All occupations', 'Alla yrken')
                  : fieldName(f.name)}
              </button>
            ))}
            <small>{l('Up to five at a time.', 'Högst fem åt gången.')}</small>
          </div>
        </details>
        <MultiLineChart
          series={series}
          label={
            metric === 'index'
              ? l(
                  'Job ads, indexed development',
                  'Jobbannonser, indexerad utveckling',
                )
              : l('New job ads per month', 'Nya jobbannonser per månad')
          }
          format={number}
          colorOf={(key) => slots[key]}
        />
        <p className="market-reading-note">
          {metric === 'index'
            ? l(
                '100 is the common starting month. Compare relative development, not the size of the fields. Monthly values are not seasonally adjusted.',
                '100 är den gemensamma startmånaden. Jämför relativ utveckling, inte områdenas storlek. Månadsvärdena är inte säsongsrensade.',
              )
            : l(
                'Ads measure advertised demand, not hires. Monthly peaks may reflect seasonality; compare the same month across years.',
                'Annonser mäter annonserad efterfrågan, inte anställningar. Månadstoppar kan spegla säsong; jämför samma månad mellan år.',
              )}
        </p>
        <p className="welfare-note">
          {l(
            `By the month the ad was published. Up to ${monthLabel(data.last_month)}.`,
            `Efter den månad annonsen publicerades. Till och med ${monthLabel(data.last_month)}.`,
          )}
        </p>
      </section>

      <section
        className="report welfare-section"
        aria-labelledby="market-fields"
      >
        <p className="eyebrow">{l('Occupation fields', 'Yrkesområden')}</p>
        <h2 id="market-fields">
          {l('Where the jobs are', 'Var jobben finns')}
        </h2>
        <div className="table-scroll">
          <table className="welfare-table compact" data-testid="market-fields">
            <thead>
              <tr>
                <th>{l('Field', 'Yrkesområde')}</th>
                <th>
                  {l('Ads', 'Annonser')} {lastFull}
                </th>
                <th>
                  {l('Change', 'Förändring')} {latest}
                  <small> ({ytdLabel(data.ytd_months)})</small>
                </th>
                <th>
                  {l('Change since', 'Förändring sedan')} {data.years[0]}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((f) => (
                <tr key={f.id}>
                  <td>
                    <a
                      href={`#job-market-occupations`}
                      onClick={() => rememberField(f.id)}
                    >
                      {fieldName(f.name)}
                    </a>
                  </td>
                  <td>
                    <span
                      className="cell-bar"
                      style={{ width: `${(f.full / maxFull) * 100}%` }}
                    />
                    <span className="cell-value">{number(f.full)}</span>
                  </td>
                  <td className={trendClass(f.change)}>
                    {signedPct(f.change)}
                  </td>
                  <td className={trendClass(change(f.full, f.first))}>
                    {signedPct(change(f.full, f.first))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

const trendClass = (value: number | null) =>
  value == null ? '' : value > 0 ? 'trend-up' : value < 0 ? 'trend-down' : ''

/** The field chosen on the overview, for the occupations view to open on. */
let rememberedField = ''
const rememberField = (id: string) => {
  rememberedField = id
}

function FieldSelect({
  data,
  value,
  onChange,
  all = true,
}: {
  data: Market
  value: string
  onChange: (id: string) => void
  all?: boolean
}) {
  return (
    <label>
      {l('Occupation field', 'Yrkesområde')}
      <select
        value={value}
        data-field="market-field"
        onChange={(event) => onChange(event.target.value)}
      >
        {all && <option value="all">{l('All fields', 'Alla områden')}</option>}
        {[...data.fields]
          .sort((a, b) => fieldName(a.name).localeCompare(fieldName(b.name)))
          .map((f) => (
            <option key={f.id} value={f.id}>
              {fieldName(f.name)}
            </option>
          ))}
      </select>
    </label>
  )
}

function Occupations({ data }: { data: Market }) {
  const [field, setField] = useState(rememberedField || 'all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'ads' | 'rising' | 'falling'>('ads')
  const [open, setOpen] = useState<string | null>(null)
  const latest = data.latest_year
  const shown = data.years.slice(-4)
  const rows = data.occupations
    .filter((o) => field === 'all' || o.field === field)
    .filter((o) =>
      query
        ? `${o.name} ${o.ssyk ?? ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    )
    .map((o) => ({
      ...o,
      change: change(o.ytd[latest] ?? 0, o.ytd[latest - 1]),
      volume: (o.ytd[latest] ?? 0) + (o.ytd[latest - 1] ?? 0),
    }))
  // Changes only for groups with enough ads to mean something.
  const comparable = rows.filter((o) => (o.ytd[latest - 1] ?? 0) >= 100)
  const sorted =
    sort === 'ads'
      ? [...rows].sort(
          (a, b) => (b.ads[latest - 1] ?? 0) - (a.ads[latest - 1] ?? 0),
        )
      : [...comparable].sort((a, b) =>
          sort === 'rising' ? b.change! - a.change! : a.change! - b.change!,
        )
  const [limit, setLimit] = useState(30)
  return (
    <section
      className="report welfare-section"
      aria-labelledby="market-occupations"
    >
      <p className="eyebrow">{l('Occupations', 'Yrken')}</p>
      <h2 id="market-occupations">
        {l(
          'Every occupation group, year by year',
          'Varje yrkesgrupp, år för år',
        )}
      </h2>
      <div className="slicers">
        <FieldSelect data={data} value={field} onChange={setField} />
        <label>
          {l('Search', 'Sök')}
          <input
            type="search"
            value={query}
            data-field="market-search"
            placeholder={l('e.g. nurse, 2221', 't.ex. sjuksköterska, 2221')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          {l('Sort', 'Sortera')}
          <select
            value={sort}
            data-field="market-sort"
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="ads">{l('Most ads', 'Flest annonser')}</option>
            <option value="rising">{l('Growing most', 'Ökar mest')}</option>
            <option value="falling">{l('Falling most', 'Minskar mest')}</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table
          className="welfare-table compact"
          data-testid="market-occupations"
        >
          <thead>
            <tr>
              <th>{l('Occupation group', 'Yrkesgrupp')}</th>
              {shown.map((y) => (
                <th key={y}>
                  {y}
                  {y === latest && data.ytd_months < 12 && (
                    <small> ({ytdLabel(data.ytd_months)})</small>
                  )}
                </th>
              ))}
              <th>
                {l('Change', 'Förändring')}
                <small> ({ytdLabel(data.ytd_months)})</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    type="button"
                    className="link-like"
                    aria-expanded={open === o.id}
                    onClick={() => setOpen(open === o.id ? null : o.id)}
                  >
                    {o.name}
                  </button>
                  <small className="muted">
                    {' '}
                    {o.ssyk ? `SSYK ${o.ssyk}, ` : ''}
                    {fieldName(
                      data.fields.find((f) => f.id === o.field)?.name ?? '',
                    )}
                  </small>
                  {open === o.id && <OccupationBars data={data} ads={o.ads} />}
                </td>
                {shown.map((y) => (
                  <td key={y}>{number(o.ads[y] ?? 0)}</td>
                ))}
                <td className={trendClass(o.change)}>
                  {(o.ytd[latest - 1] ?? 0) >= 100 ? signedPct(o.change) : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <button
          type="button"
          className="compact-toggle"
          onClick={() => setLimit(limit + 50)}
        >
          {l(
            `Show more (${sorted.length - limit} left)`,
            `Visa fler (${sorted.length - limit} kvar)`,
          )}
        </button>
      )}
      <p className="welfare-note">
        {l(
          `Ads per year. The change compares ${ytdLabel(data.ytd_months)} ${latest} with the same months of ${latest - 1}, for groups with at least 100 ads then. Occupation groups as Arbetsförmedlingen names them (SSYK 2012).`,
          `Annonser per år. Förändringen jämför ${ytdLabel(data.ytd_months)} ${latest} med samma månader ${latest - 1}, för grupper med minst 100 annonser då. Yrkesgrupper som Arbetsförmedlingen benämner dem (SSYK 2012).`,
        )}
      </p>
    </section>
  )
}

function OccupationBars({ data, ads }: { data: Market; ads: YearValues }) {
  const max = Math.max(...data.years.map((y) => ads[y] ?? 0), 1)
  return (
    <ol className="year-bars" aria-label={l('Ads per year', 'Annonser per år')}>
      {data.years.map((y) => (
        <li key={y}>
          <span>{y}</span>
          <span className="year-bar-track">
            <span
              className="year-bar"
              style={{ width: `${((ads[y] ?? 0) / max) * 100}%` }}
            />
          </span>
          <span>{number(ads[y] ?? 0)}</span>
        </li>
      ))}
    </ol>
  )
}

function Regions({ data }: { data: Market }) {
  const [field, setField] = useState('all')
  const latest = data.latest_year
  const lastFull = data.ytd_months === 12 ? latest : latest - 1
  const rows = data.regions
    .map((r) => {
      const ads = r.ads[field] ?? {}
      const ytd = r.ytd[field] ?? {}
      return {
        region: r.region,
        full: ads[lastFull] ?? 0,
        first: ads[data.years[0]] ?? 0,
        change: change(ytd[latest] ?? 0, ytd[latest - 1]),
      }
    })
    .sort((a, b) => b.full - a.full)
  const total = rows.reduce((sum, r) => sum + r.full, 0)
  const max = Math.max(...rows.map((r) => r.full), 1)
  return (
    <section
      className="report welfare-section"
      aria-labelledby="market-regions"
    >
      <p className="eyebrow">{l('Counties', 'Län')}</p>
      <h2 id="market-regions">
        {l('Where employers advertise', 'Var arbetsgivarna annonserar')}
      </h2>
      <div className="slicers">
        <FieldSelect data={data} value={field} onChange={setField} />
      </div>
      <div className="table-scroll">
        <table className="welfare-table compact" data-testid="market-regions">
          <thead>
            <tr>
              <th>{l('County', 'Län')}</th>
              <th>
                {l('Ads', 'Annonser')} {lastFull}
              </th>
              <th>{l('Share', 'Andel')}</th>
              <th>
                {l('Change', 'Förändring')} {latest}
                <small> ({ytdLabel(data.ytd_months)})</small>
              </th>
              <th>
                {l('Change since', 'Förändring sedan')} {data.years[0]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.region}>
                <td>
                  {r.region === 'Okänt län'
                    ? l('County not stated', 'Län ej angivet')
                    : r.region}
                </td>
                <td>
                  <span
                    className="cell-bar"
                    style={{ width: `${(r.full / max) * 100}%` }}
                  />
                  <span className="cell-value">{number(r.full)}</span>
                </td>
                <td>
                  {total
                    ? `${((100 * r.full) / total).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 1 })} %`
                    : '–'}
                </td>
                <td className={trendClass(r.change)}>{signedPct(r.change)}</td>
                <td className={trendClass(change(r.full, r.first))}>
                  {signedPct(change(r.full, r.first))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="welfare-note">
        {l(
          'The county of the workplace. Ads without one, or with the workplace left open, are shown as not stated.',
          'Arbetsplatsens län. Annonser utan län, eller med ospecificerad arbetsort, visas som ej angivet.',
        )}
      </p>
    </section>
  )
}

function ConditionsView({ data }: { data: Market }) {
  const [field, setField] = useState('all')
  const years = data.years
  const byYear = years.map((y) => data.conditions[y]?.[field])
  const share = (
    part: number | undefined,
    whole: Record<string, number> | undefined,
  ) => {
    const sum = Object.values(whole ?? {}).reduce((a, b) => a + b, 0)
    return sum ? ((part ?? 0) / sum) * 100 : null
  }
  const pct = (value: number | null) =>
    value == null
      ? '–'
      : `${value.toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 0 })} %`
  const groups: [
    string,
    string,
    keyof Conditions,
    string[],
    Record<string, string>,
  ][] = [
    [
      'Employment type',
      'Anställningsform',
      'employment',
      [
        'Vanlig anställning',
        'Behovsanställning',
        'Sommarjobb / feriejobb',
        'Arbete utomlands',
      ],
      EMPLOYMENT_EN,
    ],
    ['Working hours', 'Arbetstid', 'hours', ['Heltid', 'Deltid'], HOURS_EN],
  ]
  return (
    <section
      className="report welfare-section"
      aria-labelledby="market-conditions"
    >
      <p className="eyebrow">{l('Conditions', 'Villkor')}</p>
      <h2 id="market-conditions">
        {l(
          'What kind of jobs are advertised',
          'Vilka slags jobb som annonseras',
        )}
      </h2>
      <div className="slicers">
        <FieldSelect data={data} value={field} onChange={setField} />
      </div>
      <div className="table-scroll">
        <table
          className="welfare-table compact"
          data-testid="market-conditions"
        >
          <thead>
            <tr>
              <th>{l('Share of ads', 'Andel av annonserna')}</th>
              {years.map((y) => (
                <th key={y}>
                  {y}
                  {y === data.latest_year && data.ytd_months < 12 && (
                    <small> ({ytdLabel(data.ytd_months)})</small>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([en, sv, key, labels, names]) => (
              <Fragment key={key}>
                <tr className="group-row">
                  <th colSpan={years.length + 1}>{l(en, sv)}</th>
                </tr>
                {labels.map((label) => (
                  <tr key={`${key}-${label}`}>
                    <td>{l(names[label] ?? label, label)}</td>
                    {byYear.map((c, i) => (
                      <td key={years[i]}>
                        {pct(
                          share(
                            c?.[key][label],
                            key === 'hours'
                              ? {
                                  Heltid: c?.hours.Heltid ?? 0,
                                  Deltid: c?.hours.Deltid ?? 0,
                                }
                              : c?.[key],
                          ),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="group-row">
              <th colSpan={years.length + 1}>
                {l('Experience', 'Erfarenhet')}
              </th>
            </tr>
            <tr>
              <td>{l('Experience required', 'Kräver erfarenhet')}</td>
              {byYear.map((c, i) => (
                <td key={years[i]}>
                  {pct(
                    share(c?.experience.yes, {
                      yes: c?.experience.yes ?? 0,
                      no: c?.experience.no ?? 0,
                    }),
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="welfare-note">
        {l(
          `Shares of the ads published each year, as the employer filled in the ad. Working hours: of the ads that state them (on-call jobs usually do not, nor do part of the 2024 ads). Experience: of the ads that say whether it is required. ${data.latest_year} covers ${ytdLabel(data.ytd_months)} only, when on-call and summer jobs are advertised most.`,
          `Andelar av årets publicerade annonser, som arbetsgivaren fyllt i annonsen. Arbetstid: av de annonser som anger den (behovsanställningar gör det oftast inte, inte heller en del av annonserna 2024). Erfarenhet: av de annonser som anger om den krävs. ${data.latest_year} omfattar bara ${ytdLabel(data.ytd_months)}, då behovsanställningar och sommarjobb annonseras mest.`,
        )}
      </p>
    </section>
  )
}
