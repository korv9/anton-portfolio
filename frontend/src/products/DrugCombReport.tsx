import { currentLocale, t } from '../i18n'
import { fetchData } from '../dataSource'
import { useEffect, useState } from 'react'
type Metric = {
  scheme: string
  model: string
  model_label: string
  pearson: number | null
  pearson_sd: number | null
  rmse: number
  r2: number
}
type Report = {
  source: { revision: string; repository: string }
  metrics: Metric[]
  funnel: { step: string; rows: number }[]
  overview: {
    combinations: number
    drugs: number
    cell_lines: number
    share_synergistic: number
  }
  lineages: {
    lineage: string
    combinations: number
    share_synergistic: number
  }[]
}
const splitNames: Record<string, string> = {
  random: 'Random rows',
  cold_pair: 'Unseen drug pair',
  cold_drug: 'Unseen drug',
  cold_cell: 'Unseen cell line',
}
const splitHelp: Record<string, string> = {
  random: 'Other observations of the same entities can appear in training.',
  cold_pair: 'The tested drug pair is absent from training.',
  cold_drug: 'At least one drug in each test row is absent from training.',
  cold_cell: 'The tested cell line is absent from training.',
}
const number = (n: number) =>
  n.toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')

export default function DrugCombReport() {
  const [report, setReport] = useState<Report | null>(null)
  const [model, setModel] = useState('lgbm_all')
  const [error, setError] = useState(false)
  useEffect(() => {
    fetchData('products/drugcomb/report.json')
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then(setReport)
      .catch(() => setError(true))
  }, [])
  const models = [
    ...new Map(
      report?.metrics.map((row) => [row.model, row.model_label]) ?? [],
    ).entries(),
  ]
  const results = report?.metrics.filter((row) => row.model === model) ?? []
  return (
    <article className="report drugcomb-report" id="drugcomb">
      <p className="eyebrow">
        {t('DrugComb / data engineering & model evaluation')}
      </p>
      <h2>{t('Does the prediction hold up on something new?')}</h2>
      <p className="report-intro">
        {t(
          'A research pipeline connecting drug-combination screens to molecular and cell-line features. The interesting question is how performance changes when the test data contains unfamiliar pairs, drugs or cell lines.',
        )}
      </p>
      {error && (
        <p role="alert">{t('The DrugComb report could not be loaded.')}</p>
      )}
      {!report && !error && (
        <p role="status">{t('Loading published research results…')}</p>
      )}
      {report && (
        <>
          <div className="kpis">
            <div>
              <strong>{number(report.overview.combinations)}</strong>
              <span>{t('pair × cell line × study rows')}</span>
            </div>
            <div>
              <strong>{number(report.overview.drugs)}</strong>
              <span>{t('resolved molecules')}</span>
            </div>
            <div>
              <strong>{number(report.overview.cell_lines)}</strong>
              <span>{t('human cell lines')}</span>
            </div>
            <div>
              <strong>
                {(report.overview.share_synergistic * 100).toFixed(1)}%
              </strong>
              <span>{t('ZIP > 10 in the analysed data')}</span>
            </div>
          </div>
          <div className="product-analysis-grid">
            <section className="analysis-panel">
              <p className="eyebrow">{t('01 / Generalisation')}</p>
              <h3>{t('The test split changes the question.')}</h3>
              <label className="model-control">
                {t('Feature set / model')}
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {models.map(([id, name]) => (
                    <option key={id} value={id}>
                      {t(name)}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {t(
                  'Pearson correlation between predicted and observed ZIP. Same model across all four splits; higher is better. Bars use a fixed 0–1 scale.',
                )}
              </p>
              <div className="research-bars">
                {results.map((row) => (
                  <div className="research-bar" key={row.scheme}>
                    <div>
                      <strong>{t(splitNames[row.scheme])}</strong>
                      <span>
                        {row.pearson == null
                          ? t('Not defined')
                          : row.pearson.toFixed(3)}
                      </span>
                    </div>
                    <div
                      className="research-track"
                      role="img"
                      aria-label={`${t(splitNames[row.scheme])} Pearson ${row.pearson ?? t('Not defined')}`}
                    >
                      <i
                        style={{
                          width: `${Math.max(0, row.pearson ?? 0) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      {t(splitHelp[row.scheme])} {t('RMSE ')}
                      {row.rmse.toFixed(2)}; R² {row.r2.toFixed(3)}
                      {row.pearson_sd == null
                        ? ''
                        : `; r fold SD ${row.pearson_sd.toFixed(3)}`}
                      .
                    </small>
                  </div>
                ))}
              </div>
              <p className="evidence-note">
                {t(
                  'Means over three folds; fold SD is not a confidence interval. The mean-only baseline has no defined correlation. These are saved upstream results, not a new training run.',
                )}
              </p>
            </section>
            <section className="analysis-panel">
              <p className="eyebrow">{t('02 / Data preparation')}</p>
              <h3>{t('From measurements to a modelling table.')}</h3>
              <p>
                {t(
                  'Counts at each recorded cleaning stage. Replicates are averaged after resolving drug and cell-line identities.',
                )}
              </p>
              <div className="research-bars">
                {report.funnel.map((row) => (
                  <div className="research-bar" key={row.step}>
                    <div>
                      <span>{t(row.step)}</span>
                      <strong>{number(row.rows)}</strong>
                    </div>
                    <div className="research-track">
                      <i
                        style={{
                          width: `${(row.rows / report.funnel[0].rows) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="analysis-panel lineage-panel">
            <p className="eyebrow">{t('03 / Dataset context')}</p>
            <h3>{t('Synergy differs across the screened tissue groups.')}</h3>
            <p>
              {t(
                'Share of analysed rows with ZIP > 10, by lineage. Differences also reflect which drugs and studies were included; this is not a treatment comparison.',
              )}
            </p>
            <div className="lineage-grid">
              {[...report.lineages]
                .sort((a, b) => b.share_synergistic - a.share_synergistic)
                .map((row) => (
                  <div className="research-bar" key={row.lineage}>
                    <div>
                      <span>{row.lineage}</span>
                      <strong>
                        {(row.share_synergistic * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className="research-track">
                      <i style={{ width: `${row.share_synergistic * 100}%` }} />
                    </div>
                    <small>
                      {number(row.combinations)}{' '}
                      {t('analysed rows · scale 0–100%')}
                    </small>
                  </div>
                ))}
            </div>
          </section>
          <details className="method">
            <summary>
              {t('What I built, evaluation assumptions & data access')}
            </summary>
            <div>
              <p>
                {t(
                  'The pipeline performs entity resolution, builds a DuckDB star schema, applies data-quality checks and evaluates symmetric chemistry/biology features with LightGBM and baselines. The portfolio keeps a pinned copy of the pipeline and all 22 published result tables.',
                )}
              </p>
              <p>
                {t(
                  'Monotherapy features come from the same experimental screen and assume single-agent responses are already available. RNA PCA uses the broader DepMap corpus, so the cell-line setup is not a fully isolated biological representation experiment. A low shuffled-label score is a useful diagnostic, not proof that every leakage risk is absent. These experimental results are not clinical evidence.',
                )}
              </p>
              <p>
                {t(
                  'The full raw screening and DepMap files are not bundled here. Their source URLs, releases and hashes are in the input manifest. The local report provides all published aggregates and evaluation tables.',
                )}
              </p>
              <div className="product-actions">
                <a href="#drugcomb-data">{t('Browse all result tables ↓')}</a>
                <a href="data/products/drugcomb/REPORT.md" download>
                  {t('Full upstream report')}
                </a>
                <a href="data/products/drugcomb/data_manifest.json" download>
                  {t('Input manifest')}
                </a>
                <a
                  href={`${report.source.repository}/tree/${report.source.revision}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Pinned source revision ↗')}
                </a>
              </div>
            </div>
          </details>
          <details className="method">
            <summary>{t('More original analysis figures')}</summary>
            <div className="figure-gallery">
              {[
                [
                  'an_01_zip_distribution',
                  'Distribution of observed ZIP synergy scores',
                ],
                [
                  'an_02_replicate_agreement',
                  'Agreement between repeated experimental measurements',
                ],
                [
                  'ml_06_enrichment',
                  'Enrichment among highly ranked predictions',
                ],
                [
                  'ml_07_calibration',
                  'Prediction calibration by evaluation split',
                ],
              ].map(([file, alt]) => (
                <figure key={file}>
                  <a
                    href={`data/products/drugcomb/figures/${file}.svg`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={`data/products/drugcomb/figures/${file}.png`}
                      alt={t(alt)}
                      loading="lazy"
                    />
                  </a>
                  <figcaption>
                    {t(alt)} {t('· open full figure')}
                  </figcaption>
                </figure>
              ))}
            </div>
          </details>
        </>
      )}
    </article>
  )
}
