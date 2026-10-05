/**
 * The deconfounding experiments side by side: the same sample run with original contexts, with
 * the symbol word masked, with each book's mean embedding removed, and with both. Lower book
 * share and more cross-book clusters mean the clusters lean less on book identity; silhouette
 * and noise show what that costs in cluster structure. No row is called the best.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { loadExperimentComparison } from './atlasData'
import type { ExperimentComparison } from './atlasTypes'

const NAMES: Record<string, [string, string]> = {
  baseline: ['Baseline', 'Utgångsläge'],
  masked: ['Symbol masked', 'Symbol maskerad'],
  book_centered: ['Book-centred', 'Bokcentrerad'],
  masked_book_centered: ['Both', 'Båda'],
}
const pct = (v: number) =>
  `${(v * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 0 })} %`
const dec = (v: number | null) =>
  v == null
    ? '–'
    : v.toLocaleString(l('en-GB', 'sv-SE'), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

export default function ExperimentTable() {
  const [data, setData] = useState<ExperimentComparison | null>(null)
  useEffect(() => {
    let live = true
    loadExperimentComparison().then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [])
  if (!data) return null
  return (
    <section
      className="atlas-experiments ds-container"
      id="symbolic-experiments"
      aria-labelledby="atlas-exp-title"
    >
      <h2 id="atlas-exp-title">
        {l(
          'Are the clusters about symbols or about books?',
          'Handlar klustren om symboler eller om böcker?',
        )}
      </h2>
      <p>
        {l(
          `The same ${data.experiments[0]?.occurrences ?? ''} passages, run four ways. Masking hides which symbol it is; book-centring removes what all passages of a book share. Lower book share and more cross-book clusters mean less book dependence; silhouette and noise show what that costs.`,
          `Samma ${data.experiments[0]?.occurrences ?? ''} ställen, körda på fyra sätt. Maskering döljer vilken symbol det är; bokcentrering tar bort det alla ställen i en bok har gemensamt. Lägre bokandel och fler kluster över flera böcker betyder mindre bokberoende; silhuett och brus visar vad det kostar.`,
        )}
      </p>
      <div className="atlas-table-wrap">
        <table className="atlas-table">
          <thead>
            <tr>
              <th scope="col">{l('Experiment', 'Experiment')}</th>
              <th scope="col">{l('Clusters', 'Kluster')}</th>
              <th scope="col">{l('Book share', 'Bokandel')}</th>
              <th scope="col">{l('Tradition share', 'Traditionsandel')}</th>
              <th scope="col">{l('Symbol share', 'Symbolandel')}</th>
              <th scope="col">
                {l('Cross-book clusters', 'Kluster över flera böcker')}
              </th>
              <th scope="col">{l('Noise', 'Brus')}</th>
              <th scope="col">{l('Silhouette', 'Silhuett')}</th>
            </tr>
          </thead>
          <tbody>
            {data.experiments.map((r) => (
              <tr key={r.experiment}>
                <th scope="row">
                  {NAMES[r.experiment]
                    ? l(...NAMES[r.experiment])
                    : r.experiment}
                </th>
                <td>{r.clusters}</td>
                <td>{pct(r.mean_largest_book_share)}</td>
                <td>{pct(r.mean_largest_tradition_share)}</td>
                <td>{pct(r.mean_largest_symbol_share)}</td>
                <td>
                  {r.cross_book_cluster_count} (
                  {pct(r.cross_book_occurrence_share)})
                </td>
                <td>{pct(r.noise_share)}</td>
                <td>{dec(r.silhouette)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="atlas-note">
        {l(
          'Shares are the mean, over clusters, of the largest book, tradition or symbol in a cluster. A cross-book cluster draws on at least three books with none holding more than half. The map above is the baseline.',
          'Andelarna är medelvärdet, över klustren, av den största boken, traditionen eller symbolen i ett kluster. Ett kluster över flera böcker hämtar från minst tre böcker och ingen har mer än hälften. Kartan ovan är utgångsläget.',
        )}
      </p>
    </section>
  )
}
