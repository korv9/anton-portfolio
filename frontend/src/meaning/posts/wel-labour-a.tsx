/** The labour market and new sick leave, national by month. */
import { useState } from 'react'
import { Frame, OTHER, Slicer, focal, tx, useData, type Post } from '../kit'
import { EndLabels, XAxis, YAxis } from '../axes'
import { yearTicks } from '../../charts/scales'
import { Svg, axis, fmt, month, num, path, pct, scale } from './wel-kit'
import { l } from '../../i18n'

type Month = {
  month_start: string
  unemployment_rate_sa: number | null
  unemployment_rate_trend: number | null
  unemployment_rate: number | null
  employment_rate_sa: number | null
  started_cases: number | null
  started_psychiatric: number | null
  started_stress: number | null
}

type Key = keyof Omit<Month, 'month_start'>

/** Each series' direct label; the first of a set is the focal line. */
const SETS: Record<
  'unemployment' | 'employment',
  [Key, readonly [string, string]][]
> = {
  unemployment: [
    ['unemployment_rate_trend', ['Trend', 'Trend']],
    ['unemployment_rate_sa', ['Adjusted', 'Säsongsrensad']],
    ['unemployment_rate', ['Unadjusted', 'Ej rensad']],
  ],
  employment: [['employment_rate_sa', ['Adjusted', 'Säsongsrensad']]],
}
const MEASURE = {
  unemployment: ['Unemployment', 'Arbetslöshet'],
  employment: ['Employment', 'Sysselsättning'],
} as const

const useMonths = () => useData<Month[]>('welfare/national-month.json')

/** A year tick every `every` years, from the series' first January. */
const ticks = (dates: string[], x: (i: number) => number, every: number) =>
  yearTicks(dates)
    .filter((t) => +t.label % every === 0)
    .map((t) => ({ value: x(t.index), label: t.label }))

function UnemploymentLines() {
  const data = useMonths()
  const [m, setM] = useState<'unemployment' | 'employment'>('unemployment')
  return (
    <Frame data={data}>
      {(rows) => {
        const set = SETS[m]
        const r = rows.filter((d) => num(d[set[0][0]]))
        const ax = axis(
          r.flatMap((d) => set.map(([k]) => d[k]).filter(num)),
          [196, 12],
          false,
        )
        const x = scale([0, r.length - 1], [32, 470])
        const last = r.at(-1)
        if (!last) return null
        return (
          <>
            <Slicer
              label={l('Measure', 'Mått')}
              options={['unemployment', 'employment'] as const}
              format={(o) => tx(MEASURE[o])!}
              value={m}
              onChange={setM}
            />
            <Svg
              w={600}
              h={220}
              label={l(
                `Monthly ${m} rate in Sweden, %`,
                `${tx(MEASURE[m])} i Sverige per månad, %`,
              )}
            >
              <YAxis
                y={ax.y}
                ticks={ax.ticks}
                x0={32}
                x1={470}
                format={(v) => pct(v, 0)}
              />
              {[...set].reverse().map(([k]) => (
                <path
                  key={k}
                  d={path(
                    r
                      .map((d, i) => [i, d[k]] as const)
                      .filter(([, v]) => num(v))
                      .map(([i, v]) => [x(i), ax.y(v!)]),
                  )}
                  fill="none"
                  stroke={focal(k === set[0][0])}
                  strokeWidth={k === set[0][0] ? 2.4 : 1}
                  opacity={k === 'unemployment_rate' ? 0.6 : 1}
                />
              ))}
              <EndLabels
                x={476}
                top={12}
                bottom={196}
                items={set
                  .filter(([k]) => num(last[k]))
                  .map(([k, label]) => ({
                    y: ax.y(last[k]!),
                    label: `${l(...label)} ${pct(last[k]!)}`,
                    color: k === set[0][0] ? undefined : 'var(--mean-muted)',
                  }))}
              />
              <XAxis
                x={(v) => v}
                y={214}
                ticks={ticks(
                  r.map((d) => d.month_start),
                  x,
                  5,
                )}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

/** Started cases split into three non-overlapping groups of diagnoses. */
const CAUSES = [
  [['Stress-related', 'Stressrelaterade'], (d: Month) => d.started_stress!],
  [
    ['Other psychiatric', 'Övriga psykiatriska'],
    (d: Month) => d.started_psychiatric! - d.started_stress!,
  ],
  [
    ['Other diagnoses', 'Övriga diagnoser'],
    (d: Month) => d.started_cases! - d.started_psychiatric!,
  ],
] as const

function SickLines() {
  return (
    <Frame data={useMonths()}>
      {(rows) => {
        // Months where the parts do not nest (stress within psychiatric within all) are left
        // out, so the three groups stay non-overlapping.
        const r = rows.filter(
          (d) =>
            num(d.started_cases) &&
            num(d.started_psychiatric) &&
            num(d.started_stress) &&
            d.started_stress <= d.started_psychiatric &&
            d.started_psychiatric <= d.started_cases,
        )
        const ax = axis(
          r.flatMap((d) => CAUSES.map(([, f]) => f(d))),
          [196, 12],
        )
        const x = scale([0, r.length - 1], [36, 470])
        const last = r.at(-1)
        if (!last) return null
        return (
          <Svg
            w={600}
            h={220}
            label={l(
              'New sick-leave cases per month by group of diagnoses, Sweden',
              'Nya sjukfall per månad efter diagnosgrupp, Sverige',
            )}
          >
            <YAxis
              y={ax.y}
              ticks={ax.ticks}
              x0={36}
              x1={470}
              format={(v) => fmt(v)}
            />
            {CAUSES.map(([name, f], j) => (
              <path
                key={name[0]}
                d={path(r.map((d, i) => [x(i), ax.y(f(d))]))}
                fill="none"
                stroke={j === 0 ? focal(true) : OTHER}
                strokeWidth={j === 0 ? 1.8 : 1}
              />
            ))}
            <EndLabels
              x={476}
              top={12}
              bottom={196}
              items={CAUSES.map(([name, f], j) => ({
                y: ax.y(f(last)),
                label: tx(name)!,
                color: j ? 'var(--mean-muted)' : undefined,
              }))}
            />
            <XAxis
              x={(v) => v}
              y={214}
              ticks={ticks(
                r.map((d) => d.month_start),
                x,
                5,
              )}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'wel-unemployment-lines',
    domain: 'welfare',
    sources: ['welfare/national-month.json'],
    size: 'wide',
    title: (rows: Month[]) => {
      const r = rows.filter((d) => num(d.unemployment_rate_trend)).at(-1)
      return r
        ? l(
            `The unemployment trend stood at ${pct(r.unemployment_rate_trend!)} in ${month(r.month_start.slice(0, 7))}`,
            `Arbetslöshetens trend låg på ${pct(r.unemployment_rate_trend!)} i ${month(r.month_start.slice(0, 7))}`,
          )
        : l(
            'Unemployment in Sweden, by month',
            'Arbetslösheten i Sverige per månad',
          )
    },
    note: [
      'Monthly, ages 15–74; adjusted means seasonally adjusted. Source: SCB Labour Force Survey',
      'Per månad, 15–74 år. Källa: SCB:s arbetskraftsundersökningar (AKU)',
    ],
    render: () => <UnemploymentLines />,
  },
  {
    id: 'wel-sick-stream',
    domain: 'welfare',
    sources: ['welfare/national-month.json'],
    size: 'wide',
    title: [
      'New sick-leave cases per month, by group of diagnoses',
      'Nya sjukfall per månad, efter diagnosgrupp',
    ],
    note: [
      'Cases started per month; the peak is March 2020, as covid-19 arrived. Source: Försäkringskassan',
      'Påbörjade fall per månad; toppen är mars 2020, när covid-19 kom. Källa: Försäkringskassan',
    ],
    render: () => <SickLines />,
  },
]
