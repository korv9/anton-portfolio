/** Project pages that are a single report: DrugComb, Allegoria, the degree project and Homie. */
import { lazy } from 'react'
import { l, t } from '../i18n'
import { ProjectHero, ProjectSection } from '../ui/Project'
import { ProjectDepth } from '../projects/ProjectStructure'
import ProjectTech from '../projects/ProjectTech'
import { Stage, StageBlock, StageFacts, StageTools } from '../ui/Stage'
import HomieFlow from './HomieFlow'
import './mlviz.css'

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
        <h1>{l('Drug Synergy Lab', 'Drug Synergy Lab')}</h1>
        <p>
          {l(
            'Predicting synergy in DrugComb experiment data, with separate tests for unseen drugs, pairs and cell lines.',
            'Förutsägelse av synergi i DrugCombs experimentdata, med separata tester för osedda läkemedel, par och cellinjer.',
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

export function ThesisPage() {
  return (
    <article className="project-page thesis-page">
      <ProjectHero
        project="thesis"
        question={l('Clustering IT incidents', 'Klustring av IT-incidenter')}
      >
        <p>
          {l(
            'Degree project at Avtalat, 2026. Similar incident texts are grouped to create candidates for problem management review.',
            'Examensarbete hos Avtalat, 2026. Liknande incidenttexter grupperas till kandidater för granskning inom problemhantering.',
          )}
        </p>
      </ProjectHero>
      <section id="thesis-workflow" className="project-section">
        <h2>
          {l(
            'From incidents to review candidates',
            'Från incidenter till granskningskandidater',
          )}
        </h2>
        <ol className="engineering-flow">
          <li>
            <strong>21 000+</strong>
            {l('Incident records', 'Incidentposter')}
          </li>
          <li>
            <strong>121</strong>
            {l('HDBSCAN clusters', 'HDBSCAN-kluster')}
          </li>
          <li>
            <strong>72</strong>
            {l('Review candidates', 'Granskningskandidater')}
          </li>
        </ol>
        <p>
          {l(
            'Candidates are groups without a link to an existing problem record. They require domain review; the count does not establish root causes.',
            'Kandidater är grupper utan koppling till en befintlig problempost. De behöver verksamhetens granskning; antalet fastställer inte grundorsaker.',
          )}
        </p>
      </section>
      <ProjectSection
        id="thesis-evaluation"
        title={l('Model evaluation', 'Modellutvärdering')}
      >
        <figure className="thesis-evaluation">
          <figcaption>
            {l(
              'Silhouette score for the compared clustering methods',
              'Silhuettvärde för de jämförda klustringsmetoderna',
            )}
          </figcaption>
          {[
            ['HDBSCAN', 0.706],
            ['K-means', 0.534],
          ].map(([name, value]) => (
            <div key={name}>
              <span>{name}</span>
              <div className="stage-bar">
                <span>
                  <i style={{ width: `${Number(value) * 100}%` }} />
                </span>
              </div>
              <b>
                {Number(value).toLocaleString(l('en-GB', 'sv-SE'), {
                  minimumFractionDigits: 3,
                })}
              </b>
            </div>
          ))}
        </figure>
        <p>
          {l(
            'Silhouette describes internal separation between groups. It does not measure whether a group is a useful problem record.',
            'Silhuettvärdet beskriver gruppernas interna separation. Det mäter inte om en grupp är en användbar problempost.',
          )}
        </p>
      </ProjectSection>
      <ProjectDepth project="thesis">
        <div className="project-depth-notes">
          <section>
            <h3>{l('Source and preparation', 'Källa och förberedelse')}</h3>
            <p>
              {l(
                'Internal incident records were assessed with ISO/IEC 25012. Personal data was masked with Presidio. Incident text and raw data are not published.',
                'Interna incidentposter bedömdes med ISO/IEC 25012. Personuppgifter maskerades med Presidio. Incidenttexter och rådata publiceras inte.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l(
                'Representation and clustering',
                'Representation och klustring',
              )}
            </h3>
            <p>
              {l(
                'Multilingual sentence embeddings, UMAP to ten dimensions and HDBSCAN. K-means was used for comparison. Runs were tracked in MLflow on Azure Databricks.',
                'Flerspråkiga meningsinbäddningar, UMAP till tio dimensioner och HDBSCAN. K-means användes för jämförelse. Körningar spårades i MLflow på Azure Databricks.',
              )}
            </p>
          </section>
          <section>
            <h3>{l('Review', 'Granskning')}</h3>
            <p>
              {l(
                'The next step is to assess the candidates against operational knowledge and existing problem records. No confirmed time saving or root-cause outcome is reported here.',
                'Nästa steg är att bedöma kandidaterna mot verksamhetskunskap och befintliga problemposter. Någon bekräftad tidsbesparing eller fastställd grundorsak redovisas inte här.',
              )}
            </p>
          </section>
        </div>
      </ProjectDepth>
    </article>
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
        <ProjectTech project="homie" />
        <ProjectDepth project="homie">
          <HomieProject />
        </ProjectDepth>
      </div>
    </div>
  )
}
