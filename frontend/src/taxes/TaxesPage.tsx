import { useCallback, useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import MultiLineChart, { type Series } from '../charts/MultiLineChart'
import { fetchJson } from '../welfare/data'
import TaxCalculator, { type Municipalities } from './TaxCalculator'
import TopicNav from '../TopicNav'
import { DecisionTimeline, LastChanged, type Decisions } from './Decisions'
import YourDecisions from './YourDecisions'
import Household from './Household'
import type { TaxInput, TaxResult } from './calculator'
import '../welfare/welfare.css'
import '../parliament/parliament.css'
import './taxes.css'

type TaxType = {
  tax_code: string
  name_sv: string
  name_en: string
  parent_code: string | null
  is_headline: boolean
  note_sv: string | null
}
type Country = {
  country_code: string
  name_sv: string
  name_en: string
  is_nordic: boolean
  is_eu: boolean
}
type Sweden = {
  types: TaxType[]
  rows: [number, string, number | null, number | null][]
}
type Countries = {
  types: TaxType[]
  countries: Country[]
  rows: [string, number, string, number][]
}
type WedgeRow = {
  country_code: string
  household_type: string
  wage_level: string
  spouse_wage_level: string
  tax_wedge_pct: number | null
  net_personal_average_rate_pct: number | null
  gross_earnings_national: number | null
  net_income_usd_ppp: number | null
}
type Wedge = {
  year: number
  households: Record<string, [string, string]>
  latest: WedgeRow[]
  series: [string, number, string, number][]
}

const pct = (value: number, digits = 1) =>
  `${value.toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`
const billions = (value: number) =>
  `${Math.round(value).toLocaleString('sv-SE')} ${l('bn kr', 'mdr kr')}`
const typeName = (t: TaxType) => l(t.name_en, t.name_sv)
const countryName = (c: Country | undefined, code: string) =>
  c ? l(c.name_en, c.name_sv) : code

const TREND_TYPES = ['T_1100', 'T_2000', 'T_5111', 'T_3000', 'T_1200']
/** The largest taxes, each counted once: sub-types where they matter, not their totals. */
const SWEDEN_TYPES = [
  'T_1100',
  'T_1200',
  'T_2100',
  'T_2200',
  'T_3000',
  'T_4100',
  'T_5111',
  'T_5121',
  'T_6000',
]
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`
const COMPARE_COUNTRIES = ['SWE', 'DNK', 'NOR', 'FIN', 'OECD_REP']
const WAGE_LEVELS: Record<string, [string, string]> = {
  AW67: ['67 % of the average wage', '67 % av snittlönen'],
  AW100: ['The average wage', 'Snittlönen'],
  AW167: ['167 % of the average wage', '167 % av snittlönen'],
}

function RankBars({
  items,
  format,
  testId,
}: {
  items: {
    key: string
    label: string
    value: number
    highlight?: boolean
    strong?: boolean
  }[]
  format: (value: number) => string
  testId?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ol className="rank-bars" data-testid={testId}>
      {items.map((item) => (
        <li
          key={item.key}
          className={
            item.highlight ? 'highlight' : item.strong ? 'strong' : undefined
          }
        >
          <span className="rank-label">{item.label}</span>
          <span className="rank-track">
            <span
              className="rank-bar"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="rank-value">{format(item.value)}</span>
        </li>
      ))}
    </ol>
  )
}

export default function TaxesPage({ view = '#taxes' }: { view?: string }) {
  const [sweden, setSweden] = useState<Sweden | null>(null)
  const [countries, setCountries] = useState<Countries | null>(null)
  const [wedge, setWedge] = useState<Wedge | null>(null)
  const [municipalities, setMunicipalities] = useState<Municipalities | null>(
    null,
  )
  const [decisions, setDecisions] = useState<Decisions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compareType, setCompareType] = useState('_T')
  const [household, setHousehold] = useState('S_C0')
  const [wageLevel, setWageLevel] = useState<string | null>(null)
  const [mine, setMine] = useState<{
    result: TaxResult
    input: TaxInput
  } | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<Sweden>('taxes/sweden.json'),
      fetchJson<Countries>('taxes/countries.json'),
      fetchJson<Wedge>('taxes/wedge.json'),
      fetchJson<Municipalities>('taxes/municipalities.json'),
      fetchJson<Decisions>('taxes/decisions.json'),
    ])
      .then(([s, c, w, m, d]) => {
        setDecisions(d)
        setSweden(s)
        setCountries(c)
        setWedge(w)
        setMunicipalities(m)
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const onResult = useCallback(
    (result: TaxResult, input: TaxInput) => setMine({ result, input }),
    [],
  )

  const types = useMemo(
    () => new Map((sweden?.types ?? []).map((t) => [t.tax_code, t])),
    [sweden],
  )
  const countryBy = useMemo(
    () => new Map((countries?.countries ?? []).map((c) => [c.country_code, c])),
    [countries],
  )

  // Sweden: the latest year with a total, and each headline type that year.
  const swedenLatest = useMemo(() => {
    if (!sweden) return null
    const year = Math.max(
      ...sweden.rows
        .filter((r) => r[1] === '_T' && r[2] != null)
        .map((r) => r[0]),
    )
    const at = (code: string) =>
      sweden.rows.find((r) => r[0] === year && r[1] === code)
    return { year, at }
  }, [sweden])

  // The year most countries have, for a fair ranking.
  const compareYear = useMemo(() => {
    if (!countries) return null
    const counts = new Map<number, number>()
    countries.rows
      .filter((r) => r[2] === '_T')
      .forEach((r) => counts.set(r[1], (counts.get(r[1]) ?? 0) + 1))
    const full = Math.max(...counts.values())
    return Math.max(
      ...[...counts].filter(([, n]) => n >= full - 2).map(([y]) => y),
    )
  }, [countries])

  const summary = useMemo(() => {
    if (!swedenLatest || !countries || !compareYear) return []
    const { year, at } = swedenLatest
    const total = at('_T')
    const ranking = countries.rows
      .filter(
        (r) =>
          r[1] === compareYear &&
          r[2] === '_T' &&
          countryBy.get(r[0])?.name_en &&
          !['OECD_REP', 'EU22OECD'].includes(r[0]),
      )
      .sort((a, b) => b[3] - a[3])
    const place = ranking.findIndex((r) => r[0] === 'SWE') + 1
    const oecd = countries.rows.find(
      (r) => r[0] === 'OECD_REP' && r[1] === compareYear && r[2] === '_T',
    )
    const parts = [
      'T_1100',
      'T_2000',
      'T_3000',
      'T_1200',
      'T_4000',
      'T_5000',
      'T_6000',
    ]
      .map((code) => ({ code, row: at(code) }))
      .filter((p) => p.row?.[2] != null)
      .sort((a, b) => (b.row![2] ?? 0) - (a.row![2] ?? 0))
    const largest = parts[0]
    return [
      l(
        `In ${year} Sweden collected ${pct(total?.[2] ?? 0)} of GDP in taxes and social contributions, ${billions(total?.[3] ?? 0)}.`,
        `${year} tog Sverige in ${pct(total?.[2] ?? 0)} av BNP i skatter och avgifter, ${billions(total?.[3] ?? 0)}.`,
      ),
      l(
        `That was the ${ordinal(place)} highest of ${ranking.length} OECD countries in ${compareYear}; the OECD average was ${pct(oecd?.[3] ?? 0)}.`,
        `Det var ${place}:e högst av ${ranking.length} OECD-länder ${compareYear}; OECD-snittet var ${pct(oecd?.[3] ?? 0)}.`,
      ),
      largest
        ? l(
            `The largest single source is ${typeName(types.get(largest.code)!).toLowerCase()} (${pct(largest.row![2]!)} of GDP).`,
            `Den största enskilda källan är ${typeName(types.get(largest.code)!).toLowerCase()} (${pct(largest.row![2]!)} av BNP).`,
          )
        : '',
    ].filter(Boolean)
  }, [swedenLatest, countries, compareYear, countryBy, types])

  const trendSeries: Series[] = useMemo(
    () =>
      sweden
        ? TREND_TYPES.map((code) => ({
            key: code,
            name: typeName(types.get(code)!),
            points: sweden.rows
              .filter((r) => r[1] === code && r[2] != null)
              .map((r) => ({
                date: `${r[0]}-07-01`,
                label: String(r[0]),
                value: r[2]!,
              })),
          }))
        : [],
    [sweden, types],
  )

  const compareSeries: Series[] = useMemo(
    () =>
      countries
        ? COMPARE_COUNTRIES.map((code) => ({
            key: code,
            name: countryName(countryBy.get(code), code),
            points: countries.rows
              .filter((r) => r[0] === code && r[2] === compareType)
              .map((r) => ({
                date: `${r[1]}-07-01`,
                label: String(r[1]),
                value: r[3],
              })),
          })).filter((s) => s.points.length)
        : [],
    [countries, compareType, countryBy],
  )

  // Where the user's salary sits against the OECD's Swedish average wage.
  const swedishAverageWage = wedge?.latest.find(
    (r) =>
      r.country_code === 'SWE' &&
      r.household_type === 'S_C0' &&
      r.wage_level === 'AW100',
  )?.gross_earnings_national
  const suggestedLevel = useMemo(() => {
    if (!mine || !swedishAverageWage || mine.input.salary <= 0) return 'AW100'
    const share = mine.input.salary / swedishAverageWage
    return share < 0.835 ? 'AW67' : share > 1.335 ? 'AW167' : 'AW100'
  }, [mine, swedishAverageWage])
  const level = wageLevel ?? suggestedLevel

  const wedgeItems = useMemo(() => {
    if (!wedge) return []
    return wedge.latest
      .filter(
        (r) =>
          r.household_type === household &&
          r.wage_level === level &&
          ['_Z', 'NOEARN_UNEMP'].includes(r.spouse_wage_level) &&
          r.tax_wedge_pct != null &&
          countryBy.has(r.country_code),
      )
      .sort((a, b) => b.tax_wedge_pct! - a.tax_wedge_pct!)
      .map((r) => ({
        key: r.country_code,
        label: countryName(countryBy.get(r.country_code), r.country_code),
        value: r.tax_wedge_pct!,
        highlight: r.country_code === 'SWE',
        strong:
          countryBy.get(r.country_code)?.is_nordic ||
          r.country_code === 'OECD_REP',
      }))
  }, [wedge, household, level, countryBy])

  const rankingItems = useMemo(() => {
    if (!countries || !compareYear) return []
    return countries.rows
      .filter(
        (r) =>
          r[1] === compareYear && r[2] === compareType && countryBy.has(r[0]),
      )
      .sort((a, b) => b[3] - a[3])
      .map((r) => ({
        key: r[0],
        label: countryName(countryBy.get(r[0]), r[0]),
        value: r[3],
        highlight: r[0] === 'SWE',
        strong: countryBy.get(r[0])?.is_nordic || r[0] === 'OECD_REP',
      }))
  }, [countries, compareYear, compareType, countryBy])

  const loading =
    !sweden || !countries || !wedge || !municipalities || !decisions

  return (
    <div className="project-page welfare-page taxes-page">
      <div className="page-lead">
        <p className="eyebrow">{l('Taxes', 'Skatter')}</p>
        <h1>
          {l(
            'What Sweden taxes, and what you pay',
            'Vad Sverige tar in i skatt, och vad du betalar',
          )}
        </h1>
        <p>
          {l(
            'Every kind of tax, over sixty years and against the other OECD countries, and a calculator that gives your own tax to the krona under Skatteverket’s rules: salary, pension, benefits, a business, capital, savings accounts and your house, with what your employer pays on top.',
            'Alla slags skatter, över sextio år och mot de andra OECD-länderna, och en räknare som ger din egen skatt på kronan enligt Skatteverkets regler: lön, pension, ersättningar, egen firma, kapital, ISK och villa, med vad arbetsgivaren betalar ovanpå.',
          )}
        </p>
        <TopicNav
          active={view}
          items={[
            ['#taxes', 'Overview', 'Översikt'],
            ['#taxes-calculator', 'Your tax', 'Din skatt'],
            ['#taxes-decisions', 'Decisions', 'Beslut'],
          ]}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && !error && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}

      {view === '#taxes' && summary.length > 0 && (
        <section
          className="report welfare-section now-summary"
          aria-label={l('Summary', 'Sammanfattning')}
        >
          <p className="eyebrow">{l('In short', 'I korthet')}</p>
          <ul className="plain-summary" data-testid="tax-summary">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {view === '#taxes' && sweden && swedenLatest && (
        <section
          className="report welfare-section"
          aria-labelledby="tax-sweden"
        >
          <p className="eyebrow">
            {l('Sweden', 'Sverige')} · {swedenLatest.year}
          </p>
          <h2 id="tax-sweden">
            {l('Where the money comes from', 'Var pengarna kommer ifrån')}
          </h2>
          <RankBars
            testId="tax-types"
            items={sweden.types
              .filter((t) => SWEDEN_TYPES.includes(t.tax_code))
              .map((t) => ({ t, row: swedenLatest.at(t.tax_code) }))
              .filter(({ row }) => row?.[2] != null && row[2] > 0)
              .sort((a, b) => b.row![2]! - a.row![2]!)
              .map(({ t, row }) => ({
                key: t.tax_code,
                label: `${typeName(t)}${t.note_sv ? l('', ` – ${t.note_sv}`) : ''}`,
                value: row![3] ?? 0,
              }))}
            format={billions}
          />
          <h3 className="analysis-subhead">
            {l('Share of GDP since 1965', 'Andel av BNP sedan 1965')}
          </h3>
          <MultiLineChart
            series={trendSeries}
            label={l(
              'Swedish tax revenue by type, share of GDP',
              'Sveriges skatteintäkter per typ, andel av BNP',
            )}
            format={(v) => pct(v, 0)}
            colorOf={(key) => TREND_TYPES.indexOf(key)}
          />
          <p className="welfare-note">
            {l(
              'All levels of government, as the OECD counts them. Employer contributions are split between social contributions (arbetsgivaravgifter) and payroll tax (allmän löneavgift). Wealth tax was abolished in 2007, inheritance and gift tax in 2005.',
              'Alla nivåer av offentlig sektor, som OECD räknar. Arbetsgivarens avgifter delas mellan socialavgifter (arbetsgivaravgifter) och löneskatt (allmän löneavgift). Förmögenhetsskatten avskaffades 2007, arvs- och gåvoskatten 2005.',
            )}
          </p>
        </section>
      )}

      {view === '#taxes' && countries && compareYear && (
        <section
          className="report welfare-section"
          aria-labelledby="tax-countries"
        >
          <p className="eyebrow">
            {l('Other countries', 'Andra länder')} · {compareYear}
          </p>
          <h2 id="tax-countries">
            {l('How Sweden compares', 'Så står sig Sverige')}
          </h2>
          <div className="slicers">
            <label className="wide">
              {l('Tax', 'Skatt')}
              <select
                value={compareType}
                onChange={(e) => setCompareType(e.target.value)}
                data-field="compare-type"
              >
                {countries.types.map((t) => (
                  <option key={t.tax_code} value={t.tax_code}>
                    {typeName(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <RankBars
            testId="tax-ranking"
            items={rankingItems}
            format={(v) => pct(v)}
          />
          <h3 className="analysis-subhead">{l('Over time', 'Över tid')}</h3>
          <MultiLineChart
            series={compareSeries}
            label={l('Share of GDP by country', 'Andel av BNP per land')}
            format={(v) => pct(v, 0)}
            colorOf={(key) => COMPARE_COUNTRIES.indexOf(key)}
          />
          <p className="welfare-note">
            {l(
              'Share of GDP, OECD Revenue Statistics. Sweden is marked; the Nordic countries and the OECD average are in bold.',
              'Andel av BNP, OECD Revenue Statistics. Sverige är markerat; de nordiska länderna och OECD-snittet står i fetstil.',
            )}
          </p>
        </section>
      )}

      {view === '#taxes-calculator' && municipalities && (
        <section
          className="report welfare-section"
          aria-labelledby="tax-calculator-heading"
          id="tax-calculator"
        >
          <p className="eyebrow">{l('Your tax', 'Din skatt')}</p>
          <h2 id="tax-calculator-heading">
            {l('Work out your tax', 'Räkna ut din skatt')}
          </h2>
          <TaxCalculator municipalities={municipalities} onResult={onResult} />
        </section>
      )}

      {view === '#taxes-calculator' && decisions && mine && (
        <section
          className="report welfare-section"
          aria-labelledby="tax-your-decisions"
        >
          <p className="eyebrow">{l('Decisions and you', 'Besluten och du')}</p>
          <h2 id="tax-your-decisions">
            {l(
              'How the decisions since 2016 changed your tax',
              'Så har besluten sedan 2016 ändrat din skatt',
            )}
          </h2>
          <YourDecisions input={mine.input} decisions={decisions} />
        </section>
      )}

      {view === '#taxes-calculator' && decisions && (
        <section
          className="report welfare-section"
          aria-labelledby="tax-household"
        >
          <p className="eyebrow">{l('What you buy', 'Det du köper')}</p>
          <h2 id="tax-household">
            {l(
              'VAT and fuel tax: an estimate for your household',
              'Moms och bränsleskatt: en uppskattning för ditt hushåll',
            )}
          </h2>
          <Household decisions={decisions} />
        </section>
      )}

      {view === '#taxes-decisions' && decisions && (
        <>
          <section
            className="report welfare-section"
            aria-labelledby="tax-last-changed"
          >
            <p className="eyebrow">{l('Decisions', 'Beslut')}</p>
            <h2 id="tax-last-changed">
              {l(
                'When each tax last changed',
                'När varje skatt ändrades senast',
              )}
            </h2>
            <LastChanged data={decisions} />
          </section>
          <section
            className="report welfare-section"
            aria-labelledby="tax-decisions"
          >
            <h2 id="tax-decisions">
              {l(
                'Every tax decision since 2016: who voted how, and the studies behind it',
                'Varje skattebeslut sedan 2016: hur partierna röstade, och utredningarna bakom',
              )}
            </h2>
            <DecisionTimeline data={decisions} />
            <p className="welfare-note">{decisions.method}</p>
          </section>
        </>
      )}

      {view === '#taxes' && wedge && (
        <section className="report welfare-section" aria-labelledby="tax-wedge">
          <p className="eyebrow">
            {l('Tax on a salary', 'Skatt på en lön')} · {wedge.year}
          </p>
          <h2 id="tax-wedge">
            {l(
              'What the same salary would pay elsewhere',
              'Vad samma lön skulle betala i andra länder',
            )}
          </h2>
          <div className="slicers">
            <label>
              {l('Household', 'Hushåll')}
              <select
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
              >
                {Object.entries(wedge.households).map(([key, name]) => (
                  <option key={key} value={key}>
                    {l(...name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {l('Salary', 'Lön')}
              <select
                value={level}
                onChange={(e) => setWageLevel(e.target.value)}
                data-field="wage-level"
              >
                {Object.entries(WAGE_LEVELS).map(([key, name]) => (
                  <option key={key} value={key}>
                    {l(...name)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {mine && mine.input.salary > 0 && swedishAverageWage && (
            <p className="analysis-stat">
              {l('Your salary is', 'Din lön är')}{' '}
              <strong>
                {pct((100 * mine.input.salary) / swedishAverageWage, 0)}
              </strong>{' '}
              {l(
                `of the Swedish average wage in the OECD’s data (${Math.round(swedishAverageWage).toLocaleString('sv-SE')} kr a year). Your tax wedge from the calculator:`,
                `av den svenska snittlönen i OECD:s data (${Math.round(swedishAverageWage).toLocaleString('sv-SE')} kr per år). Din skattekil enligt räknaren:`,
              )}{' '}
              <strong>{pct(mine.result.taxWedge)}</strong>.
            </p>
          )}
          <RankBars
            testId="tax-wedge-ranking"
            items={wedgeItems}
            format={(v) => pct(v)}
          />
          <p className="welfare-note">
            {l(
              'The tax wedge: income tax, employee and employer contributions, less cash benefits, as a share of what the job costs the employer. The OECD computes it for standard households at 67, 100 and 167 % of each country’s own average wage, so a country is compared at the same place in its own wage scale, not at the same number of kronor. Local taxes are an average; VAT is not included.',
              'Skattekilen: inkomstskatt, anställdas och arbetsgivarens avgifter, minus kontanta bidrag, som andel av vad jobbet kostar arbetsgivaren. OECD beräknar den för standardhushåll vid 67, 100 och 167 % av varje lands egen snittlön, så ett land jämförs på samma plats i sin egen lönefördelning, inte vid samma antal kronor. Kommunalskatten är ett snitt; moms ingår inte.',
            )}
          </p>
        </section>
      )}
    </div>
  )
}
