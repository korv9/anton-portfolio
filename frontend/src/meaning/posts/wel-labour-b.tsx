/** Sick leave by diagnosis over time, and unemployment and stress by county. */
import { Frame, focal, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { yearTicks } from '../../charts/scales'
import {
  CountyRank,
  county,
  latestCounties,
  type CountyMetric,
  type CountyYear,
} from './wel-charts'
import { Svg, axis, fmt, month, num, path, pct, scale } from './wel-kit'

type Month = {
  month_start: string
  psychiatric_share_of_started_12m_pct: number | null
}

const psych = (rows: Month[]) =>
  rows.filter((d) => num(d.psychiatric_share_of_started_12m_pct))

function PsychShare() {
  return (
    <Frame data={useData<Month[]>('welfare/national-month.json')}>
      {(rows) => {
        const r = psych(rows)
        const v = r.map((d) => d.psychiatric_share_of_started_12m_pct!)
        const ax = axis(v, [176, 12])
        const x = scale([0, r.length - 1], [30, 250])
        if (!v.length) return null
        return (
          <Svg label="Psychiatric diagnoses as a share of new sick-leave cases, rolling 12 months">
            <YAxis
              y={ax.y}
              ticks={ax.ticks}
              x0={30}
              x1={250}
              format={(t) => `${t}%`}
            />
            <path
              d={path(v.map((d, i) => [x(i), ax.y(d)]))}
              fill="none"
              stroke={focal(true)}
              strokeWidth={2}
            />
            <EndLabels
              x={255}
              top={12}
              bottom={176}
              items={[{ y: ax.y(v.at(-1)!), label: pct(v.at(-1)!, 0) }]}
            />
            <XAxis
              x={(i) => x(i)}
              y={194}
              ticks={yearTicks(r.map((d) => d.month_start))
                .filter((t) => +t.label % 5 === 0)
                .map((t) => ({ value: t.index, label: t.label }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

const METRICS: Record<string, CountyMetric> = {
  unemployment: {
    field: 'unemployment_rate_pct',
    format: (v) => pct(v),
    name: 'unemployment, % of the labour force',
  },
  stress: {
    field: 'stress_cases_per_1000',
    format: (v) => fmt(v, 1),
    name: 'new stress-related sick-leave cases per 1,000 inhabitants',
  },
}

function CountyBars() {
  return (
    <Frame data={useData<CountyYear[]>('welfare/panel-county-year.json')}>
      {(rows) => <CountyRank rows={rows} metrics={METRICS} />}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-psych-share',
    domain: 'welfare',
    sources: ['welfare/national-month.json'],
    title: (rows: Month[]) => {
      const r = psych(rows).at(-1)
      return r
        ? `Psychiatric diagnoses: ${pct(r.psychiatric_share_of_started_12m_pct!, 0)} of new sick-leave cases in the year to ${month(r.month_start.slice(0, 7))}`
        : 'Psychiatric diagnoses in new sick leave'
    },
    note: 'Share of cases started, rolling 12 months. Source: Försäkringskassan',
    render: () => <PsychShare />,
  },
  {
    id: 'wel-county-heat',
    domain: 'welfare',
    sources: ['welfare/panel-county-year.json'],
    size: 'tall',
    title: (rows: CountyYear[]) => {
      const { year, counties } = latestCounties(
        rows,
        METRICS.unemployment.field,
      )
      return year !== null && counties.length
        ? `${county(counties[0].region_name)} had the highest unemployment of the counties in ${year}`
        : 'Unemployment by county'
    },
    note: '% of the labour force aged 15–74; tick: Sweden as a whole. Source: SCB Labour Force Survey',
    render: () => <CountyBars />,
  },
]
