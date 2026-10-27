/** The latest welfare headline figures: population and the labour market. */
import { Frame, tx, useData, type Post } from '../kit'
import { Kpi, fmt, month, num, signed } from './wel-kit'
import { l } from '../../i18n'
import { count } from '../../format'

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
    label: ['Unemployed, % of labour force', 'Arbetslösa, % av arbetskraften'],
    change: [' points', ' procentenheter'],
  },
  {
    key: 'aku_employment_rate_sa',
    unit: '%',
    label: ['Employed, % of ages 15–74', 'Sysselsatta, % av 15–74 år'],
    change: [' points', ' procentenheter'],
  },
  {
    key: 'fk_sick_pay_rate',
    unit: ['days', 'dagar'],
    label: ['Sick-pay days per insured', 'Sjukpenningdagar per försäkrad'],
    change: [' days', ' dagar'],
  },
] as const

function Labour() {
  return (
    <Frame data={useHeadlines()}>
      {(rows) => (
        <div className="mean-wel-grid">
          {LABOUR.map((m) => {
            const h = find(rows, m.key)
            if (!h) return null
            return (
              <Kpi
                key={m.key}
                value={fmt(h.value, 1)}
                unit={tx(m.unit)}
                label={`${tx(m.label)}, ${month(h.period_label)}`}
                delta={
                  num(h.previous_value)
                    ? signed(h.value - h.previous_value, tx(m.change))
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
            value={count(h.value)}
            label={l('Registered residents', 'Folkbokförda invånare')}
            delta={
              num(h.previous_value)
                ? signed(
                    h.value - h.previous_value,
                    l(' people', ' personer'),
                    0,
                  )
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
      return h
        ? l(
            `Sweden's population in ${h.period_label}`,
            `Sveriges befolkning ${h.period_label}`,
          )
        : l('Population', 'Befolkning')
    },
    note: [
      'Source: Statistics Sweden (SCB)',
      'Källa: Statistiska centralbyrån (SCB)',
    ],
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
        ? l(
            `Unemployment was ${fmt(h.value, 1)}% in ${month(h.period_label)}`,
            `Arbetslösheten var ${fmt(h.value, 1)} % i ${month(h.period_label)}`,
          )
        : l('The labour market', 'Arbetsmarknaden')
    },
    note: [
      'Ages 15–74, seasonally adjusted; sick pay from Försäkringskassan. Source: SCB Labour Force Survey',
      '15–74 år, säsongsrensat; sjukpenning från Försäkringskassan. Källa: SCB:s arbetskraftsundersökningar (AKU)',
    ],
    render: () => <Labour />,
  },
]
