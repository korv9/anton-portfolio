/** Project pages that are a single report: DrugComb, Allegoria, the degree project and Homie. */
import { lazy } from 'react'
import { t } from '../i18n'

const RfcReport = lazy(() => import('../RfcReport'))
const DrugCombReport = lazy(() => import('./DrugCombReport'))
const HomieProject = lazy(() => import('./HomieProject'))
const ProjectDataDisclosure = lazy(() => import('./ProjectDataDisclosure'))

export function DrugCombPage() {
  return (
    <div className="project-page">
      <div className="page-lead">
        <p className="eyebrow">{t('DrugComb Synergy Prediction')}</p>
        <h1>{t('DrugComb Synergy Prediction.')}</h1>
        <p>
          {t(
            'Experimental results from cleaned measurements through evaluation on unfamiliar pairs, drugs and cell lines.',
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
        <p className="eyebrow">{t('Allegoria · work in progress')}</p>
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
      <div className="page-lead">
        <p className="eyebrow">{t('Degree project · Fora')}</p>
        <h1>{t('Finding useful review candidates in incident data.')}</h1>
        <p>
          {t(
            'My principal case study in data quality, privacy-aware NLP and clustering. Internal source records are not published.',
          )}
        </p>
      </div>
      <div className="featured-projects">
        <div className="project-grid">
          <article className="thesis-card" id="thesis">
            <div className="project-card-head">
              <span>{t('Degree project · Fora · 2026')}</span>
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
                <strong>16,811</strong>
                <span>{t('anonymised incidents')}</span>
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
      <div className="page-lead">
        <p className="eyebrow">{t('Homie API · work in progress')}</p>
        <h1>{t('From household events to understandable analytics.')}</h1>
        <p>
          {t(
            'The API contract and data design are here for inspection. Several endpoints remain documented stubs.',
          )}
        </p>
      </div>
      <div className="reports">
        <HomieProject />
      </div>
    </div>
  )
}
