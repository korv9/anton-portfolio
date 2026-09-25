import { t } from './i18n'
import { fetchData } from './dataSource'
import { useEffect, useState } from 'react'

type Version = {
  rfc: number
  requirements: number
  counts: Record<string, number>
  shares_pct: Record<string, number>
  url: string
  sha256: string
}
type Report = {
  versions: Version[]
  matched_changes: unknown[]
  scenarios: { before: string; after: string; direction: string }[]
}
export default function RfcReport() {
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState(false)
  const [scenario, setScenario] = useState(0)
  useEffect(() => {
    fetchData('gold/marts/rfc-drift.json')
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
  }, [])
  return (
    <article className="report rfc-report" id="rfc-drift">
      <p className="eyebrow">
        {t('Allegoria · a small experiment in RFC drift')}
      </p>
      <h2>{t('When MUST becomes SHOULD.')}</h2>
      <p>
        {t(
          "Can a small change in wording weaken a technical requirement?\n        Allegoria's meaningquality engine makes that change explicit. Here, a\n        cookie-specification comparison and a controlled example show what it\n        can—and cannot—measure.\n      ",
        )}
      </p>
      {error && <p role="alert">{t('The RFC export could not be loaded.')}</p>}
      {data && (
        <>
          <div className="politics-grid">
            <section className="politics-card">
              <h3>{t('01 / The language profile changed')}</h3>
              <p>
                {t(
                  'RFC 2965 (2000) → RFC 6265 (2011). Share of statements extracted\n                by the heuristic reader, grouped by their first requirement\n                keyword.\n              ',
                )}
              </p>
              {data.versions.map((v) => (
                <div className="rfc-version" key={v.rfc}>
                  <h4>
                    {t('RFC ')}
                    {v.rfc}{' '}
                    <small>
                      {v.requirements} {t('extracted statements')}
                    </small>
                  </h4>
                  {[
                    ['binding', 'MUST / binding'],
                    ['weak', 'SHOULD / recommended'],
                    ['absent', 'MAY / optional'],
                  ].map(([key, label]) => (
                    <div className="rfc-bar" key={key}>
                      <span>{label}</span>
                      <span className="metric-track">
                        <i style={{ width: `${v.shares_pct[key]}%` }} />
                      </span>
                      <strong>
                        {v.shares_pct[key]}% <small>({v.counts[key]})</small>
                      </strong>
                    </div>
                  ))}
                </div>
              ))}
              <p className="evidence-note">
                {t(
                  'A different document-wide profile is not proof that the protocol\n                became looser. These documents differ in content, scope and\n                wording.\n              ',
                )}
              </p>
            </section>
            <section className="politics-card">
              <h3>{t('02 / A change the engine can explain')}</h3>
              <p>
                {t(
                  'Synthetic example · the actor and action stay identical. Only\n                obligation strength changes.\n              ',
                )}
              </p>
              <label>
                {t('Requirement change\n                ')}
                <select
                  value={scenario}
                  onChange={(e) => setScenario(Number(e.target.value))}
                >
                  <option value="0">{t('MUST → SHOULD')}</option>
                  <option value="1">{t('SHOULD → MUST')}</option>
                  <option value="2">{t('MUST → MUST')}</option>
                </select>
              </label>
              <div className="rfc-example">
                <p>
                  {t('Before: The client')}{' '}
                  <strong>{scenario === 1 ? 'SHOULD' : 'MUST'}</strong>{' '}
                  {t(
                    'validate\n                  the response.\n                ',
                  )}
                </p>
                <p>
                  {t('After: The client')}{' '}
                  <strong>{scenario === 0 ? 'SHOULD' : 'MUST'}</strong>{' '}
                  {t(
                    'validate\n                  the response.\n                ',
                  )}
                </p>
              </div>
              <div className="engine-result">
                <span>{t('Actual meaningquality output')}</span>
                <strong>{data.scenarios[scenario].direction}</strong>
              </div>
              <p>
                {t(
                  "The result is computed offline using an annotated duty's\n                modality change. It is not a claim about a real amendment in\n                these RFCs.\n              ",
                )}
              </p>
              <h4>
                {data.matched_changes.length} {t('matched keyword changes')}
              </h4>
              <p>
                {t(
                  'The strict sentence-matching method found no changed requirement\n                pairs in the real comparison. That is a matching limitation, not\n                evidence that nothing changed.\n              ',
                )}
              </p>
            </section>
          </div>
          <details className="budget-method">
            <summary>{t('Method, sources & limitations')}</summary>
            <p>
              {t(
                'The reader groups MUST/SHALL/REQUIRED, SHOULD/RECOMMENDED and\n              MAY/OPTIONAL, including negative forms. It uses the first keyword\n              per extracted sentence, skips quoted sentences and heuristically\n              removes page furniture. Extraction recall has not been\n              independently evaluated. It can miss multiple obligations,\n              conditions, exceptions and rewritten requirements. Optional is\n              displayed as optional, not missing data.\n            ',
              )}
            </p>
            <p>
              {t(
                "Real drift needs reviewed matches for the same actor, action,\n              polarity and scope. The engine's direction rules are tested\n              separately from this reader. Counts measure extracted statements,\n              not every requirement in a standard.\n            ",
              )}
            </p>
            {data.versions.map((v) => (
              <p key={v.rfc}>
                <a href={v.url} target="_blank" rel="noreferrer">
                  {t('RFC ')}
                  {v.rfc} {t('source ↗\n                ')}
                </a>
                <small className="source-hash">
                  {t('Snapshot SHA-256: ')}
                  {v.sha256}
                </small>
              </p>
            ))}
            <a
              href="https://www.rfc-editor.org/rfc/rfc2119"
              target="_blank"
              rel="noreferrer"
            >
              {t('RFC 2119 requirement levels ↗\n            ')}
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/korv9/allegoria"
              target="_blank"
              rel="noreferrer"
            >
              {t('Allegoria source ↗\n            ')}
            </a>
          </details>
        </>
      )}
    </article>
  )
}
