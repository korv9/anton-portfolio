/**
 * The 21 counties as small multiples: one small chart per county, all on the same axis, so the
 * shapes can be compared at a glance. The grey line in every chart is the population-weighted
 * average of all counties. Hover a year in any chart to read that year in every county.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { Feature, Pick, useWidth } from '../charts/feature/Feature'
import type { CountyYear } from './data'

type Key =
  'unemployment_rate_pct' | 'stress_cases_per_1000' | 'sick_pay_rate_days'
const MEASURES: {
  key: Key
  en: string
  sv: string
  unit: string
  digits: number
  source: string
}[] = [
  {
    key: 'unemployment_rate_pct',
    en: 'Unemployment',
    sv: 'Arbetslöshet',
    unit: '%',
    digits: 1,
    source: l(
      'SCB, Labour Force Survey (AKU), ages 15–74',
      'SCB, Arbetskraftsundersökningen (AKU), 15–74 år',
    ),
  },
  {
    key: 'stress_cases_per_1000',
    en: 'Stress-related sick leave',
    sv: 'Stressrelaterad sjukskrivning',
    unit: l('new cases per 1,000', 'nya fall per 1 000'),
    digits: 1,
    source: l(
      'Försäkringskassan, started sick-leave cases with a stress diagnosis (F43) per 1,000 inhabitants',
      'Försäkringskassan, påbörjade sjukfall med stressdiagnos (F43) per 1 000 invånare',
    ),
  },
  {
    key: 'sick_pay_rate_days',
    en: 'Sickness benefit days',
    sv: 'Sjukpenningtal',
    unit: l('days', 'dagar'),
    digits: 1,
    source: l(
      'Försäkringskassan, sickness benefit rate (sjukpenningtal 2.0), December',
      'Försäkringskassan, sjukpenningtal 2.0, december',
    ),
  },
]
const fmt = (v: number, d: number) =>
  v.toLocaleString(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

export default function CountyMultiples({ rows }: { rows: CountyYear[] }) {
  const [key, setKey] = useState<Key>('unemployment_rate_pct')
  const [year, setYear] = useState<number | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  if (!rows.length) return null
  const m = MEASURES.find((x) => x.key === key)!
  const valued = rows.filter((r) => r[key] != null)
  const years = [...new Set(valued.map((r) => r.year))].sort((a, b) => a - b)
  if (years.length < 2) return null
  const last = years.at(-1)!
  const counties = [...new Set(valued.map((r) => r.region_code))]
  const v = (code: string, y: number) =>
    valued.find((r) => r.region_code === code && r.year === y)?.[key] as
      number | undefined
  const avg = (y: number) => {
    const at = valued.filter((r) => r.year === y && r.population)
    const pop = at.reduce((s, r) => s + (r.population ?? 0), 0)
    return pop
      ? at.reduce((s, r) => s + (r[key] as number) * (r.population ?? 0), 0) /
          pop
      : undefined
  }
  const nameOf = (code: string) =>
    valued
      .find((r) => r.region_code === code)
      ?.region_name.replace(/ län$/, '') ?? code
  const fullName = (code: string) =>
    valued.find((r) => r.region_code === code)?.region_name ?? code
  const sorted = [...counties].sort(
    (a, b) => (v(b, last) ?? -1) - (v(a, last) ?? -1),
  )
  const ranked = sorted.filter((c) => v(c, last) != null)
  if (!ranked.length) return null
  const top = Math.max(...valued.map((r) => r[key] as number)) * 1.05
  const cols = width < 480 ? 3 : width < 800 ? 4 : 7
  const cw = (width - (cols - 1) * 10) / cols
  const ch = 64
  const x = (y: number) => 2 + ((y - years[0]) / (last - years[0])) * (cw - 4)
  const yv = (val: number) => ch - 2 - (val / top) * (ch - 6)
  const line = (get: (y: number) => number | undefined) =>
    years
      .map((y) => [y, get(y)] as const)
      .filter((p): p is readonly [number, number] => p[1] != null)
      .map(
        ([y, val], i) =>
          `${i ? 'L' : 'M'}${x(y).toFixed(1)} ${yv(val).toFixed(1)}`,
      )
      .join(' ')
  const at = year ?? last
  const highest = ranked[0]
  const lowest = ranked.at(-1)!
  const national = avg(last)

  return (
    <Feature
      id="lanen"
      title={l(
        `${m.en} ${last}: highest in ${fullName(highest)} (${fmt(v(highest, last)!, m.digits)}), lowest in ${fullName(lowest)} (${fmt(v(lowest, last)!, m.digits)}).`,
        `${m.sv} ${last}: högst i ${fullName(highest)} (${fmt(v(highest, last)!, m.digits)}), lägst i ${fullName(lowest)} (${fmt(v(lowest, last)!, m.digits)}).`,
      )}
      lead={l(
        `One small chart per county, ${years[0]}–${last}, all on the same axis (0–${fmt(top, 0)} ${m.unit}), sorted by the latest value. The grey line is the population-weighted average of the counties${national != null ? `, ${fmt(national, m.digits)} in ${last}` : ''}. Hover a year to read it in every county.`,
        `Ett litet diagram per län, ${years[0]}–${last}, alla på samma axel (0–${fmt(top, 0)} ${m.unit}), sorterade efter senaste värdet. Den grå linjen är länens befolkningsvägda snitt${national != null ? `, ${fmt(national, m.digits)} ${last}` : ''}. Håll över ett år för att läsa det i alla län.`,
      )}
      controls={
        <Pick
          label={l('Measure', 'Mått')}
          value={key}
          options={MEASURES.map((x) => ({
            value: x.key,
            label: l(x.en, x.sv),
          }))}
          onChange={(k) => {
            setKey(k)
            setYear(null)
          }}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('County', 'Län')}</th>
              {years.map((y) => (
                <th key={y} className="num">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c}>
                <td>{nameOf(c)}</td>
                {years.map((y) => (
                  <td key={y} className="num">
                    {v(c, y) != null ? fmt(v(c, y)!, m.digits) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={m.source}
    >
      <div
        className="multiples"
        ref={ref}
        style={{ ['--cols' as string]: cols }}
        onMouseLeave={() => setYear(null)}
      >
        {sorted.map((c, i) => {
          const val = v(c, at)
          const ref0 = avg(at)
          return (
            <figure
              key={c}
              className="multiple"
              style={{ ['--i' as string]: i }}
            >
              <figcaption>
                <span>{nameOf(c)}</span>
                <b
                  className={
                    val != null && ref0 != null
                      ? val > ref0
                        ? 'above'
                        : 'below'
                      : ''
                  }
                >
                  {val != null ? fmt(val, m.digits) : '–'}
                </b>
              </figcaption>
              <svg
                width={cw}
                height={ch}
                role="img"
                aria-label={`${nameOf(c)} ${at}: ${val != null ? fmt(val, m.digits) : '–'}`}
                onPointerMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  const px = e.clientX - r.left
                  let best = years[0]
                  for (const y of years)
                    if (Math.abs(x(y) - px) < Math.abs(x(best) - px)) best = y
                  setYear(best)
                }}
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  const px = e.clientX - r.left
                  let best = years[0]
                  for (const y of years)
                    if (Math.abs(x(y) - px) < Math.abs(x(best) - px)) best = y
                  setYear(best)
                }}
              >
                <line
                  className="multiple-base"
                  x1={0}
                  x2={cw}
                  y1={ch - 2}
                  y2={ch - 2}
                />
                <path className="multiple-avg" d={line(avg)} />
                <path className="multiple-line" d={line((y) => v(c, y))} />
                {val != null && (
                  <circle
                    className="multiple-dot"
                    cx={x(at)}
                    cy={yv(val)}
                    r={3}
                  />
                )}
                {year != null && (
                  <line
                    className="multiple-cross"
                    x1={x(at)}
                    x2={x(at)}
                    y1={0}
                    y2={ch - 2}
                  />
                )}
              </svg>
            </figure>
          )
        })}
      </div>
      <p className="multiples-year" aria-live="polite">
        {l('Showing', 'Visar')} <b>{at}</b>
        {year == null && l(' (latest year)', ' (senaste året)')}
      </p>
    </Feature>
  )
}
