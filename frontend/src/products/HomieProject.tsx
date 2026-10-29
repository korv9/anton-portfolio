import { l } from '../i18n'

const CI_RUN = 'https://github.com/korv9/homie-api/actions/runs/34777312347'
const PIN =
  'https://github.com/korv9/homie-api/blob/3c6da1ae24869107bd4b5f0fad10f0f7ed2de1af'

export default function HomieProject() {
  return (
    <article className="report homie-project" id="homie">
      <h2>
        {l(
          'From household events to useful summaries.',
          'Från hushållshändelser till användbara sammanställningar.',
        )}
      </h2>
      <p className="report-intro">
        {l(
          'A FastAPI backend where chore completions are immutable events and workload, balance and cadence are computed in SQL. The OpenAPI contract with 16 operations came first; the code is built against it.',
          'En FastAPI-backend där utförda sysslor är oföränderliga händelser och belastning, balans och rytm räknas fram i SQL. OpenAPI-kontraktet med 16 operationer kom först; koden byggs mot det.',
        )}
      </p>
      <ol className="pipeline-strip">
        <li>
          <strong>{l('Record', 'Spara')}</strong>
          <span>
            {l('Immutable completion events', 'Oföränderliga utföranden')}
          </span>
        </li>
        <li>
          <strong>{l('Enrich', 'Berika')}</strong>
          <span>
            {l(
              'Household, task and member context',
              'Hushåll, uppgift och medlem',
            )}
          </span>
        </li>
        <li>
          <strong>{l('Aggregate', 'Aggregera')}</strong>
          <span>
            {l(
              'Five materialized views: workload, balance, cadence, categories, heatmap',
              'Fem materialiserade vyer: belastning, balans, rytm, kategorier, värmekarta',
            )}
          </span>
        </li>
        <li>
          <strong>{l('Serve', 'Servera')}</strong>
          <span>
            {l(
              'Typed FastAPI response contracts',
              'Typade FastAPI-svarskontrakt',
            )}
          </span>
        </li>
      </ol>
      <div className="product-analysis-grid">
        <section className="analysis-panel">
          <h3>{l('Built and tested', 'Byggt och testat')}</h3>
          <p>
            {l(
              '4 of the 16 operations are live: register, log in, current member and a health check. CI migrates PostgreSQL 16, runs the seed twice and tests the append-only trigger. ',
              '4 av de 16 operationerna är i drift: registrering, inloggning, aktuell medlem och en hälsokontroll. CI migrerar PostgreSQL 16, kör seeden två gånger och testar append-only-triggern. ',
            )}
            <a href={CI_RUN} target="_blank" rel="noreferrer">
              {l(
                'Run 34777312347: 7 of 7 tests pass',
                'Körning 34777312347: 7 av 7 tester godkända',
              )}
            </a>
            .
          </p>
        </section>
        <section className="analysis-panel">
          <h3>{l('Defined by the contract', 'Definierat av kontraktet')}</h3>
          <p>
            {l(
              'The other 12 operations answer with contract-exact previews. Balance index: 1 − Σ|share − 1/n| / (2(1 − 1/n)) per week.',
              'De övriga 12 operationerna svarar med förhandsvisningar enligt kontraktet. Balansindex: 1 − Σ|andel − 1/n| / (2(1 − 1/n)) per vecka.',
            )}
          </p>
        </section>
      </div>
      <div className="product-actions">
        <a
          href="https://github.com/korv9/homie-api/tree/3c6da1ae24869107bd4b5f0fad10f0f7ed2de1af"
          target="_blank"
          rel="noreferrer"
        >
          {l('Source code', 'Källkod')}
        </a>
        <a href={`${PIN}/openapi.json`} target="_blank" rel="noreferrer">
          {l('OpenAPI contract', 'OpenAPI-kontrakt')}
        </a>
        <a href={CI_RUN} target="_blank" rel="noreferrer">
          {l('CI run on PostgreSQL 16', 'CI-körning mot PostgreSQL 16')}
        </a>
      </div>
    </article>
  )
}
