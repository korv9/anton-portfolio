/**
 * Quality & Validity (#quality): how the platform checks that data is correct (ISO/IEC 25012-
 * inspired data quality) and, separately, whether analyses measure what they claim (analytical
 * validity). Built from platform/publish/quality/export_quality.py. Every mark comes from a
 * stored status; failures and unmeasured checks are shown like the rest. No score.
 */
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { useQuality } from './data'
import { cellText, matrix, validityOf, valueText } from './logic'
import {
  checkWhy,
  fmt,
  QualityLegend,
  StatusMark,
  ValidityPanel,
} from './QualityPanel'
import type { Analysis, QualityData } from './types'
import { ProjectHero } from '../ui/Project'
import './quality.css'

/** One line for the first screen: what ran, what failed, what is not measured. */
function runLine({ summary, checks }: QualityData) {
  const failed = checks.filter((c) => c.status === 'fail').length
  const open = checks.filter((c) => c.status === 'not_measured').length
  return l(
    `${summary.run.checks} checks across ${summary.products.length} products on ${summary.run.evaluated_at.slice(0, 10)}: ${failed} failed, ${open} not measured yet. There is no overall score.`,
    `${summary.run.checks} kontroller över ${summary.products.length} produkter den ${summary.run.evaluated_at.slice(0, 10)}: ${failed} underkända, ${open} ännu inte mätta. Det finns inget totalbetyg.`,
  )
}

const DEFAULTS = { produkt: '' }

export default function QualityPage({ route }: { route: Route }) {
  const { data, error } = useQuality()
  const [params, set] = useViewParams(route, DEFAULTS)
  return (
    <div className="quality">
      <div className="ds-container">
        <ProjectHero
          eyebrow={l(
            'Under the hood, quality & validity',
            'Under huven, kvalitet och validitet',
          )}
          title={l('Quality & Validity', 'Kvalitet och validitet')}
          question={l(
            'Did I build the data correctly? And does the analysis actually measure what I think it measures?',
            'Byggde jag datan rätt? Och mäter analysen faktiskt det jag tror att den mäter?',
          )}
          findingLabel={l('Latest run', 'Senaste körningen')}
          finding={data ? runLine(data) : undefined}
          nav={[
            { href: '#quality-matrix', label: l('Products', 'Produkter') },
            { href: '#quality-validity', label: l('Validity', 'Validitet') },
            { href: '#quality-checks', label: l('Checks', 'Kontroller') },
            { href: '#quality-method', label: l('Method', 'Metod') },
          ]}
        >
          <p>
            {l(
              'The platform separates data quality from analytical validity: correct data does not automatically mean a valid conclusion.',
              'Plattformen skiljer datakvalitet från analytisk validitet: korrekt data betyder inte automatiskt en giltig slutsats.',
            )}
          </p>
        </ProjectHero>
      </div>
      <div className="q-body ds-container">
        {error && (
          <p>
            {l(
              'The quality data could not be loaded.',
              'Kvalitetsdatan kunde inte laddas.',
            )}
          </p>
        )}
        {!data && !error && (
          <p className="q-muted">{l('Loading…', 'Laddar…')}</p>
        )}
        {data && (
          <Content
            data={data}
            product={params.produkt}
            setProduct={(p) => set({ produkt: p })}
          />
        )}
      </div>
    </div>
  )
}

function Content({
  data,
  product,
  setProduct,
}: {
  data: QualityData
  product: string
  setProduct: (p: string) => void
}) {
  const { summary, checks, validity } = data
  const dims = summary.dimensions.map((d) => d.id)
  const products = summary.products.map((p) => p.product_id)
  const grid = matrix(checks, products, dims)
  const label = (id: string) => {
    const p = summary.products.find((x) => x.product_id === id)
    return p ? l(p.label_en, p.label_sv) : id
  }
  const active = products.includes(product) ? product : ''
  const symbolic = validity.find(
    (a) => a.analysis_id === 'symbolic_atlas_clustering',
  )
  const shownAnalyses = validity.filter(
    (a) =>
      a.analysis_id !== 'symbolic_atlas_clustering' &&
      (!active || a.product_id === active),
  )
  const shownChecks = checks.filter((c) => !active || c.product_id === active)
  const notMeasured = checks.filter((c) => c.status === 'not_measured')
  const failed = checks.filter((c) => c.status === 'fail')

  return (
    <>
      <section
        className="q-principles"
        aria-label={l('Principles', 'Principer')}
      >
        <p>
          <b>{l('Quality', 'Kvalitet')}</b>{' '}
          {l(
            'asks whether the data is correct.',
            'frågar om datan är korrekt.',
          )}
        </p>
        <p>
          <b>{l('Validity', 'Validitet')}</b>{' '}
          {l(
            'asks whether the analysis answers the question it claims to answer.',
            'frågar om analysen besvarar den fråga den säger sig besvara.',
          )}
        </p>
        <p>{l('Both matter.', 'Båda spelar roll.')}</p>
      </section>

      <section
        id="quality-matrix"
        className="q-section"
        aria-labelledby="q-matrix-title"
      >
        <h2 id="q-matrix-title">{l('Product matrix', 'Produktmatris')}</h2>
        <p className="q-muted">
          {l(
            `${summary.run.checks} registered checks and ${summary.run.diagnostics} validity diagnostics, evaluated ${summary.run.evaluated_at.slice(0, 10)}. Each cell is the weakest measured result for that dimension, with the counts behind it. There is no overall score.`,
            `${summary.run.checks} registrerade kontroller och ${summary.run.diagnostics} validitetsdiagnostiker, utvärderade ${summary.run.evaluated_at.slice(0, 10)}. Varje cell är det svagaste uppmätta resultatet för dimensionen, med antalen bakom. Det finns inget samlat betyg.`,
          )}
        </p>
        <QualityLegend />
        <div
          className="q-table-wrap"
          tabIndex={0}
          aria-label={l('Product matrix', 'Produktmatris')}
        >
          <table className="q-matrix">
            <thead>
              <tr>
                <th scope="col">{l('Product', 'Produkt')}</th>
                {summary.dimensions.map((d) => (
                  <th scope="col" key={d.id}>
                    {l(d.label_en, d.label_sv)}
                  </th>
                ))}
                <th scope="col">{l('Validity', 'Validitet')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const v = validityOf(validity, p)
                return (
                  <tr
                    key={p}
                    className={active === p ? 'is-active' : undefined}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        aria-pressed={active === p}
                        onClick={() => setProduct(active === p ? '' : p)}
                      >
                        {label(p)}
                      </button>
                    </th>
                    {dims.map((d) => {
                      const cell = grid[p][d]
                      return (
                        <td key={d}>
                          {cell ? (
                            <>
                              <StatusMark status={cell.status} />
                              <small>{cellText(cell, l)}</small>
                            </>
                          ) : (
                            <span className="q-muted">
                              {l('no check', 'ingen kontroll')}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td>{v ? <StatusMark status={v} validity /> : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="q-muted q-small">
          {l(
            `Not measured: ${notMeasured.length} checks are registered but have no measurement yet, and are shown as such rather than as confidence. Failed: ${failed.length}.`,
            `Ej mätt: ${notMeasured.length} kontroller är registrerade men saknar mätning ännu, och visas så i stället för som säkerhet. Underkända: ${failed.length}.`,
          )}
        </p>
      </section>

      {symbolic && (!active || active === 'symbolic') && (
        <SymbolicCase analysis={symbolic} />
      )}

      <section
        id="quality-validity"
        className="q-section"
        aria-labelledby="q-validity-title"
      >
        <h2 id="q-validity-title">
          {l('Analytical validity', 'Analytisk validitet')}
        </h2>
        <p className="q-muted">
          {l(
            'Are we measuring the thing we think we are measuring? Each analysis names its target construct, what it actually measures and the diagnostics that test the gap. Results are derived; readings are interpretation.',
            'Mäter vi det vi tror att vi mäter? Varje analys anger sitt avsedda begrepp, vad den faktiskt mäter och de diagnostiker som prövar glappet. Resultaten är härledda; läsningarna är tolkning.',
          )}
        </p>
        <div className="q-analyses">
          {shownAnalyses.map((a) => (
            <ValidityPanel key={a.analysis_id} analysis={a} />
          ))}
        </div>
      </section>

      <section
        id="quality-checks"
        className="q-section"
        aria-labelledby="q-checks-title"
      >
        <h2 id="q-checks-title">
          {l('Every check', 'Varje kontroll')}
          {active && `, ${label(active)}`}
        </h2>
        <p className="q-muted">
          {l(
            'Why is this marked pass? Each check states its requirement, measure, threshold, method and source. Open a row for the details.',
            'Varför är detta godkänt? Varje kontroll anger sitt krav, mått, tröskel, metod och källa. Öppna en rad för detaljerna.',
          )}
        </p>
        <ul className="q-checks">
          {shownChecks.map((c) => {
            const dim = summary.dimensions.find((d) => d.id === c.dimension)!
            return (
              <li key={c.quality_check_id}>
                <details>
                  <summary>
                    <StatusMark status={c.status} />
                    <span className="q-check-dim">
                      {l(dim.label_en, dim.label_sv)}
                    </span>
                    <span className="q-check-desc">{c.description}</span>
                    <span className="q-value">{valueText(c, l)}</span>
                  </summary>
                  <dl className="q-check-detail">
                    <div>
                      <dt>{l('Product, dataset', 'Produkt, dataset')}</dt>
                      <dd>
                        {label(c.product_id)}, <code>{c.dataset_id}</code>
                      </dd>
                    </div>
                    {c.measure_name && (
                      <div>
                        <dt>{l('Measure', 'Mått')}</dt>
                        <dd>
                          <code>{c.measure_name}</code>
                          {c.numerator_definition &&
                            ` = ${c.numerator_definition} / ${c.denominator_definition}`}
                        </dd>
                      </div>
                    )}
                    {c.threshold != null && (
                      <div>
                        <dt>{l('Threshold', 'Tröskel')}</dt>
                        <dd>
                          {c.comparator} {fmt(c.threshold)}
                          {c.warn_at != null &&
                            l(
                              ` (warning up to ${fmt(c.warn_at)})`,
                              ` (varning upp till ${fmt(c.warn_at)})`,
                            )}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>{l('Method, severity', 'Metod, allvarlighet')}</dt>
                      <dd>
                        {c.method.replace('_', ' ')}, {c.severity}
                        {c.gate &&
                          l(
                            ', blocks the warehouse run on failure',
                            ', stoppar lagerkörningen vid fel',
                          )}
                      </dd>
                    </div>
                    <div>
                      <dt>{l('Checked against', 'Kontrolleras mot')}</dt>
                      <dd>{c.source}</dd>
                    </div>
                    {checkWhy(c) && (
                      <div>
                        <dt>{l('Note', 'Not')}</dt>
                        <dd>{checkWhy(c)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{l('Evaluated', 'Utvärderad')}</dt>
                      <dd>
                        {c.evaluated_at.slice(0, 16).replace('T', ' ')} UTC
                      </dd>
                    </div>
                  </dl>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <Method data={data} />
    </>
  )
}

const METRICS: [string, string, string][] = [
  [
    'mean_largest_book_share',
    'Largest book’s share of a cluster',
    'Största bokens andel av ett kluster',
  ],
  [
    'cross_book_occurrence_share',
    'Occurrences in cross-book clusters',
    'Förekomster i kluster över flera böcker',
  ],
  ['mean_book_entropy', 'Book entropy of clusters', 'Bokentropi i klustren'],
  [
    'cross_book_cluster_count',
    'Cross-book clusters',
    'Kluster över flera böcker',
  ],
  ['trustworthiness', 'Map trustworthiness', 'Kartans tillförlitlighet'],
  ['silhouette', 'Silhouette', 'Silhuett'],
]

function SymbolicCase({ analysis }: { analysis: Analysis }) {
  const value = (label: string, experiment: string, metric: string) =>
    analysis.history?.find(
      (h) =>
        h.run_label === label &&
        h.experiment === experiment &&
        h.metric === metric,
    )?.value
  const pct = (m: string, v: number | undefined) =>
    v == null ? '–' : m.includes('share') ? `${Math.round(v * 100)} %` : fmt(v)
  const cols: [string, string, [string, string]][] = [
    [
      'before_cleaning',
      'baseline',
      ['Baseline, before cleaning', 'Baslinje, före rensning'],
    ],
    ['current', 'baseline', ['Baseline', 'Baslinje']],
    ['current', 'book_centered', ['Book-centred', 'Bokcentrerad']],
  ]
  return (
    <section
      id="quality-symbolic"
      className="q-section q-case"
      aria-labelledby="q-case-title"
    >
      <p className="q-kicker">
        {l('Case study, Symbolic Atlas', 'Fallstudie, Symbolic Atlas')}
      </p>
      <h2 id="q-case-title">
        {l(
          'Clusters about symbolic context, or about book identity?',
          'Kluster om symboliskt sammanhang, eller om bokidentitet?',
        )}
      </h2>
      <div className="q-case-steps">
        <div>
          <p className="q-kicker">{l('Question', 'Fråga')}</p>
          <p>
            {l(
              'Can recurring symbolic meanings emerge across myths and folk tales?',
              'Kan återkommande symboliska betydelser framträda över myter och folksagor?',
            )}
          </p>
        </div>
        <div>
          <p className="q-kicker">{l('Data quality', 'Datakvalitet')}</p>
          <p>
            {l(
              'Did I build the dataset correctly? Are texts, matches and sources correct: every occurrence at its offset, every match a listed alias, every book present, every hash matching its fetch.',
              'Byggde jag datasetet rätt? Är texter, träffar och källor korrekta: varje förekomst på sin position, varje träff ett listat alias, varje bok på plats, varje hash lik sin hämtning.',
            )}
          </p>
        </div>
        <div>
          <p className="q-kicker">{l('Validity test', 'Validitetstest')}</p>
          <p>
            {l(
              'Does the model measure symbolic structure, or something else? Are clusters about symbolic context, or about which book a passage comes from?',
              'Mäter modellen symbolisk struktur, eller något annat? Handlar klustren om symboliskt sammanhang, eller om vilken bok en passage kommer från?',
            )}
          </p>
        </div>
      </div>
      <div
        className="q-table-wrap"
        tabIndex={0}
        aria-label={l('Diagnostics by run', 'Diagnostik per körning')}
      >
        <table className="q-matrix q-case-table">
          <thead>
            <tr>
              <th scope="col">{l('Diagnostic', 'Diagnostik')}</th>
              {cols.map(([, , name]) => (
                <th scope="col" key={name[0]}>
                  {l(...name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(([m, en, sv]) => (
              <tr key={m}>
                <th scope="row">{l(en, sv)}</th>
                {cols.map(([run, exp, name]) => (
                  <td key={name[0]}>{pct(m, value(run, exp, m))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="q-muted q-small">
        {l(
          'Read from the experiment artefacts (experiments/comparison.json and its history), not copied by hand. Same sample of 4,804 occurrences in every run.',
          'Läst från experimentens artefakter (experiments/comparison.json och dess historik), inte kopierat för hand. Samma urval av 4 804 förekomster i varje körning.',
        )}
      </p>
      <div className="q-case-steps">
        <div>
          <p className="q-kicker">{l('Finding', 'Fynd')}</p>
          <p>
            {l(
              'Baseline clusters were strongly book-dependent.',
              'Baslinjens kluster var starkt bokberoende.',
            )}
          </p>
        </div>
        <div>
          <p className="q-kicker">{l('Mitigation', 'Åtgärd')}</p>
          <p>
            {l(
              'Paratext cleaning, then document centring (each book’s mean vector removed), reduced book dominance.',
              'Rensning av paratext och sedan dokumentcentrering (varje boks medelvektor borttagen) minskade bokdominansen.',
            )}
          </p>
        </div>
        <div>
          <p className="q-kicker">
            {l('Remaining limitation', 'Kvarstående begränsning')}
          </p>
          <p>
            {l(
              analysis.conclusion_en,
              analysis.conclusion_sv ?? analysis.conclusion_en,
            )}
          </p>
        </div>
      </div>
      <ValidityPanel analysis={analysis} />
    </section>
  )
}

function Method({ data }: { data: QualityData }) {
  const { summary } = data
  return (
    <section
      id="quality-method"
      className="q-section"
      aria-labelledby="q-method-title"
    >
      <h2 id="q-method-title">{l('Method', 'Metod')}</h2>
      <div className="q-dim-cards">
        {summary.dimensions.map((d) => (
          <div key={d.id}>
            <h3>{l(d.label_en, d.label_sv)}</h3>
            <p>{l(d.question_en, d.question_sv)}</p>
            <p className="q-muted q-small">ISO/IEC 25012, {d.iso_25012}</p>
          </div>
        ))}
      </div>
      <ul className="q-method-list">
        <li>{summary.standards.iso_25012}</li>
        <li>{summary.standards.iso_25024}</li>
        <li>{summary.standards.iso_5259}</li>
        <li>
          <b>{summary.standards.claim}</b>
        </li>
        <li>
          {l(
            'Accuracy means a stored or derived value matches its source. Whether a model measures the intended concept is construct validity, recorded separately, never as accuracy. Whether a corpus represents its domain is representativeness, also a validity question.',
            'Riktighet betyder att ett lagrat eller härlett värde stämmer med källan. Om en modell mäter det avsedda begreppet är begreppsvaliditet, som redovisas separat och aldrig som riktighet. Om en korpus representerar sitt område är representativitet, också en validitetsfråga.',
          )}
        </li>
        <li>
          {l(
            'Checks are registered in platform/quality/quality_registry.yml and analyses in validity_registry.yml. dbt checks reuse the existing dbt tests; Python checks cover provenance, reconciliation and freshness; validity diagnostics are read from the pipelines’ own artefacts, without rerunning any model. Manual reviews are sample-based and say so.',
            'Kontrollerna registreras i platform/quality/quality_registry.yml och analyserna i validity_registry.yml. dbt-kontroller återanvänder befintliga dbt-tester; Python-kontroller täcker härkomst, avstämning och aktualitet; validitetsdiagnostiker läses ur pipelinernas egna artefakter utan att någon modell körs om. Manuella granskningar är urvalsbaserade och säger det.',
          )}
        </li>
        <li>
          {l(
            'Structural checks (keys, relations, provenance, reconciliation) fail the warehouse run after the data is stored. Validity diagnostics are reported, never build blockers.',
            'Strukturella kontroller (nycklar, relationer, härkomst, avstämning) stoppar lagerkörningen efter att datan lagrats. Validitetsdiagnostiker rapporteras men stoppar aldrig ett bygge.',
          )}
        </li>
      </ul>
      <p className="q-muted q-small">
        {l('Registry hash', 'Registrets hash')}{' '}
        <code>{summary.run.registry_sha256.slice(0, 12)}</code>,{' '}
        <a href="https://github.com/korv9/anton-portfolio/blob/main/docs/quality-and-validity.md">
          docs/quality-and-validity.md
        </a>
      </p>
      <h3>{l('Limitations', 'Begränsningar')}</h3>
      <ul className="q-method-list">
        <li>
          {l(
            'Accuracy against an independent copy of the source is measured for some products only; where it is not, the check says not measured.',
            'Riktighet mot en oberoende kopia av källan mäts bara för vissa produkter; där den inte mäts står det ej mätt.',
          )}
        </li>
        <li>
          {l(
            'Thresholds are editorial choices, stated with every check.',
            'Trösklarna är redaktionella val och anges vid varje kontroll.',
          )}
        </li>
        <li>
          {l(
            'A supported diagnostic means one test did not find a problem, not that a conclusion is proven.',
            'En diagnostik som stöds betyder att ett test inte hittade något problem, inte att en slutsats är bevisad.',
          )}
        </li>
      </ul>
    </section>
  )
}
