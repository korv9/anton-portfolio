/** Project pages that are a single report: DrugComb, Allegoria, the degree project and Homie. */
import { lazy } from 'react'
import { l, t } from '../i18n'
import { Stage, StageBlock, StageFacts, StageTools } from '../ui/Stage'
import ThesisSieve from './ThesisSieve'
import HomieFlow from './HomieFlow'
import './mlviz.css'

const RfcReport = lazy(() => import('../RfcReport'))
const DrugCombReport = lazy(() => import('./DrugCombReport'))
const HomieProject = lazy(() => import('./HomieProject'))
const ProjectDataDisclosure = lazy(() => import('./ProjectDataDisclosure'))

export function DrugCombPage() {
  return (
    <div className="project-page">
      <div className="page-lead">
        <p className="eyebrow">
          {l(
            'Machine learning, DrugComb synergy prediction',
            'Maskininlärning, förutsäga läkemedelssynergi',
          )}
        </p>
        <h1>
          {l(
            'Which drugs work better together?',
            'Vilka läkemedel fungerar bättre tillsammans?',
          )}
        </h1>
        <p>
          {l(
            'A data pipeline and model that predict which drug pairs kill more cancer cells together than alone, tested honestly on drugs and cell lines it has never seen.',
            'En datapipeline och modell som förutsäger vilka läkemedelspar som dödar fler cancerceller tillsammans än var för sig, ärligt prövad på läkemedel och cellinjer den aldrig sett.',
          )}
        </p>
      </div>
      <div className="reports">
        <DrugCombReport />
        <ProjectDataDisclosure
          title={t('Result tables and downloads')}
          initialDataset="drugcomb_metrics"
          sectionId="drugcomb-data"
        />
      </div>
    </div>
  )
}

export function AllegoriaPage() {
  return (
    <div className="project-page">
      <div className="page-lead">
        <p className="eyebrow">{t('Allegoria, work in progress')}</p>
        <h1>{t('Allegoria / RFC drift.')}</h1>
        <p>
          {t(
            'A compact experiment with real requirement profiles and a clearly labelled synthetic direction example.',
          )}
        </p>
      </div>
      <div className="reports">
        <RfcReport />
      </div>
    </div>
  )
}

export function ThesisPage() {
  return (
    <div className="project-page">
      <Stage
        id="thesis-stage"
        level={1}
        kicker={l(
          'Degree project, Avtalat, 2026',
          'Examensarbete, Avtalat, 2026',
        )}
        title={l(
          'From 21,000 incidents to 72 to review',
          'Från 21 000 incidenter till 72 att granska',
        )}
        lead={l(
          'Unsupervised NLP groups similar incident texts; groups without a link to an existing problem record become candidates for review, not proven root causes.',
          'Oövervakad NLP grupperar liknande incidenttexter; grupper utan koppling till en befintlig problempost blir kandidater för granskning, inte bevisade grundorsaker.',
        )}
        figure={<ThesisSieve />}
        left={
          <>
            <StageBlock title={l('Data', 'Data')}>
              <StageFacts
                rows={[
                  [
                    l('Production incidents', 'Produktionsincidenter'),
                    '21,000+',
                  ],
                  [l('Data quality', 'Datakvalitet'), 'ISO/IEC 25012'],
                  [
                    l('Personal data', 'Personuppgifter'),
                    l('masked (Presidio)', 'maskerade (Presidio)'),
                  ],
                ]}
              />
              <p>
                {l(
                  'Internal records: no incident text or raw data is published.',
                  'Interna poster: ingen incidenttext eller rådata publiceras.',
                )}
              </p>
            </StageBlock>
            <StageBlock title={l('Pipeline', 'Pipeline')}>
              <ol className="stage-steps">
                <li>{l('Quality assessment', 'Kvalitetsbedömning')}</li>
                <li>
                  {l('PII masking with Presidio', 'PII-maskning med Presidio')}
                </li>
                <li>
                  {l(
                    'Multilingual sentence embeddings',
                    'Flerspråkiga meningsinbäddningar',
                  )}
                </li>
                <li>
                  {l('UMAP to 10 dimensions', 'UMAP till 10 dimensioner')}
                </li>
                <li>HDBSCAN</li>
                <li>{l('Tracked in MLflow', 'Spårat i MLflow')}</li>
              </ol>
            </StageBlock>
          </>
        }
        right={
          <>
            <StageBlock title={l('Results', 'Resultat')}>
              <StageFacts
                rows={[
                  [l('Clusters', 'Kluster'), '121'],
                  [l('Review candidates', 'Granskningskandidater'), '72'],
                ]}
              />
            </StageBlock>
            <StageBlock title={l('Silhouette', 'Silhuett')}>
              {[
                ['HDBSCAN', 0.706],
                ['K-means', 0.534],
              ].map(([m, v]) => (
                <div key={m as string}>
                  {m}
                  <div className="stage-bar">
                    <span>
                      <i style={{ width: `${(v as number) * 100}%` }} />
                    </span>
                    <b>{(v as number).toFixed(3)}</b>
                  </div>
                </div>
              ))}
              <p>
                {l(
                  'Internal separation only: business validation is still needed. Which clusters are candidates is not shown; they are spread evenly in the figure.',
                  'Bara intern separation: verksamhetens validering behövs fortfarande. Vilka kluster som är kandidater visas inte; de är jämnt spridda i figuren.',
                )}
              </p>
            </StageBlock>
            <StageBlock title={l('Tools', 'Verktyg')}>
              <StageTools
                items={[
                  'Python',
                  'Azure Databricks',
                  'sentence-transformers',
                  'UMAP',
                  'HDBSCAN',
                  'Presidio',
                  'MLflow',
                ]}
              />
            </StageBlock>
          </>
        }
      />
      <div className="featured-projects">
        <div className="project-grid">
          <article className="thesis-card" id="thesis">
            <div className="project-card-head">
              <span>
                {l(
                  'Degree project, Avtalat, 2026',
                  'Examensarbete, Avtalat, 2026',
                )}
              </span>
              <strong>{t('Primary case study')}</strong>
            </div>
            <h3>{t('Finding review candidates in incident data')}</h3>
            <p>
              {t(
                'Built a privacy-aware Azure Databricks workflow for data quality assessment and NLP clustering. The goal was to surface groups of similar incidents for manual review, without presenting clusters as proven root causes.',
              )}
            </p>
            <div className="thesis-kpis">
              <div>
                <strong>21,000+</strong>
                <span>
                  {l('production incidents', 'produktionsincidenter')}
                </span>
              </div>
              <div>
                <strong>121</strong>
                <span>{t('clusters found')}</span>
              </div>
              <div>
                <strong>72</strong>
                <span>{t('without an existing problem link')}</span>
              </div>
              <div>
                <strong>0.706</strong>
                <span>{t('best reported silhouette')}</span>
              </div>
            </div>
            <div className="thesis-findings">
              <div>
                <span>01</span>
                <p>
                  <strong>{t('Data quality shaped the pipeline.')}</strong>{' '}
                  {t(
                    'Selected ISO/IEC 25012 dimensions were assessed before the modelling stage.',
                  )}
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>
                    {t('HDBSCAN produced the stronger internal separation.')}
                  </strong>{' '}
                  {t(
                    'The reported silhouette was 0.706, compared with 0.534 for KMeans.',
                  )}
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>{t('72 clusters became review candidates.')}</strong>{' '}
                  {t(
                    'They lacked an existing problem link, but require domain validation before any root-cause claim.',
                  )}
                </p>
              </div>
            </div>
            <details>
              <summary>{t('Pipeline & limitations')}</summary>
              <p>
                {t(
                  'Presidio for PII, multilingual sentence embeddings, UMAP to 10 dimensions, HDBSCAN and MLflow. Internal clustering metrics do not replace business validation, and no internal incident text or employer raw data is published here.',
                )}
              </p>
            </details>
          </article>
        </div>
      </div>
    </div>
  )
}

export function HomiePage() {
  return (
    <div className="project-page">
      <Stage
        id="homie-stage"
        level={1}
        kicker={l('Homie API, work in progress', 'Homie API, pågående')}
        title={l(
          'A backend for household events',
          'En backend för hushållets händelser',
        )}
        lead={l(
          'Chore completions are stored as immutable events and aggregated into weekly workload, fairness and cadence. The contract is explicit; several routes are still documented stubs.',
          'Utförda sysslor sparas som oföränderliga händelser och aggregeras till veckobelastning, rättvisa och rytm. Kontraktet är tydligt; flera rutter är fortfarande dokumenterade stubbar.',
        )}
        figure={<HomieFlow />}
        left={
          <>
            <StageBlock title={l('Design', 'Design')}>
              <ol className="stage-steps">
                <li>
                  {l(
                    'Record immutable events',
                    'Spara oföränderliga händelser',
                  )}
                </li>
                <li>
                  {l(
                    'Enrich with household, task, member',
                    'Berika med hushåll, uppgift, medlem',
                  )}
                </li>
                <li>{l('Aggregate in SQL views', 'Aggregera i SQL-vyer')}</li>
                <li>
                  {l(
                    'Serve typed FastAPI contracts',
                    'Servera typade FastAPI-kontrakt',
                  )}
                </li>
              </ol>
            </StageBlock>
            <StageBlock title={l('Status', 'Status')}>
              <StageFacts
                rows={[
                  [l('Implemented route groups', 'Klara ruttgrupper'), '3'],
                  [l('Documented stubs', 'Dokumenterade stubbar'), '4'],
                ]}
              />
              <p>
                {l(
                  'Stub routes return documented previews; no real household data is shown.',
                  'Stubbrutter returnerar dokumenterade förhandsvisningar; ingen riktig hushållsdata visas.',
                )}
              </p>
            </StageBlock>
          </>
        }
        right={
          <>
            <StageBlock title={l('Quality', 'Kvalitet')}>
              <StageTools
                items={[
                  'pytest',
                  'Ruff',
                  'GitHub Actions',
                  'Docker (multi-stage)',
                  'Docker Compose',
                ]}
              />
            </StageBlock>
            <StageBlock title={l('Stack', 'Stack')}>
              <StageTools
                items={[
                  'Python',
                  'FastAPI',
                  'PostgreSQL',
                  'SQLAlchemy',
                  'Alembic',
                  'OpenAPI',
                ]}
              />
            </StageBlock>
          </>
        }
      />
      <div className="reports">
        <HomieProject />
      </div>
    </div>
  )
}
