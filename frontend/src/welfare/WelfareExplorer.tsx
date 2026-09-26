import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import MultiLineChart, {
  MAX_SERIES,
  type Series,
} from '../charts/MultiLineChart'
import {
  DOMAINS,
  formatValue,
  loadSourceRows,
  type Indicator,
  type IndicatorRow,
} from './data'

const LEVELS: Record<string, [string, string]> = {
  country: ['Sweden', 'Riket'],
  county: ['Counties', 'Län'],
  municipality: ['Municipalities', 'Kommuner'],
  nuts2: ['NUTS2 areas', 'Riksområden (NUTS2)'],
  aggregate: ['Aggregates', 'Aggregat'],
}
const PERIOD_TYPES: Record<string, [string, string]> = {
  month: ['Monthly', 'Månad'],
  quarter: ['Quarterly', 'Kvartal'],
  year: ['Annual', 'År'],
  pooled_years: ['Pooled four years', 'Fyra år sammanslagna'],
  survey_round: ['Survey round', 'Enkätomgång'],
}
const SEXES: Record<string, [string, string]> = {
  T: ['Total', 'Totalt'],
  K: ['Women', 'Kvinnor'],
  M: ['Men', 'Män'],
}
const midpoint = (start: string, end: string) =>
  new Date((Date.parse(start) + Date.parse(end)) / 2).toISOString().slice(0, 10)
const byOrder = (order: string[]) => (a: string, b: string) =>
  order.indexOf(a) - order.indexOf(b)

/**
 * Slicers over the welfare indicator table: domain, indicator, geography, sex, age band
 * and period type, read from the source's Parquet in the browser. Each choice narrows the
 * next, so no combination that has no data can be selected.
 */
export default function WelfareExplorer({
  indicators,
}: {
  indicators: Indicator[]
}) {
  const [domain, setDomain] = useState('mental_halsa')
  const [indicatorKey, setIndicatorKey] = useState('')
  const [rows, setRows] = useState<IndicatorRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [sex, setSex] = useState('T')
  const [age, setAge] = useState('')
  const [periodType, setPeriodType] = useState('')

  const inDomain = indicators.filter(
    (i) => i.domain === domain && i.observations,
  )
  const indicator =
    indicators.find((i) => i.indicator_key === indicatorKey) ?? inDomain[0]

  // Load the indicator's source; the parsed file is cached per source.
  useEffect(() => {
    if (!indicator) return
    let live = true
    setRows(null)
    setError(null)
    loadSourceRows(indicator.source_key)
      .then((all) => {
        if (live)
          setRows(
            all.filter((row) => row.indicator_key === indicator.indicator_key),
          )
      })
      .catch((reason: Error) => live && setError(reason.message))
    return () => {
      live = false
    }
  }, [indicator?.indicator_key, indicator?.source_key])

  const options = useMemo(() => {
    const data = rows ?? []
    const levels = [...new Set(data.map((r) => r.region_level))].sort(
      byOrder(Object.keys(LEVELS)),
    )
    return { levels }
  }, [rows])

  // Defaults whenever the indicator's data arrive: the broadest geography, the country.
  useEffect(() => {
    if (!rows?.length) return
    const firstLevel = options.levels.includes('country')
      ? 'country'
      : options.levels[0]
    setLevel(firstLevel)
    const inLevel = rows.filter((r) => r.region_level === firstLevel)
    setSelected(
      [...new Set(inLevel.map((r) => r.region_code))]
        .sort()
        .slice(0, firstLevel === 'country' ? 1 : 3),
    )
  }, [rows, options.levels])

  const levelRows = (rows ?? []).filter((r) => r.region_level === level)
  const regionChoices = [...new Set(levelRows.map((r) => r.region_code))]
    .map((code) => ({
      code,
      name: levelRows.find((r) => r.region_code === code)!.region_name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  const sexes = [...new Set(levelRows.map((r) => r.sex_key))].sort(
    byOrder(['T', 'K', 'M']),
  )
  const ages = [
    ...new Set(
      levelRows.filter((r) => r.sex_key === sex).map((r) => r.age_group_key),
    ),
  ].sort()
  const periodTypes = [...new Set(levelRows.map((r) => r.period_type))].sort(
    byOrder(Object.keys(PERIOD_TYPES)),
  )

  // Keep each slicer on a value that exists for the current selection.
  useEffect(() => {
    if (sexes.length && !sexes.includes(sex)) setSex(sexes[0])
    if (ages.length && !ages.includes(age)) {
      const broad = ['ALL', '15+', '16+', '15-74', '16-84', '15-69'].find(
        (band) => ages.includes(band),
      )
      setAge(broad ?? ages[0])
    }
    if (periodTypes.length && !periodTypes.includes(periodType))
      setPeriodType(periodTypes[0])
  }, [sexes.join(), ages.join(), periodTypes.join()])

  const filtered = levelRows.filter(
    (r) =>
      selected.includes(r.region_code) &&
      r.sex_key === sex &&
      r.age_group_key === age &&
      r.period_type === periodType,
  )
  const series: Series[] = selected
    .map((code) => ({
      key: code,
      name: regionChoices.find((choice) => choice.code === code)?.name ?? code,
      points: filtered
        .filter((r) => r.region_code === code)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map((r) => ({
          // Plotted at the period's midpoint, so a pooled 2021-2024 value sits in 2022-23.
          date: midpoint(r.start_date, r.end_date),
          label: r.period_key,
          value: r.value,
          low: r.ci_low,
          high: r.ci_high,
        })),
    }))
    .filter((s) => s.points.length)
  // Colour follows the region's position in the selection, which removal never reorders.
  const colorOf = (key: string) => selected.indexOf(key)
  const latest = series.map((s) => ({ name: s.name, point: s.points.at(-1)! }))

  const download = () => {
    const header = [
      'indicator_key',
      'region_code',
      'region_name',
      'period_key',
      'sex_key',
      'age_group_key',
      'value',
      'ci_low',
      'ci_high',
      'sample_size',
    ]
    const lines = [header.join(',')].concat(
      filtered.map((r) =>
        header
          .map((column) => {
            const value = r[column as keyof IndicatorRow]
            return value == null
              ? ''
              : /[",\n]/.test(String(value))
                ? `"${String(value).replace(/"/g, '""')}"`
                : String(value)
          })
          .join(','),
      ),
    )
    const url = URL.createObjectURL(
      new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${indicator.indicator_key}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!indicator) return null
  const unit = indicator.unit

  return (
    <div className="welfare-explorer">
      <div className="slicers">
        <label>
          {l('Area', 'Område')}
          <select
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value)
              setIndicatorKey('')
            }}
          >
            {Object.keys(DOMAINS)
              .filter((key) =>
                indicators.some((i) => i.domain === key && i.observations),
              )
              .map((key) => (
                <option key={key} value={key}>
                  {l(...DOMAINS[key])}
                </option>
              ))}
          </select>
        </label>
        <label className="wide">
          {l('Indicator', 'Indikator')}
          <select
            value={indicator.indicator_key}
            onChange={(event) => setIndicatorKey(event.target.value)}
          >
            {inDomain.map((i) => (
              <option key={i.indicator_key} value={i.indicator_key}>
                {i.indicator_name} ({i.source_key.toUpperCase()})
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Geography', 'Geografi')}
          <select
            value={level}
            onChange={(event) => {
              const next = event.target.value
              setLevel(next)
              const codes = [
                ...new Set(
                  (rows ?? [])
                    .filter((r) => r.region_level === next)
                    .map((r) => r.region_code),
                ),
              ].sort()
              setSelected(codes.slice(0, next === 'country' ? 1 : 3))
            }}
          >
            {options.levels.map((key) => (
              <option key={key} value={key}>
                {l(...(LEVELS[key] ?? [key, key]))}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Sex', 'Kön')}
          <select value={sex} onChange={(event) => setSex(event.target.value)}>
            {sexes.map((key) => (
              <option key={key} value={key}>
                {l(...SEXES[key])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Age', 'Ålder')}
          <select value={age} onChange={(event) => setAge(event.target.value)}>
            {ages.map((key) => (
              <option key={key} value={key}>
                {key === 'ALL' ? l('All ages', 'Alla åldrar') : key}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Period', 'Period')}
          <select
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value)}
          >
            {periodTypes.map((key) => (
              <option key={key} value={key}>
                {l(...PERIOD_TYPES[key])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {level !== 'country' && (
        <div className="region-picker">
          {selected.map((code) => (
            <button
              key={code}
              className="region-chip"
              onClick={() =>
                setSelected(selected.filter((item) => item !== code))
              }
              aria-label={l(`Remove ${code}`, `Ta bort ${code}`)}
            >
              {regionChoices.find((choice) => choice.code === code)?.name ??
                code}{' '}
              ×
            </button>
          ))}
          {selected.length < MAX_SERIES ? (
            <select
              value=""
              onChange={(event) =>
                event.target.value &&
                setSelected([...selected, event.target.value])
              }
              aria-label={l('Add a region', 'Lägg till region')}
            >
              <option value="">
                {l('+ Add region', '+ Lägg till region')}
              </option>
              {regionChoices
                .filter((choice) => !selected.includes(choice.code))
                .map((choice) => (
                  <option key={choice.code} value={choice.code}>
                    {choice.name}
                  </option>
                ))}
            </select>
          ) : (
            <small>
              {l(
                `At most ${MAX_SERIES} regions at once.`,
                `Högst ${MAX_SERIES} regioner åt gången.`,
              )}
            </small>
          )}
        </div>
      )}

      {error && <p role="alert">{error}</p>}
      {!rows && !error && (
        <div className="loading">{l('Reading the data…', 'Läser data…')}</div>
      )}
      {rows && !series.length && (
        <p className="welfare-note">
          {l(
            'No values for this selection.',
            'Inga värden för det här urvalet.',
          )}
        </p>
      )}
      {series.length > 0 && (
        <>
          <MultiLineChart
            series={series}
            label={`${indicator.indicator_name}, ${series.map((s) => s.name).join(', ')}`}
            format={(value) => formatValue(value, unit)}
            colorOf={colorOf}
          />
          <div className="explorer-foot">
            <table className="welfare-table compact">
              <caption>{l('Latest value', 'Senaste värde')}</caption>
              <thead>
                <tr>
                  <th scope="col">{l('Region', 'Region')}</th>
                  <th scope="col">{l('Period', 'Period')}</th>
                  <th scope="col">{l('Value', 'Värde')}</th>
                  <th scope="col">95 %</th>
                </tr>
              </thead>
              <tbody>
                {latest.map(({ name, point }) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{point.label}</td>
                    <td>{formatValue(point.value, unit)}</td>
                    <td>
                      {point.low != null && point.high != null
                        ? `${formatValue(point.low, unit)}–${formatValue(point.high, unit)}`
                        : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="explorer-source">
              <p>
                <strong>{indicator.indicator_name}</strong>
                {unit ? ` · ${unit}` : ''}
              </p>
              {indicator.description && <p>{indicator.description}</p>}
              {indicator.source_key === 'ess' && (
                <p className="welfare-note">
                  {l(
                    'ESS10 in Sweden was self-completed rather than interviewed; its values are not comparable with other rounds (trust drops to 5.3 from 6.0-6.3). Intervals ignore the survey design and are too narrow.',
                    'ESS10 i Sverige var självifyllnad i stället för intervju; värdena är inte jämförbara med andra omgångar (tilliten faller till 5,3 från 6,0–6,3). Intervallen bortser från urvalsdesignen och är för smala.',
                  )}
                </p>
              )}
              {indicator.source_key === 'fohm' && level !== 'country' && (
                <p className="welfare-note">
                  {l(
                    'County values pool four survey years and are plotted at the middle of each span.',
                    'Länsvärden slår ihop fyra enkätår och ritas i mitten av varje period.',
                  )}
                </p>
              )}
              <p>
                <a
                  href={indicator.homepage_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {indicator.citation} ↗
                </a>
              </p>
              <button className="download-button" onClick={download}>
                {l(
                  `Download ${filtered.length} rows (CSV)`,
                  `Ladda ner ${filtered.length} rader (CSV)`,
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
