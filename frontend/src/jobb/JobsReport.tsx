/**
 * The labour-market report: demand, the regional labour market and employment conditions, one
 * question per tab and at most three charts in each. Every chart answers for the occupation
 * fields the reader follows; none chosen means the whole market.
 */
import { useState } from 'react'
import { JOB_TABS, type Route } from '../router'
import ReportShell from '../report/ReportShell'
import { Feature, Pick } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import MultiLineChart from '../charts/MultiLineChart'
import { Stacked } from '../charts/Compare'
import { Select } from '../politik/controls'
import { HeatTable, MonthColumns } from './charts'
import {
  change,
  conditionsOf,
  countyAds,
  fieldName,
  monthShort,
  monthlyAds,
  number,
  occupationsIn,
  pctOf,
  share,
  signedPct,
  yearAds,
  ytdLabel,
  type Market,
} from './data'
import FieldPicker from './FieldPicker'
import { withFields } from './selection'

const SOURCE = (
  <a href="https://data.arbetsformedlingen.se/annonser/historiska/">
    Arbetsförmedlingen, JobTech: historical ads
  </a>
)

const TABS = [
  {
    label: 'Demand',
    question: 'Where do employers want to hire?',
  },
  {
    label: 'Regional labour market',
    question: 'Where in Sweden are the jobs?',
  },
  {
    label: 'Employment conditions',
    question: 'On what terms are people hired?',
  },
].map((tab, i) => ({ ...tab, path: JOB_TABS[i] }))

const DEEPER = [
  {
    href: '#jobb-trender',
    label: 'Ads over time',
    about: 'Month by month, all together or one chart per field',
  },
  {
    href: '#jobb-yrken',
    label: 'Occupations',
    about: 'Every occupation group, growing and falling',
  },
  {
    href: '#job-market-tech',
    label: 'IT and data roles',
    about: 'The tools and languages the ads ask for',
  },
  {
    href: '#jobb-kluster',
    label: 'Ad clusters',
    about: 'Groups a language model finds in the IT ads',
  },
  {
    href: '#jobb-kallor',
    label: 'Sources and method',
    about: 'The archives counted, and how',
  },
]

type Props = { data: Market; fields: string[] }

const nameOf = (data: Market, id: string) =>
  fieldName(data.fields.find((f) => f.id === id)?.name ?? id)

function scopeOf(data: Market, fields: string[]) {
  return fields.length
    ? fields.map((id) => nameOf(data, id)).join(', ')
    : 'the whole market'
}

const yearLabel = (data: Market, y: number) =>
  y === data.latest_year && data.ytd_months < 12 ? `${y}*` : String(y)

function Demand({ data, fields }: Props) {
  const [order, setOrder] = useState<'up' | 'down' | 'most'>('up')
  const latest = data.latest_year
  const period = `${ytdLabel(data.ytd_months)} ${latest}`
  const scope = scopeOf(data, fields)
  const monthly = monthlyAds(data, fields)
  // Growth only for occupations that already had 100 ads, so a few ads cannot top the list.
  const occupations = occupationsIn(data, fields)
    .map((o) => ({
      ...o,
      now: o.ytd[String(latest)] ?? 0,
      before: o.ytd[String(latest - 1)] ?? 0,
    }))
    .filter((o) => o.before >= 100)
    .map((o) => ({ ...o, change: change(o.now, o.before) ?? 0 }))
    .sort((a, b) => b.change - a.change)
  const shown =
    order === 'most'
      ? [...occupations].sort((a, b) => b.now - a.now).slice(0, 10)
      : order === 'down'
        ? occupations.slice(-10).reverse()
        : occupations.slice(0, 10)
  const perField = (fields.length ? fields : data.fields.map((f) => f.id))
    .map((id) => {
      const now = yearAds(data, [id], latest)
      return {
        key: id,
        label: nameOf(data, id),
        value: change(now, yearAds(data, [id], latest - 1)) ?? 0,
        note: number(now),
      }
    })
    .sort((a, b) => b.value - a.value)
  return (
    <>
      <div className="report-main">
        <Feature
          id="annonser"
          title={`New ads per month, ${scope}`}
          table={
            <HeatTable
              rows={(fields.length ? fields : data.fields.map((f) => f.id)).map(
                (id) => ({ key: id, label: nameOf(data, id) }),
              )}
              columns={data.years.map((y) => ({
                key: String(y),
                label: yearLabel(data, y),
              }))}
              value={(id, y) =>
                yearAds(data, [id], Number(y), Number(y) === latest)
              }
              format={number}
              caption="Ads per field and year (* months so far)"
            />
          }
          source={SOURCE}
        >
          <MonthColumns
            months={monthly}
            highlight={`${latest}-01`}
            height={420}
            label={`New job ads per month, ${scope}`}
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="yrken"
          title={
            order === 'most'
              ? `Occupations with the most ads, ${period}`
              : `Occupations against the same months of ${latest - 1}`
          }
          controls={
            <Pick
              label="Order"
              value={order}
              options={[
                { value: 'up', label: 'Growing' },
                { value: 'down', label: 'Falling' },
                { value: 'most', label: 'Most ads' },
              ]}
              onChange={setOrder}
            />
          }
          source={
            <>
              {SOURCE}; SSYK occupation groups with at least 100 ads the year
              before
            </>
          }
        >
          <RankBars
            rows={shown.map((o) => ({
              key: o.id,
              label: o.name,
              value: order === 'most' ? o.now : o.change,
              note: order === 'most' ? signedPct(o.change) : number(o.now),
            }))}
            format={order === 'most' ? number : (v) => signedPct(v)}
            label="Occupations and their ads"
          />
        </Feature>
        <Feature
          id="omraden"
          title={`Fields against the same months of ${latest - 1}`}
          source={
            <>
              {SOURCE}; {period}, number of ads after the bar
            </>
          }
        >
          <RankBars
            rows={perField}
            format={(v) => signedPct(v)}
            label="Change in ads per occupation field"
          />
        </Feature>
      </div>
    </>
  )
}

function Regional({ data, fields }: Props) {
  const [chosen, setChosen] = useState('')
  const latest = data.latest_year
  const year = data.years.includes(Number(chosen)) ? Number(chosen) : latest
  const ytd = year === latest
  const scope = scopeOf(data, fields)
  const of = (y: number) => countyAds(data, fields, y, y === latest)
  const counties = of(year).sort((a, b) => b.ads - a.ads)
  const before = countyAds(data, fields, year - 1, ytd)
  const total = counties.reduce((s, c) => s + c.ads, 0)
  const moved = counties
    .filter((c) => c.region !== 'Okänt län')
    .map((c) => ({
      key: c.region,
      label: c.region,
      value: change(c.ads, before.find((b) => b.region === c.region)?.ads) ?? 0,
      note: number(c.ads),
    }))
    .sort((a, b) => b.value - a.value)
  // The largest counties' share of all ads, year by year.
  const perYear = data.years.map((y) => {
    const rows = of(y)
    return { y, rows, total: rows.reduce((s, c) => s + c.ads, 0) }
  })
  const largest = counties.slice(0, 4).map((c) => c.region)
  return (
    <>
      <div className="report-main">
        <Feature
          id="lan"
          title={`Share of the ads per county, ${scope}`}
          controls={
            <Select
              label="Year"
              value={String(year)}
              options={[...data.years].reverse().map((y) => ({
                value: String(y),
                label:
                  y === latest && data.ytd_months < 12
                    ? `${y} (${ytdLabel(data.ytd_months)})`
                    : String(y),
              }))}
              onChange={setChosen}
            />
          }
          table={
            <HeatTable
              rows={counties.map((c) => ({ key: c.region, label: c.region }))}
              columns={data.years.map((y) => ({
                key: String(y),
                label: yearLabel(data, y),
              }))}
              value={(region, y) =>
                of(Number(y)).find((c) => c.region === region)?.ads
              }
              format={number}
              caption="Ads per county and year (* months so far)"
            />
          }
          source={
            <>
              {SOURCE}; the county is where the workplace is, ads without one
              are left out
            </>
          }
        >
          <RankBars
            rows={counties.map((c) => ({
              key: c.region,
              label: c.region,
              value: pctOf(c.ads, total),
              note: number(c.ads),
            }))}
            format={(v) => share(v, 1)}
            label="Share of ads per county"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="lan-forandring"
          title={`Counties against ${ytd ? 'the same months of ' : ''}${year - 1}`}
          source={<>{SOURCE}; number of ads after the bar</>}
        >
          <RankBars
            rows={moved}
            format={(v) => signedPct(v)}
            label="Change in ads per county"
          />
        </Feature>
        <Feature
          id="lan-andel"
          title="The largest counties’ share, year by year"
          source={<>{SOURCE}; share of all ads with a workplace county</>}
        >
          <MultiLineChart
            series={largest.map((region) => ({
              key: region,
              name: region,
              points: perYear.map(({ y, rows, total }) => ({
                date: `${y}-01-01`,
                label: yearLabel(data, y),
                value: pctOf(
                  rows.find((c) => c.region === region)?.ads ?? 0,
                  total,
                ),
              })),
            }))}
            format={(v) => share(v, 0)}
            colorOf={(key) => largest.indexOf(key) + 1}
            label="Share of ads in the four largest counties per year"
          />
        </Feature>
      </div>
    </>
  )
}

/** The ad forms' employment types, gathered into four kinds that hold over every year. */
const KINDS: { label: string; colour: string; names: string[] }[] = [
  {
    label: 'Regular or permanent',
    colour: 'var(--cv-olive)',
    names: [
      'Vanlig anställning',
      'Tillsvidareanställning (inkl. eventuell provanställning)',
    ],
  },
  {
    label: 'On call',
    colour: 'var(--negative)',
    names: ['Behovsanställning'],
  },
  {
    label: 'Fixed term, seasonal, summer',
    colour: 'var(--cv-apricot)',
    names: [
      'Tidsbegränsad anställning',
      'Säsongsanställning',
      'Sommarjobb / feriejobb',
      'Vikariat',
    ],
  },
]
const HOURS = [
  { label: 'Full time', colour: 'var(--cv-olive)', name: 'Heltid' },
  { label: 'Part time', colour: 'var(--cv-apricot)', name: 'Deltid' },
  { label: 'Not stated', colour: 'var(--cv-oat)', name: 'Okänd' },
]

function Conditions({ data, fields }: Props) {
  const scope = scopeOf(data, fields)
  const latest = data.latest_year
  const years = data.years.map((y) => ({
    y,
    ...conditionsOf(data, fields, y),
  }))
  const kinds = [...KINDS, { label: 'Other', colour: 'var(--cv-oat)' }]
  const employment = years.map(({ y, employment }) => {
    const named = KINDS.map((k) =>
      k.names.reduce((s, n) => s + (employment[n] ?? 0), 0),
    )
    const all = Object.values(employment).reduce((s, v) => s + v, 0)
    return {
      key: String(y),
      label: yearLabel(data, y),
      values: [...named, all - named.reduce((s, v) => s + v, 0)],
    }
  })
  const hours = years.map(({ y, hours }) => ({
    key: String(y),
    label: yearLabel(data, y),
    values: HOURS.map((h) => hours[h.name] ?? 0),
  }))
  const experience = (fields.length ? fields : data.fields.map((f) => f.id))
    .map((id) => {
      const e = conditionsOf(data, [id], latest).experience
      const yes = e['yes'] ?? 0
      return {
        key: id,
        label: nameOf(data, id),
        value: pctOf(yes, yes + (e['no'] ?? 0)),
        note: number(yes),
      }
    })
    .sort((a, b) => b.value - a.value)
  return (
    <>
      <div className="report-main">
        <Feature
          id="anstallning"
          title={`Kind of employment in the ads, ${scope}`}
          source={
            <>{SOURCE}; as the employer entered it in the ad, * months so far</>
          }
        >
          <Stacked
            rows={employment}
            parts={kinds}
            format={number}
            label="Share of ads per kind of employment and year"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="arbetstid"
          title="Full time and part time"
          source={<>{SOURCE}; share of the ads per year</>}
        >
          <Stacked
            rows={hours}
            parts={HOURS}
            format={number}
            label="Share of ads per working hours and year"
          />
        </Feature>
        <Feature
          id="erfarenhet"
          title={`Ads that ask for experience, ${latest}`}
          source={
            <>
              {SOURCE}; share of the ads per field, number of ads after the bar
            </>
          }
        >
          <RankBars
            rows={experience}
            format={(v) => share(v)}
            max={100}
            label="Share of ads that require experience, per field"
          />
        </Feature>
      </div>
    </>
  )
}

export default function JobsReport({
  route,
  data,
  fields,
}: Props & { route: Route }) {
  const Body = [Demand, Regional, Conditions][
    Math.max(0, JOB_TABS.indexOf(route.path))
  ]
  return (
    <ReportShell
      name="Labour Market Observatory"
      intro={`Every job ad in Arbetsförmedlingen’s archive since ${data.years[0]}, counted by month, occupation, county and terms. Latest month: ${monthShort(data.last_month)}.`}
      tabs={TABS}
      path={route.path}
      hrefOf={(p) => withFields(p, fields)}
      slicerLabel="Follow fields"
      slicer={<FieldPicker route={route} data={data} />}
      deeper={DEEPER}
    >
      <Body data={data} fields={fields} />
    </ReportShell>
  )
}
