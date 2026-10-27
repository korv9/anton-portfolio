/** Project pages that are a single report: DrugComb, Allegoria, the degree project and Homie. */
import { lazy } from 'react'
import { l, t } from '../i18n'
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

export { ThesisPage } from './ThesisCase'

export function HomiePage() {
  return (
    <div className="project-page">
      <Stage
        id="homie-stage"
        level={1}
        kicker={l(
          'Homie API · contract-first backend',
          'Homie API · kontraktsdriven backend',
        )}
        title={l(
          'A backend for household events',
          'En backend för hushållets händelser',
        )}
        lead={l(
          'A 16-operation OpenAPI contract, fixed first. Chore completions are immutable events, aggregated in SQL into five materialized views. Auth and health are live, CI migrates and seeds PostgreSQL 16 and passes, and the remaining routes return contract-exact previews.',
          'Ett OpenAPI-kontrakt med 16 operationer, fastlagt först. Utförda sysslor är oföränderliga händelser som aggregeras i SQL till fem materialiserade vyer. Inloggning och hälsa är live, CI migrerar och seedar PostgreSQL 16 och går igenom, och övriga rutter returnerar kontraktsexakta förhandsvisningar.',
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
            <StageBlock title={l('Contract', 'Kontrakt')}>
              <StageFacts
                rows={[
                  [
                    l('Operations in contract', 'Operationer i kontraktet'),
                    '16',
                  ],
                  [l('Built and tested', 'Byggda och testade'), '4'],
                  [
                    l('CI on PostgreSQL 16', 'CI mot PostgreSQL 16'),
                    <a
                      key="ci"
                      href="https://github.com/korv9/homie-api/actions/runs/34777312347"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l('passing', 'godkänd')}
                    </a>,
                  ],
                ]}
              />
              <p>
                {l(
                  'CI migrates the schema, runs the seed twice to prove it idempotent, then passes all 7 tests. Previews carry no real household data.',
                  'CI migrerar schemat, kör seeden två gånger för att visa att den är idempotent och klarar sedan alla 7 tester. Förhandsvisningarna innehåller ingen riktig hushållsdata.',
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
