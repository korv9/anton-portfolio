/**
 * Connections' two pre-registered candidates (docs/sweden-connections-preregistration.md):
 * the matched-neighbour dot plot (3.1), one row per measure with the chosen municipality as the
 * only accent, and the within-municipality change model as a coefficient table (3.2).
 */
import { useState } from 'react'
import { l } from '../i18n'

type Reference = {
  rounds: number
  seed: number
  median: number
  interval_95: [number, number]
}
type Measure = {
  n: number
  median_abs_log_ratio: number
  share_beyond_1_5: number
  reference: Reference
  p: number
  p_holm?: number
  assessment: string
  /** code, name, own rate, neighbours' median, ln(own / median) */
  points?: [string, string, number, number, number][]
}
type MeasureKey = 'visits' | 'service_points'
export type NeighboursResult = {
  measures: Record<MeasureKey, Measure>
  sensitivity: Record<MeasureKey, Measure & { year: number }>
}
type Period = {
  period: [number, number]
  n: number
  coefficients: {
    predictor: 'population' | 'income'
    beta: number
    ci95_county: [number, number]
    p: number
    p_holm?: number
  }[]
}
export type ChangeResult = { periods: Period[]; balanced: Period[] }

const MEASURES: Record<MeasureKey, [string, string]> = {
  visits: ['Visits per inhabitant', 'Besök per invånare'],
  service_points: ['Service points per 10,000', 'Serviceställen per 10 000'],
}
const TICKS = [0.5, 1 / 1.5, 1, 1.5, 2]
const times = (log: number) => `×${Math.exp(log).toFixed(2)}`

export function NeighbourPlot({ result }: { result: NeighboursResult }) {
  const keys = Object.keys(MEASURES) as MeasureKey[]
  const names = new Map(
    keys.flatMap((k) =>
      (result.measures[k].points ?? []).map((p) => [p[0], p[1]]),
    ),
  )
  const options = [...names].sort((a, b) => a[1].localeCompare(b[1], 'sv'))
  const [code, setCode] = useState(options[0]?.[0] ?? '')
  const W = 420
  const ROW = 72
  const H = ROW * keys.length + 24
  const all = keys.flatMap((k) =>
    (result.measures[k].points ?? []).map((p) => p[4]),
  )
  const span = Math.max(Math.log(2.2), ...all.map(Math.abs))
  const px = (v: number) => 10 + ((v + span) / (2 * span)) * (W - 20)
  const chosen = keys.map((k) => ({
    k,
    p: result.measures[k].points?.find((p) => p[0] === code),
  }))
  return (
    <div className="sw-neighbours">
      <div className="sw-controls">
        <label>
          {l('Municipality', 'Kommun')}
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {options.map(([c, name]) => (
              <option key={c} value={c}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <figure className="sw-scatter">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={l(
            "Each municipality's library rates against the median of its five social neighbours, on a log scale.",
            'Varje kommuns bibliotekstal mot medianen för dess fem sociala grannar, på logaritmisk skala.',
          )}
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                className={t === 1 ? undefined : 'sw-ref'}
                x1={px(Math.log(t))}
                x2={px(Math.log(t))}
                y1={16}
                y2={H - 20}
              />
              <text x={px(Math.log(t))} y={H - 6} textAnchor="middle">
                ×{t === 1 / 1.5 ? '0.67' : t}
              </text>
            </g>
          ))}
          {keys.map((k, row) => (
            <g key={k} className="sw-dots">
              <text x={0} y={row * ROW + 12}>
                {l(MEASURES[k][0], MEASURES[k][1])}
              </text>
              {(result.measures[k].points ?? [])
                .map((p, i) => ({ p, y: row * ROW + 22 + ((i * 37) % 41) }))
                // The chosen municipality is drawn last, on top.
                .sort((a, b) => +(a.p[0] === code) - +(b.p[0] === code))
                .map(({ p, y }) => (
                  <circle
                    key={p[0]}
                    className={p[0] === code ? 'is-focal' : undefined}
                    cx={px(p[4])}
                    cy={y}
                    r={p[0] === code ? 4.5 : 2}
                  />
                ))}
            </g>
          ))}
        </svg>
        <figcaption className="sw-note" aria-live="polite">
          {chosen.map(({ k, p }) => (
            <span key={k} className="sw-mono">
              {l(MEASURES[k][0], MEASURES[k][1])}:{' '}
              {p
                ? `${p[2].toFixed(2)} ${l('against a neighbour median of', 'mot grannmedianen')} ${p[3].toFixed(2)} (${times(p[4])})`
                : l('no value', 'inget värde')}
              .{' '}
            </span>
          ))}
          {l(
            'Dashed lines mark 1.5 times above or below the neighbours.',
            'Streckade linjer markerar 1,5 gånger över eller under grannarna.',
          )}
        </figcaption>
      </figure>
      <dl className="sw-info-list">
        {keys.map((k) => {
          const m = result.measures[k]
          const s = result.sensitivity[k]
          return (
            <div key={k}>
              <dt>{l(MEASURES[k][0], MEASURES[k][1])}</dt>
              <dd className="sw-mono">
                {l('typical gap', 'typiskt avstånd')}{' '}
                {times(m.median_abs_log_ratio)}; {l('SKR peers', 'SKR-likar')}{' '}
                {times(m.reference.median)} [{times(m.reference.interval_95[0])}
                , {times(m.reference.interval_95[1])}]; {l('beyond', 'bortom')}{' '}
                ×1.5: {Math.round(m.share_beyond_1_5 * 100)} %; p ={' '}
                {m.p.toFixed(3)} (Holm {m.p_holm?.toFixed(3)}), n = {m.n}.{' '}
                {s.year}: {times(s.median_abs_log_ratio)} {l('against', 'mot')}{' '}
                {times(s.reference.median)}.
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

const PREDICTOR = {
  population: ['Population (Δ ln)', 'Folkmängd (Δ ln)'],
  income: ['Median earned income (Δ ln)', 'Medianinkomst (Δ ln)'],
} as const

export function ChangeTable({ result }: { result: ChangeResult }) {
  const ci = (c: [number, number]) => `[${c[0].toFixed(2)}, ${c[1].toFixed(2)}]`
  const pv = (v = 1) => (v < 0.001 ? '< 0.001' : v.toFixed(3))
  return (
    <div className="sw-table-wrap">
      <table className="sw-table">
        <caption className="sw-note">
          {l(
            'Change in ln visits per unit change in ln population or ln income, the other held constant, with 95 % county-cluster intervals.',
            'Förändring i ln besök per enhets förändring i ln folkmängd eller ln inkomst, den andra konstant, med 95 % länsklustrade intervall.',
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">{l('Period', 'Period')}</th>
            <th scope="col">{l('Predictor', 'Förklaring')}</th>
            <th scope="col">β [95 %]</th>
            <th scope="col">p (Holm)</th>
            <th scope="col">{l('Balanced panel', 'Balanserad panel')}</th>
          </tr>
        </thead>
        <tbody className="sw-mono">
          {result.periods.flatMap((p, i) =>
            p.coefficients.map((c, j) => {
              const b = result.balanced[i].coefficients[j]
              return (
                <tr key={`${p.period[0]}-${c.predictor}`}>
                  <td>
                    {p.period[0]}–{p.period[1]} (n = {p.n})
                  </td>
                  <td>
                    {l(PREDICTOR[c.predictor][0], PREDICTOR[c.predictor][1])}
                  </td>
                  <td>
                    {c.beta.toFixed(2)} {ci(c.ci95_county)}
                  </td>
                  <td>
                    {pv(c.p)} ({pv(c.p_holm)})
                  </td>
                  <td>
                    {b.beta.toFixed(2)} {ci(b.ci95_county)}, n ={' '}
                    {result.balanced[i].n}
                  </td>
                </tr>
              )
            }),
          )}
        </tbody>
      </table>
    </div>
  )
}
