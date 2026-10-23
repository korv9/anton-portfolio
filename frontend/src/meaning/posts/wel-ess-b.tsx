/** The latest welfare headline figures: population and the labour market. */
import { Frame, useData, type Post } from '../kit'
import { Kpi, fmt, month, num, signed } from './wel-kit'

type Headline = {
  indicator_key: string
  period_label: string
  value: number
  previous_value: number | null
  previous_period_label: string | null
}

const useHeadlines = () => useData<Headline[]>('welfare/headlines.json')

const find = (rows: Headline[], key: string) =>
  rows.find((r) => r.indicator_key === key)

/** The three labour-market figures, each with its unit and what it counts. */
const LABOUR = [
  {
    key: 'aku_unemployment_rate_sa',
    unit: '%',
    label: 'Unemployed, % of labour force',
    change: ' points',
  },
  {
    key: 'aku_employment_rate_sa',
    unit: '%',
    label: 'Employed, % of ages 15–74',
    change: ' points',
  },
  {
    key: 'fk_sick_pay_rate',
    unit: 'days',
    label: 'Sick-pay days per insured',
    change: ' days',
  },
]

function Labour() {
  return (
    <Frame data={useHeadlines()}>
      {(rows) => (
        <div className="mean-wel-grid">
          {LABOUR.map((l) => {
            const h = find(rows, l.key)
            if (!h) return null
            return (
              <Kpi
                key={l.key}
                value={fmt(h.value, 1)}
                unit={l.unit}
                label={`${l.label}, ${month(h.period_label)}`}
                delta={
                  num(h.previous_value)
                    ? signed(h.value - h.previous_value, l.change)
                    : undefined
                }
                since={
                  h.previous_period_label
                    ? month(h.previous_period_label)
                    : undefined
                }
              />
            )
          })}
        </div>
      )}
    </Frame>
  )
}

function Population() {
  return (
    <Frame data={useHeadlines()}>
      {(rows) => {
        const h = find(rows, 'scb_population')
        return h ? (
          <Kpi
            value={h.value.toLocaleString('en-GB')}
            label="Registered residents"
            delta={
              num(h.previous_value)
                ? signed(h.value - h.previous_value, ' people', 0)
                : undefined
            }
            since={h.previous_period_label ?? undefined}
          />
        ) : null
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-population-kpi',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    title: (rows: Headline[]) => {
      const h = find(rows, 'scb_population')
      return h ? `Sweden's population in ${h.period_label}` : 'Population'
    },
    note: 'Source: Statistics Sweden (SCB)',
    render: () => <Population />,
  },
  {
    id: 'wel-aku-grid',
    domain: 'welfare',
    sources: ['welfare/headlines.json'],
    size: 'wide',
    title: (rows: Headline[]) => {
      const h = find(rows, 'aku_unemployment_rate_sa')
      return h
        ? `Unemployment was ${fmt(h.value, 1)}% in ${month(h.period_label)}`
        : 'The labour market'
    },
    note: 'Ages 15–74, seasonally adjusted; sick pay from Försäkringskassan. Source: SCB Labour Force Survey',
    render: () => <Labour />,
  },
]
