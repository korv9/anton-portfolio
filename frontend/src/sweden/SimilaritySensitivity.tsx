/**
 * C's sensitivity checks under Method (groups.json `sensitivity`, written by
 * platform/publish/sweden/similarity_checks.py): neighbours under other definitions, the groups
 * refitted on earlier years, and outcomes outside the 12 indicators against shuffles.
 */
import { l } from '../i18n'

type Interval = { rho: number; ci95: [number, number] }
export type Sensitivity = {
  copula_null: {
    rounds: number
    silhouette_95: Record<string, number>
    share_at_least_observed: Record<string, number>
  }
  neighbours: {
    variants: {
      variant: string
      median_jaccard: number
      first_neighbour_changed: number
    }[]
  }
  temporal: {
    reference_year: number
    years: { year: number; n: number; ari_k2: number; ari_k4: number }[]
  }
  outcomes: {
    rounds: number
    results: {
      outcome: string
      split: string
      n: number
      eta_squared: number
      null_95: number
      p_holm: number
    }[]
  }
  centre_periphery: {
    variants: { all_12: Interval; without_log_population: Interval }
    rounds: number
  }
  skr_typology: {
    indicators: string[]
    share: number
    ci95: [number, number]
    null_95: number
  }
}

const VARIANTS: Record<string, [string, string]> = {
  without_log_population: ['Without population', 'Utan folkmängd'],
  without_commuting: [
    'Without in- and out-commuting',
    'Utan in- och utpendling',
  ],
  pca_space: ['Four principal components', 'Fyra principalkomponenter'],
  mahalanobis: ['Mahalanobis distance', 'Mahalanobisavstånd'],
}
const OUTCOMES: Record<string, [string, string]> = {
  library_visits_per_inhabitant: [
    'Library visits per inhabitant, 2024',
    'Biblioteksbesök per invånare, 2024',
  ],
  library_service_points_per_10k: [
    'Library service points per 10,000, 2024',
    'Biblioteksserviceställen per 10 000, 2024',
  ],
}
const outcomeName = (id: string) => {
  const party = id.match(/^share_(\w+)_pct$/)?.[1]
  return party
    ? l(
        `${party.toUpperCase()} share, 2022 election`,
        `${party.toUpperCase()}:s andel, valet 2022`,
      )
    : l(...(OUTCOMES[id] ?? [id, id]))
}
const pct = (v: number) => `${Math.round(v * 100)} %`

export default function SimilaritySensitivity({ s }: { s: Sensitivity }) {
  const ids = [...new Set(s.outcomes.results.map((r) => r.outcome))]
  const cell = (id: string, split: string) =>
    s.outcomes.results.find((r) => r.outcome === id && r.split === split)
  return (
    <>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l(
              'Five nearest neighbours under another definition, against all 12 indicators',
              'Fem närmaste grannar med en annan definition, mot alla 12 indikatorer',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Definition', 'Definition')}</th>
              <th scope="col" className="sw-n">
                {l('Median overlap (Jaccard)', 'Median överlapp (Jaccard)')}
              </th>
              <th scope="col" className="sw-n">
                {l('Nearest neighbour changes', 'Närmaste granne byts')}
              </th>
            </tr>
          </thead>
          <tbody>
            {s.neighbours.variants.map((v) => (
              <tr key={v.variant}>
                <th scope="row">
                  {l(...(VARIANTS[v.variant] ?? [v.variant, v.variant]))}
                </th>
                <td className="sw-n">{v.median_jaccard.toFixed(2)}</td>
                <td className="sw-n">{pct(v.first_neighbour_changed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l(
              `The groups refitted on an earlier year, agreement with ${s.temporal.reference_year} (ARI)`,
              `Grupperna anpassade på ett tidigare år, överensstämmelse med ${s.temporal.reference_year} (ARI)`,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Year', 'År')}</th>
              <th scope="col" className="sw-n">
                n
              </th>
              <th scope="col" className="sw-n">
                k = 2
              </th>
              <th scope="col" className="sw-n">
                k = 4
              </th>
            </tr>
          </thead>
          <tbody>
            {s.temporal.years.map((y) => (
              <tr key={y.year}>
                <th scope="row">{y.year}</th>
                <td className="sw-n">{y.n}</td>
                <td className="sw-n">{y.ari_k2.toFixed(2)}</td>
                <td className="sw-n">{y.ari_k4.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l(
              `Variables outside the 12 indicators: share of variance between groups (η²), against ${s.outcomes.rounds} shuffles; p after Holm over the table`,
              `Variabler utanför de 12 indikatorerna: andel av variansen mellan grupper (η²), mot ${s.outcomes.rounds} omblandningar; p efter Holm över tabellen`,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Variable', 'Variabel')}</th>
              <th scope="col" className="sw-n">
                n
              </th>
              <th scope="col" className="sw-n">
                η², k = 2
              </th>
              <th scope="col" className="sw-n">
                η², k = 4
              </th>
              <th scope="col" className="sw-n">
                {l('Shuffled, 95th pct., k = 4', 'Omblandat, 95:e pct., k = 4')}
              </th>
              <th scope="col" className="sw-n">
                p, k = 2 / 4
              </th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const [two, four] = [cell(id, 'k2'), cell(id, 'k4')]
              return (
                <tr key={id}>
                  <th scope="row">{outcomeName(id)}</th>
                  <td className="sw-n">{four?.n}</td>
                  <td className="sw-n">{two?.eta_squared.toFixed(2)}</td>
                  <td className="sw-n">{four?.eta_squared.toFixed(2)}</td>
                  <td className="sw-n">{four?.null_95.toFixed(2)}</td>
                  <td className="sw-n">
                    {two?.p_holm.toFixed(2)} / {four?.p_holm.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
