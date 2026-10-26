/** Jobs: the ad market over time, from market.json's monthly, daily and archive counts. */
import { useState } from 'react'
import { focal, Frame, OTHER, Slicer, useData, type Post } from '../kit'
import { EndLabels, YAxis } from '../axes'
import { linearScale, niceTicks, yearTicks } from '../../charts/scales'
import {
  compact,
  D,
  fieldName,
  linePath,
  MARKET,
  sum,
  Svg,
  XLabels,
  type Market,
} from './job-kit'
import { l } from '../../i18n'

/** The fields with the most ads over all months, biggest first. */
const topFields = (m: Market, n: number) =>
  m.fields
    .map((f) => ({
      ...f,
      total: sum((m.monthly[f.id] ?? []).map((r) => r[1])),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)

function MonthlyLine() {
  const data = useData<Market>(MARKET)
  const [field, setField] = useState('all')
  return (
    <Frame data={data}>
      {(m) => {
        const tops = topFields(m, 7)
        const id = tops.some((f) => f.id === field) ? field : 'all'
        const name = (k: string) =>
          k === 'all'
            ? l('All fields', 'Alla yrkesområden')
            : fieldName(tops.find((f) => f.id === k)?.name ?? k)
        const rows = m.monthly[id] ?? []
        if (!rows.length) return null
        const W = 600,
          H = 220,
          L = 40,
          R = 516,
          B = 196
        const x = linearScale([0, rows.length - 1], [L, R])
        const ticks = niceTicks(Math.max(1, ...rows.map((r) => r[2])))
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const ads = rows.map((r, i) => [x(i), y(r[1])] as [number, number])
        const vac = rows.map((r, i) => [x(i), y(r[2])] as [number, number])
        return (
          <>
            <Slicer
              label={l('Field', 'Yrkesområde')}
              options={['all', ...tops.map((f) => f.id)]}
              format={(k) => (k === 'all' ? l('All', 'Alla') : name(k))}
              value={id}
              onChange={setField}
            />
            <p className="mean-cap">{name(id)}</p>
            <Svg
              w={W}
              h={H}
              label={l(
                `Job ads and vacancies per month, ${name(id).toLowerCase()}`,
                `Platsannonser och lediga jobb per månad, ${name(id).toLowerCase()}`,
              )}
            >
              <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
              <path
                d={linePath(vac)}
                fill="none"
                stroke={OTHER}
                strokeWidth={1.5}
              />
              <path
                d={linePath(ads)}
                fill="none"
                stroke={focal(true)}
                strokeWidth={2}
              />
              <EndLabels
                x={R + 6}
                top={10}
                bottom={B}
                items={[
                  {
                    y: vac.at(-1)![1],
                    label: l('vacancies', 'lediga jobb'),
                    color: 'var(--mean-muted)',
                  },
                  {
                    y: ads.at(-1)![1],
                    label: l('ads', 'annonser'),
                    color: focal(true),
                  },
                ]}
              />
              <XLabels
                y={H - 4}
                items={yearTicks(rows.map((r) => r[0])).map((t) => ({
                  x: x(t.index),
                  label: t.label,
                }))}
              />
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

const MONTHS = 'JFMAMJJASOND'.split('')

/** Monthly ads for the last six years, one line each; the latest year is the focal one. */
function Calendar() {
  const data = useData<Market>(MARKET)
  return (
    <Frame data={data}>
      {(m) => {
        const rows = m.monthly.all ?? []
        if (!rows.length) return null
        const years = m.years.slice(-6)
        const ticks = niceTicks(Math.max(1, ...rows.map((r) => r[1])))
        const W = 300,
          H = 220,
          L = 34,
          R = 252,
          B = 196
        const x = linearScale([1, 12], [L + 4, R])
        const y = linearScale([0, ticks.at(-1)!], [B, 10])
        const line = (yr: number) =>
          rows
            .filter((r) => Number(r[0].slice(0, 4)) === yr)
            .map(
              (r) => [x(Number(r[0].slice(5, 7))), y(r[1])] as [number, number],
            )
        const latest = years.at(-1)
        return (
          <Svg
            w={W}
            h={H}
            label={l(
              'Job ads per month, one line per year',
              'Platsannonser per månad, en linje per år',
            )}
          >
            <YAxis ticks={ticks} y={y} x0={L} x1={R} format={compact} />
            {years.map((yr) => (
              <path
                key={yr}
                d={linePath(line(yr))}
                fill="none"
                stroke={focal(yr === latest)}
                strokeWidth={yr === latest ? 2.5 : 1.25}
              >
                <title>{String(yr)}</title>
              </path>
            ))}
            <EndLabels
              x={R + 6}
              top={10}
              bottom={B}
              items={years.flatMap((yr) => {
                const end = line(yr).at(-1)
                return end
                  ? [
                      {
                        y: end[1],
                        label: String(yr),
                        color:
                          yr === latest ? focal(true) : 'var(--mean-muted)',
                      },
                    ]
                  : []
              })}
            />
            <XLabels
              y={H - 4}
              items={MONTHS.map((c, i) => ({ x: x(i + 1), label: c }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'job-monthly-line',
    domain: D,
    sources: ['jobs/market.json'],
    size: 'wide',
    title: [
      'Job ads and the vacancies they list, per month',
      'Platsannonser och de lediga jobb de listar, per månad',
    ],
    note: [
      'One ad can list several vacancies; 2020 on, Arbetsförmedlingen',
      'En annons kan gälla flera lediga jobb; från 2020, Arbetsförmedlingen',
    ],
    render: () => <MonthlyLine />,
  },
  {
    id: 'job-calendar',
    domain: D,
    sources: ['jobs/market.json'],
    title: [
      'Job ads per month, one line per year',
      'Platsannonser per månad, en linje per år',
    ],
    note: [
      'New ads published each month, the last six years; the latest year runs to the latest full month',
      'Nya annonser publicerade varje månad, de senaste sex åren; senaste året går till senaste hela månaden',
    ],
    render: () => <Calendar />,
  },
]
