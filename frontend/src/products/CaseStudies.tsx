/** Project pages that are a single report: DrugComb, Allegoria, the degree project and Homie. */
import { lazy } from 'react'
import { l, t } from '../i18n'
import { ProjectHero, ProjectSection } from '../ui/Project'
import { ProjectDepth } from '../projects/ProjectStructure'
import ProjectTech from '../projects/ProjectTech'
import { Stage, StageBlock, StageFacts, StageTools } from '../ui/Stage'
import HomieFlow from './HomieFlow'
import type { Route } from '../router'
import { DeepPage, ReportFrame } from '../report/ReportShell'
import './mlviz.css'

const DrugCombReport = lazy(() => import('./DrugCombReport'))
const HomieProject = lazy(() => import('./HomieProject'))
const ProjectDataDisclosure = lazy(() => import('./ProjectDataDisclosure'))

export function DrugCombPage({ route }: { route: Route }) {
  return (
    <ReportFrame>
      {route.path === '#drugcomb-data' ? (
        <DeepPage id="drugcomb-tables" back="#drugcomb" name="Drug Synergy Lab">
          <h1>{l('Result tables', 'Resultattabeller')}</h1>
          <ProjectDataDisclosure
            title={t('Result tables and downloads')}
            initialDataset="drugcomb_metrics"
            sectionId="drugcomb-data"
          />
        </DeepPage>
      ) : (
        <DrugCombReport route={route} />
      )}
    </ReportFrame>
  )
}

export function ThesisPage() {
  return (
    <article className="project-page thesis-page" lang="en">
      <ProjectHero
        project="thesis"
        title="Finding recurring problems in IT support data"
        question="Using NLP and unsupervised learning to uncover recurring IT issues and explore how data quality affects the usefulness of AI."
      />
      <ProjectSection id="thesis-motivation" title="Why I chose this project">
        <p>
          When an IT issue occurs, the immediate priority is to get people
          working again. But when similar incidents are handled separately,
          recurring problems can remain hidden in thousands of support tickets.
        </p>
        <p>
          For my thesis, I explored whether clustering could connect these
          incidents and highlight patterns worth investigating. I also wanted to
          understand how well this approach works with real operational data,
          where documentation is often incomplete and personal information needs
          to be protected.
        </p>
      </ProjectSection>
      <ProjectSection id="thesis-workflow" title="What I did">
        <p>
          I built an analysis pipeline that processed more than 21,000 support
          tickets and removed personal information before analysis.
        </p>
        <p>
          Using natural language processing (NLP), I converted ticket
          descriptions into numerical representations of their meaning. I then
          applied unsupervised learning to group similar incidents without
          predefined categories.
        </p>
        <p>
          Finally, I compared these clusters with existing problem records and
          assessed the underlying data quality using the ISO 25012 framework.
        </p>
      </ProjectSection>
      <ProjectSection id="thesis-quality" title="What I found">
        <p>
          The analysis identified 121 clusters of related incidents. Of these,
          72 had no link to an existing problem record, providing candidates for
          further investigation rather than confirmed root causes.
        </p>
        <p>
          Documentation was a major limitation. The field intended to describe
          the underlying cause was empty in around 96% of tickets. Where this
          information was available, it helped the analysis distinguish between
          issues more clearly.
        </p>
        <p>
          I also found that removing personal information could introduce
          artificial patterns into the text, affecting how some clusters formed.
        </p>
      </ProjectSection>
      <ProjectSection id="thesis-evaluation" title="Why it matters">
        <p>
          Clustering can help IT teams see connections across incidents that
          would be difficult to review manually. These connections could support
          investigation, prioritisation and efforts to prevent recurring
          disruptions.
        </p>
        <p>
          The main lesson was that useful AI depends on the quality of the
          information behind it. Better documentation and clearer links between
          incidents and known problems can be just as valuable as improving the
          model.
        </p>
        <p>
          The project produced an analysis pipeline and a set of candidate
          patterns for further review. Its impact on support workload, costs and
          resolution times would need to be evaluated through operational use.
        </p>
      </ProjectSection>
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
