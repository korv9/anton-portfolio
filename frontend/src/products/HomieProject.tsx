import { t } from '../i18n'
export default function HomieProject() {
  return (
    <article className="report homie-project" id="homie">
      <p className="eyebrow">{t('Homie API / backend engineering')}</p>
      <h2>{t('From household events to useful summaries.')}</h2>
      <p className="report-intro">
        {t(
          'An API and data-model project exploring how chore-completion events can support workload, balance and cadence reports. It is an implementation in progress with an explicit API contract.',
        )}
      </p>
      <ol className="pipeline-strip">
        <li>
          <strong>{t('Record')}</strong>
          <span>{t('Immutable completion events')}</span>
        </li>
        <li>
          <strong>{t('Enrich')}</strong>
          <span>{t('Household, task and member context')}</span>
        </li>
        <li>
          <strong>{t('Aggregate')}</strong>
          <span>{t('Weekly workload, fairness and cadence')}</span>
        </li>
        <li>
          <strong>{t('Serve')}</strong>
          <span>{t('Typed FastAPI response contracts')}</span>
        </li>
      </ol>
      <div className="product-analysis-grid">
        <section className="analysis-panel">
          <h3>{t('Implemented')}</h3>
          <p>
            {t(
              'Authentication, password hashing, database health checks, database schema and aggregation SQL. The design separates event records from the materialized views intended for analytics.',
            )}
          </p>
        </section>
        <section className="analysis-panel">
          <h3>{t('Still stubbed')}</h3>
          <p>
            {t(
              'Household, task, completion and analytics routes return documented previews or synthetic fixtures. Stub writes do not persist changes. No real household metrics are presented here.',
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
          {t('Source & implementation status ↗')}
        </a>
        <a
          href="https://github.com/korv9/homie-api/blob/3c6da1ae24869107bd4b5f0fad10f0f7ed2de1af/openapi.json"
          target="_blank"
          rel="noreferrer"
        >
          {t('OpenAPI contract ↗')}
        </a>
      </div>
    </article>
  )
}
