import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import MultiLineChart, { type Series } from '../charts/MultiLineChart'
import ScatterChart from '../charts/ScatterChart'
import { fetchJson } from '../welfare/data'
import '../welfare/welfare.css'
import './analysis.css'

type PanelRow = {
  region_code: string
  region_name: string
  is_country: boolean
  year: number
  population: number | null
} & Record<string, number | string | boolean | null>

type MonthRow = { month_start: string } & Record<string, number | null>

type EssRow = {
  unit_type: string
  unit_code: string
  period_key: string
  survey_mode: string
  reference_year: number
  respondents: number
} & Record<string, number | string | null>

type PolarizationSession = {
  session: string
  all_parties_auc: number
  seven_parties_auc: number | null
  within_debate_auc: number | null
  governing_parties: string[]
  passages: number
}
type Polarization = {
  run_id: string
  sessions: PolarizationSession[]
  eras: Record<string, [number | null, number | null]> | null
  core_parties: string[] | null
}
type ModelCard = {
  task: string
  run_id: string
  gate_passed: boolean
  purpose: string
  results: {
    model: string
    metric: string
    value: number
    interval: string | null
  }[]
  limitations: string[]
  card_url: string
  published: boolean
}

type Measure = {
  key: string
  label: [string, string]
  unit: string
  digits: number
}

/** County measures, each already aggregated by its rule in dbt. */
const COUNTY_MEASURES: Measure[] = [
  {
    key: 'unemployment_rate_pct',
    label: ['Unemployment (AKU), %', 'Arbetslöshet (AKU), %'],
    unit: '%',
    digits: 1,
  },
  {
    key: 'employment_rate_pct',
    label: ['Employment rate (AKU), %', 'Sysselsättningsgrad (AKU), %'],
    unit: '%',
    digits: 1,
  },
  {
    key: 'sick_pay_rate_days',
    label: ['Sick-pay days per insured', 'Sjukpenningtal, dagar'],
    unit: '',
    digits: 1,
  },
  {
    key: 'stress_cases_per_1000',
    label: [
      'Stress sick-leave cases per 1,000',
      'Stressrelaterade sjukfall per 1 000',
    ],
    unit: '',
    digits: 1,
  },
  {
    key: 'ongoing_sick_leave_per_1000',
    label: ['Ongoing sick leave per 1,000', 'Pågående sjukfall per 1 000'],
    unit: '',
    digits: 1,
  },
  {
    key: 'social_assistance_pct',
    label: ['Social assistance, %', 'Ekonomiskt bistånd, %'],
    unit: '%',
    digits: 1,
  },
  {
    key: 'median_earned_income_sek',
    label: ['Median earned income, SEK', 'Medianinkomst, kr'],
    unit: '',
    digits: 0,
  },
  {
    key: 'ill_health_days',
    label: ['Ill-health days', 'Ohälsotal, dagar'],
    unit: '',
    digits: 1,
  },
  {
    key: 'violent_crime_per_100k',
    label: [
      'Reported violent crime per 100,000',
      'Anmälda våldsbrott per 100 000',
    ],
    unit: '',
    digits: 0,
  },
  {
    key: 'turnout_riksdag_pct',
    label: ['Turnout, Riksdag election, %', 'Valdeltagande riksdagsval, %'],
    unit: '%',
    digits: 1,
  },
  {
    key: 'serious_mental_strain_pct',
    label: ['Serious mental strain, %', 'Allvarlig psykisk påfrestning, %'],
    unit: '%',
    digits: 1,
  },
  {
    key: 'low_trust_pct',
    label: ['Low trust in others, %', 'Låg tillit till andra, %'],
    unit: '%',
    digits: 1,
  },
  {
    key: 'eligible_vocational_programme_pct',
    label: [
      'Eligible for upper secondary, %',
      'Behöriga till gymnasiets yrkesprogram, %',
    ],
    unit: '%',
    digits: 1,
  },
]

/** National monthly views. Series in one view share a unit, so one axis is honest. */
const MONTH_VIEWS: {
  key: string
  label: [string, string]
  unit: string
  series: { key: string; name: [string, string] }[]
}[] = [
  {
    key: 'unemployment',
    label: ['Unemployment', 'Arbetslöshet'],
    unit: '%',
    series: [
      {
        key: 'unemployment_rate_sa',
        name: ['Seasonally adjusted', 'Säsongsrensad'],
      },
      { key: 'unemployment_rate_trend', name: ['Trend', 'Trend'] },
      { key: 'unemployment_rate', name: ['Unadjusted', 'Ojusterad'] },
    ],
  },
  {
    key: 'employment',
    label: ['Employment rate', 'Sysselsättningsgrad'],
    unit: '%',
    series: [
      {
        key: 'employment_rate_sa',
        name: ['Seasonally adjusted', 'Säsongsrensad'],
      },
    ],
  },
  {
    key: 'sick_pay',
    label: ['Sick-pay days (FK 2.0)', 'Sjukpenningtal (FK 2.0)'],
    unit: '',
    series: [
      {
        key: 'sick_pay_rate_days',
        name: [
          'Days per insured, rolling 12 months',
          'Dagar per försäkrad, rullande 12 mån',
        ],
      },
    ],
  },
  {
    key: 'psychiatric',
    label: [
      'Psychiatric share of new sick leave',
      'Psykiatriska diagnoser bland nya sjukfall',
    ],
    unit: '%',
    series: [
      {
        key: 'psychiatric_share_of_started_12m_pct',
        name: ['Share, rolling 12 months', 'Andel, rullande 12 mån'],
      },
    ],
  },
]

const ESS_MEASURES: { key: string; label: [string, string] }[] = [
  {
    key: 'ppltrst_mean',
    label: ['Trust in people', 'Tillit till andra människor'],
  },
  {
    key: 'trstprl_mean',
    label: ['Trust in parliament', 'Förtroende för riksdagen'],
  },
  {
    key: 'trstplt_mean',
    label: ['Trust in politicians', 'Förtroende för politiker'],
  },
  {
    key: 'trstplc_mean',
    label: ['Trust in the police', 'Förtroende för polisen'],
  },
  {
    key: 'trstlgl_mean',
    label: ['Trust in the legal system', 'Förtroende för rättsväsendet'],
  },
  {
    key: 'stflife_mean',
    label: ['Life satisfaction', 'Livstillfredsställelse'],
  },
  { key: 'happy_mean', label: ['Happiness', 'Lycka'] },
  {
    key: 'stfdem_mean',
    label: ['Satisfaction with democracy', 'Nöjdhet med demokratin'],
  },
  {
    key: 'stfeco_mean',
    label: ['Satisfaction with the economy', 'Nöjdhet med ekonomin'],
  },
]
const ESS_UNITS: { code: string; name: [string, string] }[] = [
  { code: 'SE', name: ['Sweden', 'Sverige'] },
  { code: 'NO', name: ['Norway', 'Norge'] },
  { code: 'DK', name: ['Denmark', 'Danmark'] },
  { code: 'FI', name: ['Finland', 'Finland'] },
  { code: 'EU27', name: ['EU-27 (pooled)', 'EU-27 (sammanvägt)'] },
]

const POLARIZATION_SERIES: {
  key: keyof PolarizationSession
  name: [string, string]
}[] = [
  { key: 'all_parties_auc', name: ['All parties', 'Alla partier'] },
  {
    key: 'seven_parties_auc',
    name: ['Same seven parties', 'Samma sju partier'],
  },
  {
    key: 'within_debate_auc',
    name: ['Seven parties, same debate', 'Sju partier, samma debatt'],
  },
]

function number(value: number, digits: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Pearson correlation, and its population-weighted counterpart. */
function correlation(pairs: [number, number, number][], weighted: boolean) {
  const w = pairs.map((p) => (weighted ? p[2] : 1))
  const total = w.reduce((a, b) => a + b, 0)
  const mx = pairs.reduce((a, p, i) => a + w[i] * p[0], 0) / total
  const my = pairs.reduce((a, p, i) => a + w[i] * p[1], 0) / total
  let sxy = 0
  let sxx = 0
  let syy = 0
  pairs.forEach((p, i) => {
    sxy += w[i] * (p[0] - mx) * (p[1] - my)
    sxx += w[i] * (p[0] - mx) ** 2
    syy += w[i] * (p[1] - my) ** 2
  })
  return sxy / Math.sqrt(sxx * syy)
}

function CountySection({ panel }: { panel: PanelRow[] }) {
  const [xKey, setXKey] = useState('unemployment_rate_pct')
  const [yKey, setYKey] = useState('sick_pay_rate_days')
  const xMeasure = COUNTY_MEASURES.find((m) => m.key === xKey)!
  const yMeasure = COUNTY_MEASURES.find((m) => m.key === yKey)!
  // Years in which at least 15 counties have both measures.
  const years = useMemo(() => {
    const counts = new Map<number, number>()
    panel.forEach((row) => {
      if (!row.is_country && row[xKey] != null && row[yKey] != null)
        counts.set(row.year, (counts.get(row.year) ?? 0) + 1)
    })
    return [...counts]
      .filter(([, n]) => n >= 15)
      .map(([year]) => year)
      .sort()
  }, [panel, xKey, yKey])
  const [chosenYear, setYear] = useState<number | null>(null)
  const year =
    chosenYear != null && years.includes(chosenYear)
      ? chosenYear
      : (years.at(-1) ?? null)
  const rows = panel.filter(
    (row) => row.year === year && row[xKey] != null && row[yKey] != null,
  )
  const counties = rows.filter((row) => !row.is_country)
  const points = rows.map((row) => ({
    key: row.region_code,
    label: row.is_country ? l('Sweden', 'Riket') : row.region_name,
    x: Number(row[xKey]),
    y: Number(row[yKey]),
    reference: row.is_country,
  }))
  const pairs = counties.map(
    (row) =>
      [Number(row[xKey]), Number(row[yKey]), Number(row.population ?? 0)] as [
        number,
        number,
        number,
      ],
  )
  const r = pairs.length > 2 ? correlation(pairs, false) : null
  const rWeighted =
    pairs.length > 2 && pairs.every((p) => p[2] > 0)
      ? correlation(pairs, true)
      : null
  const fmt = (m: Measure) => (v: number) =>
    `${number(v, m.digits)}${m.unit === '%' ? ' %' : ''}`

  return (
    <section
      className="report welfare-section"
      aria-labelledby="analysis-counties"
    >
      <p className="eyebrow">{l('Counties', 'Län')}</p>
      <h2 id="analysis-counties">
        {l('Two measures, 21 counties', 'Två mått, 21 län')}
      </h2>
      <p className="welfare-note">
        {l(
          'Pick any two measures and a year. Each dot is a county; the country is marked. The correlation describes counties, not people: that unemployed people are more often on sick leave does not follow from it (the ecological fallacy). 21 counties is a small sample.',
          'Välj två mått och ett år. Varje punkt är ett län, riket är markerat. Korrelationen beskriver län, inte människor: att arbetslösa oftare är sjukskrivna följer inte av den (ekologiskt felslut). 21 län är ett litet urval.',
        )}
      </p>
      <div className="slicers">
        <label className="wide">
          {l('Horizontal axis', 'Vågrät axel')}
          <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
            {COUNTY_MEASURES.map((m) => (
              <option key={m.key} value={m.key}>
                {l(...m.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          {l('Vertical axis', 'Lodrät axel')}
          <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
            {COUNTY_MEASURES.map((m) => (
              <option key={m.key} value={m.key}>
                {l(...m.label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l('Year', 'År')}
          <select
            value={year ?? ''}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {year == null || counties.length < 3 ? (
        <p className="welfare-note">
          {l(
            'These two measures do not overlap in enough counties in any year.',
            'De här två måtten överlappar inte i tillräckligt många län något år.',
          )}
        </p>
      ) : (
        <>
          <p className="analysis-stat" data-testid="county-correlation">
            <strong>r = {number(r!, 2)}</strong>{' '}
            {l(
              `across ${counties.length} counties in ${year}`,
              `över ${counties.length} län ${year}`,
            )}
            {rWeighted != null && (
              <span>
                {' · '}
                {l('population-weighted', 'befolkningsviktat')} r ={' '}
                {number(rWeighted, 2)}
              </span>
            )}
          </p>
          <ScatterChart
            points={points}
            xLabel={l(...xMeasure.label)}
            yLabel={l(...yMeasure.label)}
            formatX={fmt(xMeasure)}
            formatY={fmt(yMeasure)}
            label={l(
              `${l(...yMeasure.label)} against ${l(...xMeasure.label)} by county, ${year}`,
              `${l(...yMeasure.label)} mot ${l(...xMeasure.label)} per län, ${year}`,
            )}
          />
          <details className="analysis-table">
            <summary>{l('Show as a table', 'Visa som tabell')}</summary>
            <div className="table-scroll">
              <table className="welfare-table compact">
                <thead>
                  <tr>
                    <th>{l('County', 'Län')}</th>
                    <th>{l(...xMeasure.label)}</th>
                    <th>{l(...yMeasure.label)}</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      <td>{fmt(xMeasure)(p.x)}</td>
                      <td>{fmt(yMeasure)(p.y)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}

function MonthSection({ months }: { months: MonthRow[] }) {
  const [viewKey, setViewKey] = useState('unemployment')
  const view = MONTH_VIEWS.find((v) => v.key === viewKey)!
  const series: Series[] = view.series
    .map((s) => ({
      key: s.key,
      name: l(...s.name),
      points: months
        .filter((row) => row[s.key] != null)
        .map((row) => ({
          date: row.month_start,
          label: row.month_start.slice(0, 7),
          value: Number(row[s.key]),
        })),
    }))
    .filter((s) => s.points.length)
  const colorOf = (key: string) => view.series.findIndex((s) => s.key === key)
  return (
    <section
      className="report welfare-section"
      aria-labelledby="analysis-months"
    >
      <p className="eyebrow">{l('Sweden', 'Sverige')}</p>
      <h2 id="analysis-months">{l('Month by month', 'Månad för månad')}</h2>
      <div className="slicers">
        <label className="wide">
          {l('Series', 'Serie')}
          <select value={viewKey} onChange={(e) => setViewKey(e.target.value)}>
            {MONTH_VIEWS.map((v) => (
              <option key={v.key} value={v.key}>
                {l(...v.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MultiLineChart
        series={series}
        label={l(...view.label)}
        format={(v) =>
          `${number(v, view.unit === '%' ? 1 : 1)}${view.unit === '%' ? ' %' : ''}`
        }
        colorOf={colorOf}
      />
      <p className="welfare-note">
        {l(
          'AKU (SCB) for the labour market, Försäkringskassan for sick leave. Sick-pay days are a rolling twelve-month measure from 2021.',
          'AKU (SCB) för arbetsmarknaden, Försäkringskassan för sjukskrivning. Sjukpenningtalet är ett rullande tolvmånadersmått från 2021.',
        )}
      </p>
    </section>
  )
}

function EuropeSection({ ess }: { ess: EssRow[] }) {
  const [measure, setMeasure] = useState('ppltrst_mean')
  const chosen = ESS_MEASURES.find((m) => m.key === measure)!
  const series: Series[] = ESS_UNITS.map((unit) => ({
    key: unit.code,
    name: l(...unit.name),
    points: ess
      .filter((row) => row.unit_code === unit.code && row[measure] != null)
      .map((row) => ({
        date: `${row.reference_year}-07-01`,
        label:
          row.survey_mode === 'interview'
            ? row.period_key
            : `${row.period_key}, ${l('self-completed', 'självifyllnad')}`,
        value: Number(row[measure]),
      })),
  })).filter((s) => s.points.length)
  const colorOf = (key: string) => ESS_UNITS.findIndex((u) => u.code === key)
  return (
    <section
      className="report welfare-section"
      aria-labelledby="analysis-europe"
    >
      <p className="eyebrow">European Social Survey</p>
      <h2 id="analysis-europe">
        {l('Sweden among its neighbours', 'Sverige bland grannarna')}
      </h2>
      <div className="slicers">
        <label className="wide">
          {l('Question (0-10)', 'Fråga (0–10)')}
          <select value={measure} onChange={(e) => setMeasure(e.target.value)}>
            {ESS_MEASURES.map((m) => (
              <option key={m.key} value={m.key}>
                {l(...m.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MultiLineChart
        series={series}
        label={l(...chosen.label)}
        format={(v) => number(v, 1)}
        colorOf={colorOf}
      />
      <p className="welfare-note">
        {l(
          'Weighted means per round (pspwght; EU-27 pooled with population weights). Sweden’s ESS10 was self-completed rather than an interview, and its dip is probably a mode effect, not a real change. Intervals are omitted here and are too narrow in the data, because they ignore the survey design.',
          'Viktade medel per omgång (pspwght; EU-27 sammanvägt med befolkningsvikter). Sveriges ESS10 samlades in med självifyllnad i stället för intervju, och dess dipp är sannolikt en metodeffekt, inte en verklig förändring. Intervallen visas inte här och är för smala i datan, eftersom de bortser från urvalsdesignen.',
        )}
      </p>
    </section>
  )
}

function PolarizationSection({ data }: { data: Polarization }) {
  const series: Series[] = POLARIZATION_SERIES.map((s) => ({
    key: s.key,
    name: l(...s.name),
    points: data.sessions
      .filter((row) => row[s.key] != null)
      .map((row) => ({
        date: `${row.session.slice(0, 4)}-10-01`,
        label: row.session,
        value: Number(row[s.key]),
      })),
  }))
  const colorOf = (key: string) =>
    POLARIZATION_SERIES.findIndex((s) => s.key === key)
  const eras = data.eras ?? {}
  const era = (key: string, index: 0 | 1) =>
    eras[key]?.[index] != null ? number(eras[key][index]!, 3) : '–'
  const shift = (key: string) => {
    const [before, after] = eras[key] ?? [null, null]
    if (before == null || after == null) return '–'
    const delta = after - before
    return `${delta >= 0 ? '+' : '−'}${number(Math.abs(delta), 3)}`
  }
  return (
    <section
      className="report welfare-section"
      aria-labelledby="analysis-parties"
    >
      <p className="eyebrow">
        {l('Machine learning · Riksdag', 'Maskininlärning · riksdagen')}
      </p>
      <h2 id="analysis-parties">
        {l(
          'How easy are the parties to tell apart by their words?',
          'Hur lätta är partierna att skilja åt på orden?',
        )}
      </h2>
      <p className="welfare-note">
        {l(
          'For each session a classifier guesses the speaker’s party from the text of the speech, and the measure is how often it tells two parties apart (0.5 is chance, 1 is always). Party names are masked, and no member appears in both training and test data. The three lines separate what drives the change: a new party entering, and what the parties talk about.',
          'För varje riksmöte gissar en klassificerare talarens parti utifrån talets text, och måttet är hur ofta den skiljer två partier åt (0,5 är slump, 1 är alltid). Partinamn är maskerade, och ingen ledamot finns i både tränings- och testdata. De tre linjerna skiljer ut vad som driver förändringen: att ett nytt parti kommer in, och vad partierna pratar om.',
        )}
      </p>
      <MultiLineChart
        series={series}
        label={l(
          'Party separability by session',
          'Partiernas särskiljbarhet per riksmöte',
        )}
        format={(v) => number(v, 2)}
        colorOf={colorOf}
        yFrom={0.5}
      />
      <div className="table-scroll">
        <table className="welfare-table compact analysis-eras">
          <caption>
            {l(
              'Mean over sessions, before and after the Sweden Democrats entered (2010)',
              'Medel över riksmöten, före och efter att Sverigedemokraterna kom in (2010)',
            )}
          </caption>
          <thead>
            <tr>
              <th>{l('Measure', 'Mått')}</th>
              <th>1993/94–2009/10</th>
              <th>2010/11–</th>
              <th>{l('Change', 'Förändring')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{l('All parties', 'Alla partier')}</td>
              <td>{era('all', 0)}</td>
              <td>{era('all', 1)}</td>
              <td>{shift('all')}</td>
            </tr>
            <tr>
              <td>{l('Same seven parties', 'Samma sju partier')}</td>
              <td>{era('core', 0)}</td>
              <td>{era('core', 1)}</td>
              <td>{shift('core')}</td>
            </tr>
            <tr>
              <td>
                {l('Seven parties, same debate', 'Sju partier, samma debatt')}
              </td>
              <td>{era('core_within_debate', 0)}</td>
              <td>{era('core_within_debate', 1)}</td>
              <td>{shift('core_within_debate')}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="welfare-note">
        {l(
          'How to read it: the gap between the first two lines is what a new party’s vocabulary adds (SD from 2010, NyD in 1993/94). The third line compares only speeches in the same debate, where the subject is the same for every party; it sits higher because across debates the subject adds noise rather than signal. If parties drift apart on the same matters, it is the third line that rises. Separability is still not polarization: parties can sound more different because they take different angles, or because being in government changes how one speaks.',
          'Så läser du den: avståndet mellan de två första linjerna är vad ett nytt partis ordförråd tillför (SD från 2010, NyD 1993/94). Den tredje linjen jämför bara tal i samma debatt, där ämnet är detsamma för alla partier; den ligger högre eftersom ämnet mellan debatter tillför brus snarare än signal. Om partierna glider isär i samma frågor är det den tredje linjen som stiger. Särskiljbarhet är ändå inte polarisering: partier kan låta mer olika för att de väljer olika vinklar, eller för att regeringsmakten ändrar hur man talar.',
        )}
      </p>
    </section>
  )
}

function ModelRegister({ models }: { models: ModelCard[] }) {
  return (
    <section
      className="report welfare-section"
      aria-labelledby="analysis-models"
    >
      <p className="eyebrow">{l('Model register', 'Modellregister')}</p>
      <h2 id="analysis-models">
        {l(
          'Every model, including the ones that failed',
          'Alla modeller, även de som underkändes',
        )}
      </h2>
      <p className="welfare-note">
        {l(
          'Each model must pass a gate declared before it is trained. Only a passing model’s results are published as data; the others are listed with the reason, and every card states what the model cannot support.',
          'Varje modell måste klara en grind som bestäms innan den tränas. Bara en godkänd modells resultat publiceras som data; de andra listas med skälet, och varje modellkort säger vad modellen inte kan belägga.',
        )}
      </p>
      <div className="model-grid">
        {models.map((model) => (
          <article className="model-card" key={model.task}>
            <p
              className={`status-badge ${model.gate_passed ? 'ok' : 'failing'}`}
            >
              {model.gate_passed
                ? l('✓ Gate passed', '✓ Godkänd')
                : l('✕ Gate failed', '✕ Underkänd')}
            </p>
            <h3>{model.purpose}</h3>
            <table className="welfare-table compact">
              <tbody>
                {model.results.map((row) => (
                  <tr key={`${row.model}-${row.metric}`}>
                    <td>{row.model}</td>
                    <td>{row.metric}</td>
                    <td>
                      <strong>{number(row.value, 3)}</strong>
                      {row.interval && <small> [{row.interval}]</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {model.limitations[0] && (
              <p className="welfare-note">{model.limitations[0]}</p>
            )}
            <p className="model-foot">
              <code>{model.run_id}</code>
              <a href={model.card_url} target="_blank" rel="noreferrer">
                {l('Model card ↗', 'Modellkort ↗')}
              </a>
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function AnalysisPage() {
  const [panel, setPanel] = useState<PanelRow[]>([])
  const [months, setMonths] = useState<MonthRow[]>([])
  const [ess, setEss] = useState<EssRow[]>([])
  const [polarization, setPolarization] = useState<Polarization | null>(null)
  const [models, setModels] = useState<ModelCard[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<PanelRow[]>('welfare/panel-county-year.json'),
      fetchJson<MonthRow[]>('welfare/national-month.json'),
      fetchJson<EssRow[]>('welfare/ess-countries.json'),
      fetchJson<Polarization>('ml/polarization.json'),
      fetchJson<ModelCard[]>('ml/models.json'),
    ])
      .then(([p, m, e, pol, mod]) => {
        setPanel(p)
        setMonths(m)
        setEss(e)
        setPolarization(pol)
        setModels(mod)
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  return (
    <div className="project-page welfare-page analysis-page">
      <div className="page-lead">
        <p className="eyebrow">{l('Analyses', 'Analyser')}</p>
        <h1>
          {l(
            'What the data show, and what they do not',
            'Vad datan visar, och vad den inte visar',
          )}
        </h1>
        <p>
          {l(
            'Analyses on the welfare data layer and the Riksdag speech corpus: counties compared, Sweden month by month and against its neighbours, and machine-learning models with their evaluation in full. All of it is descriptive.',
            'Analyser på välfärdsdatan och riksdagens talkorpus: län mot län, Sverige månad för månad och mot grannländerna, samt maskininlärningsmodeller med hela sin utvärdering. Allt är beskrivande.',
          )}
        </p>
        <p className="welfare-links">
          <a href="#sweden">{l('Sweden overview →', 'Översikt Sverige →')}</a>
          <a
            href="https://github.com/korv9/anton-portfolio/blob/main/docs/analysis-guide.md"
            target="_blank"
            rel="noreferrer"
          >
            {l('Analysis guide ↗', 'Analysguide ↗')}
          </a>
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      {!error && !panel.length && (
        <div className="loading">{l('Loading…', 'Laddar…')}</div>
      )}
      {panel.length > 0 && <CountySection panel={panel} />}
      {months.length > 0 && <MonthSection months={months} />}
      {ess.length > 0 && <EuropeSection ess={ess} />}
      {polarization && <PolarizationSection data={polarization} />}
      {models.length > 0 && <ModelRegister models={models} />}
    </div>
  )
}
