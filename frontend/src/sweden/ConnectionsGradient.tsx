/**
 * Connections' socioeconomic gradient (plan 3.3): the family of partial Spearman ρ with both
 * intervals and Holm values, the joint model, the scatter and the municipalities left out.
 */
import { l } from '../i18n'
import type { Evidence } from './products'

type Estimate = {
  n: number
  partial_rho: number
  ci95_iid: [number, number]
  ci95_county: [number, number]
  p?: number
  p_holm?: number
}
type GradientResult = {
  n: number
  excluded: number
  rho: number
  ci95: [number, number]
  family: (Estimate & { measure: 'income' | 'education'; year: number })[]
  joint: Record<'income' | 'education', Estimate>
  missing: { code: string; name: string; reason: string }[]
  missing_profile: {
    feature: string
    missing_median: number
    included_median: number
  }[]
  points: [string, number, number][]
}
export type Base = {
  id: string
  products: string[]
  question: string
  contract: { geography: string; time: string; missing: string }
  confounders: string[]
  evidence: Evidence
  assessment: 'robust' | 'uncertain' | 'not_supported'
  alternatives: string[]
  specification: string
}
export type Gradient = Base & {
  kind: 'gradient'
  x: { name: string; unit: string; source: string }
  y: { name: string; unit: string; source: string; denominator: string }
  result: GradientResult
}

const MEASURE = {
  income: ['income', 'inkomst'],
  education: ['post-secondary education', 'eftergymnasial utbildning'],
} as const
const FEATURE: Record<string, [string, string]> = {
  log_population: ['Population (log)', 'Folkmängd (log)'],
  median_earned_income_sek: ['Median earned income', 'Medianinkomst'],
  post_secondary_25_64_pct: [
    'Post-secondary, 25–64 (%)',
    'Eftergymnasial, 25–64 (%)',
  ],
  in_commuting_pct: ['In-commuting (%)', 'Inpendling (%)'],
  out_commuting_pct: ['Out-commuting (%)', 'Utpendling (%)'],
}
const ci = (c: [number, number]) => `[${c[0].toFixed(2)}, ${c[1].toFixed(2)}]`

/** The socioeconomic gradient: the family of partial ρ, the joint model and who is missing. */
export function GradientCard({ r }: { r: Gradient }) {
  const res = r.result
  return (
    <>
      <div className="sw-connection-grid">
        <dl className="sw-info-list">
          <div>
            <dt>x</dt>
            <dd>
              {r.x.name} ({r.x.unit}), {r.x.source}
            </dd>
          </div>
          <div>
            <dt>y</dt>
            <dd>
              {r.y.name} ({r.y.unit}), {r.y.source}
            </dd>
          </div>
          <div>
            <dt>{l('Geography', 'Geografi')}</dt>
            <dd>{r.contract.geography}</dd>
          </div>
          <div>
            <dt>{l('Time', 'Tid')}</dt>
            <dd>{r.contract.time}</dd>
          </div>
          <div>
            <dt>{l('Denominator', 'Nämnare')}</dt>
            <dd>{r.y.denominator}</dd>
          </div>
          <div>
            <dt>Spearman ρ</dt>
            <dd className="sw-mono">
              {res.rho.toFixed(2)} {ci(res.ci95)}, n = {res.n}
            </dd>
          </div>
          {res.family.map((e) => (
            <div key={`${e.measure}-${e.year}`}>
              <dt>
                {l(
                  `After removing the linear trend in population rank, ${MEASURE[e.measure][0]} ${e.year}`,
                  `Efter att den linjära trenden i folkmängdens rang tagits bort, ${MEASURE[e.measure][1]} ${e.year}`,
                )}
              </dt>
              <dd className="sw-mono">
                ρ = {e.partial_rho.toFixed(2)} {ci(e.ci95_county)}{' '}
                {l('county', 'län')}, {ci(e.ci95_iid)} iid; p ={' '}
                {e.p?.toFixed(3)} (Holm {e.p_holm?.toFixed(3)}), n = {e.n}
              </dd>
            </div>
          ))}
          <div>
            <dt>
              {l(
                'Joint model: population, commuting and the other measure held constant',
                'Gemensam modell: folkmängd, pendling och det andra måttet konstanta',
              )}
            </dt>
            <dd className="sw-mono">
              {l('income', 'inkomst')} ρ ={' '}
              {res.joint.income.partial_rho.toFixed(2)}{' '}
              {ci(res.joint.income.ci95_county)}; {l('education', 'utbildning')}{' '}
              ρ = {res.joint.education.partial_rho.toFixed(2)}{' '}
              {ci(res.joint.education.ci95_county)}
            </dd>
          </div>
        </dl>
        <Scatter r={r} />
      </div>
      <details>
        <summary>
          {l(
            `The ${res.excluded} municipalities without a visit count`,
            `De ${res.excluded} kommunerna utan besöksantal`,
          )}
        </summary>
        <p>{res.missing.map((m) => `${m.name} (${m.reason})`).join('; ')}.</p>
        <dl className="sw-info-list">
          {res.missing_profile.map((f) => (
            <div key={f.feature}>
              <dt>{l(...(FEATURE[f.feature] ?? [f.feature, f.feature]))}</dt>
              <dd className="sw-mono">
                {l('median', 'median')} {f.missing_median} {l('against', 'mot')}{' '}
                {f.included_median} {l('for the rest', 'för övriga')}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  )
}

/** The relationship's points, with the exact values in the family above. */
function Scatter({ r }: { r: Gradient }) {
  const W = 320
  const H = 240
  const xs = r.result.points.map((p) => p[1])
  const ys = r.result.points.map((p) => p[2])
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const px = (v: number) => 30 + ((v - x0) / (x1 - x0 || 1)) * (W - 40)
  const py = (v: number) => H - 25 - ((v - y0) / (y1 - y0 || 1)) * (H - 35)
  return (
    <figure className="sw-scatter">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${r.y.name} against ${r.x.name}, ${r.result.n} municipalities`}
      >
        <line x1={30} y1={H - 25} x2={W - 10} y2={H - 25} />
        <line x1={30} y1={10} x2={30} y2={H - 25} />
        {r.result.points.map(([code, x, y]) => (
          <circle key={code} cx={px(x)} cy={py(y)} r={2.2} />
        ))}
        <text x={W - 10} y={H - 8} textAnchor="end">
          {r.x.name}
        </text>
        <text x={34} y={18}>
          {r.y.name}
        </text>
      </svg>
      <figcaption className="sw-note">
        {l('Each point is a municipality.', 'Varje punkt är en kommun.')}
      </figcaption>
    </figure>
  )
}
