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
            'Shares are the mean, over clusters, of the largest book, tradition or symbol in a cluster. A cross-book cluster draws on at least three books with none holding more than half. The map above is the baseline.',
            'Andelarna är medelvärdet, över klustren, av den största boken, traditionen eller symbolen i ett kluster. Ett kluster över flera böcker hämtar från minst tre böcker och ingen har mer än hälften. Kartan ovan är utgångsläget.',
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
      className="atlas-experiments ds-container"
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
          `The same ${published.occurrences} book-centred passages, embedded by ${rows.length} models. For each passage, its ${data.neighbours} nearest neighbours are counted: how many come from the same book, and how many hold the same symbol. That needs no clusters, so it compares the models fairly.`,
          `Samma ${published.occurrences} bokcentrerade ställen, inbäddade av ${rows.length} modeller. För varje ställe räknas dess ${data.neighbours} närmaste grannar: hur många kommer från samma bok, och hur många har samma symbol. Det kräver inga kluster och jämför därför modellerna rättvist.`,
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
          `${short(best.model)} puts ${points(best.neighbours_same_symbol, published.neighbours_same_symbol)} percentage points more same-symbol passages among the neighbours than ${short(published.model)}. The larger models all move the same way, but the step is small next to the book and tradition effect, and the symbol word itself is still in each passage. The atlas keeps ${short(published.model)}: the clustering settings were chosen for it, and they should change only after the clusters have been reviewed.`,
          `${short(best.model)} ger ${points(best.neighbours_same_symbol, published.neighbours_same_symbol)} procentenheter fler grannar med samma symbol än ${short(published.model)}. De större modellerna rör sig alla åt samma håll, men steget är litet jämfört med effekten av bok och tradition, och själva symbolordet står kvar i varje ställe. Atlasen behåller ${short(published.model)}: klustringens inställningar valdes för den och bör ändras först när klustren har granskats.`,
        )}
      </p>
      <p className="atlas-note">
        {l(
          `By chance, ${pct(published.chance_same_book)} of neighbours would share the book and ${pct(published.chance_same_symbol)} the symbol. Book share is the mean share of a cluster's largest book; a model with only a few clusters makes that number meaningless.`,
          `Av en slump skulle ${pct(published.chance_same_book)} av grannarna dela bok och ${pct(published.chance_same_symbol)} symbol. Bokandel är medelandelen för ett klusters största bok; en modell med bara några få kluster gör den siffran meningslös.`,
        )}
      </p>
    </section>
  )
}
