/**
 * The deconfounding experiments side by side: the same sample run with original contexts, with
 * the symbol word masked, with each book's mean embedding removed, and with both. Lower book
 * share and more cross-book clusters mean the clusters lean less on book identity; silhouette
 * and noise show what that costs in cluster structure. No row is called the best.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { share } from '../format'
import { loadExperimentComparison, loadModelComparison } from './atlasData'
import type { ExperimentComparison, ModelComparison } from './atlasTypes'

const NAMES: Record<string, [string, string]> = {
  baseline: ['Baseline', 'Utgångsläge'],
  masked: ['Symbol masked', 'Symbol maskerad'],
  book_centered: ['Book-centred', 'Bokcentrerad'],
  masked_book_centered: ['Both', 'Båda'],
}
const pct = share
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
    <>
      <section
        className="atlas-experiments report-section ds-container"
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
            `The same ${data.experiments[0]?.occurrences ?? ''} passages, run four ways. Masking hides the symbol; book-centring removes what a book’s passages share. Lower book share means less book dependence.`,
            `Samma ${data.experiments[0]?.occurrences ?? ''} ställen, körda på fyra sätt. Maskering döljer symbolen; bokcentrering tar bort det en boks ställen delar. Lägre bokandel betyder mindre bokberoende.`,
          )}
        </p>
        <div className="atlas-table-wrap" tabIndex={0}>
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
            'Shares: the mean of each cluster’s largest book, tradition or symbol. A cross-book cluster draws on at least three books, none above half.',
            'Andelar: medel av varje klusters största bok, tradition eller symbol. Ett kluster över flera böcker hämtar från minst tre böcker, ingen över hälften.',
          )}
        </p>
      </section>
      <ModelTable />
    </>
  )
}

const short = (model: string) => model.split('/').at(-1) ?? model
const points = (a: number, b: number) =>
  Math.round((a - b) * 100).toLocaleString(l('en-GB', 'sv-SE'))

/**
 * The same book-centred sample embedded by four models. The neighbour shares need no map and no
 * clusters, so they compare the models fairly; the cluster columns use HDBSCAN settings chosen
 * for the published model, which is why a model can collapse into a handful of clusters.
 */
function ModelTable() {
  const [data, setData] = useState<ModelComparison | null>(null)
  useEffect(() => {
    let live = true
    loadModelComparison().then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [])
  const rows = data?.rows.filter((r) => r.experiment === 'book_centered') ?? []
  const published = rows[0]
  if (!data || !published || rows.length < 2) return null
  const best = rows.reduce((a, b) =>
    b.neighbours_same_symbol > a.neighbours_same_symbol ? b : a,
  )
  return (
    <section
      className="atlas-experiments report-section ds-container"
      id="symbolic-models"
      aria-labelledby="atlas-models-title"
    >
      <h2 id="atlas-models-title">
        {l(
          'Would a larger embedding model help?',
          'Skulle en större inbäddningsmodell hjälpa?',
        )}
      </h2>
      <p>
        {l(
          `The same ${published.occurrences} passages, embedded by ${rows.length} models. Of each passage’s ${data.neighbours} nearest neighbours: how many share its book, and how many its symbol.`,
          `Samma ${published.occurrences} ställen, inbäddade av ${rows.length} modeller. Av varje ställes ${data.neighbours} närmaste grannar: hur många delar bok, och hur många symbol.`,
        )}
      </p>
      <div className="atlas-table-wrap" tabIndex={0}>
        <table className="atlas-table">
          <thead>
            <tr>
              <th scope="col">{l('Model', 'Modell')}</th>
              <th scope="col">
                {l('Neighbours, same book', 'Grannar, samma bok')}
              </th>
              <th scope="col">
                {l('Neighbours, same symbol', 'Grannar, samma symbol')}
              </th>
              <th scope="col">{l('Clusters', 'Kluster')}</th>
              <th scope="col">{l('Book share', 'Bokandel')}</th>
              <th scope="col">{l('Embedding time', 'Inbäddningstid')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model}>
                <th scope="row">
                  {short(r.model)}
                  {r === published && <> ({l('published', 'publicerad')})</>}
                </th>
                <td>{pct(r.neighbours_same_book)}</td>
                <td>{pct(r.neighbours_same_symbol)}</td>
                <td>{r.clusters}</td>
                <td>{pct(r.mean_largest_book_share)}</td>
                <td>
                  {r.embedding_seconds == null
                    ? '–'
                    : `${Math.round(r.embedding_seconds / 60)} min`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {l(
          `${short(best.model)} puts ${points(best.neighbours_same_symbol, published.neighbours_same_symbol)} percentage points more same-symbol passages among the neighbours than ${short(published.model)}. A small step next to the book effect. The atlas keeps ${short(published.model)}.`,
          `${short(best.model)} ger ${points(best.neighbours_same_symbol, published.neighbours_same_symbol)} procentenheter fler grannar med samma symbol än ${short(published.model)}. Ett litet steg jämfört med bokeffekten. Atlasen behåller ${short(published.model)}.`,
        )}
      </p>
      <p className="atlas-note">
        {l(
          `By chance: ${pct(published.chance_same_book)} same book, ${pct(published.chance_same_symbol)} same symbol.`,
          `Av en slump: ${pct(published.chance_same_book)} samma bok, ${pct(published.chance_same_symbol)} samma symbol.`,
        )}
      </p>
    </section>
  )
}
