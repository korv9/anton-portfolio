/**
 * The Startup AI Act Navigator: a few yes / no / not sure questions that point to the parts of
 * the Act a scenario may involve. The rules are editorial (navigator.json); the result lists
 * roles, risk classes and obligations, each tied to its article, and never classifies anyone.
 */
import { useMemo } from 'react'
import { l } from '../i18n'
import { isShown, navigatorResult } from './logic'
import {
  actorLabel,
  ArticleLink,
  Kind,
  pick,
  requirementLabel,
  Source,
} from './shared'
import { ObligationList } from './views'
import type { AiActData, Answer } from './types'

const ANSWERS: [Answer, string, string][] = [
  ['yes', 'Yes', 'Ja'],
  ['no', 'No', 'Nej'],
  ['unsure', 'Not sure', 'Vet inte'],
]

export function NavigatorView({
  data,
  today,
  encoded,
  setEncoded,
}: {
  data: AiActData
  today: string
  encoded: string
  setEncoded: (value: string) => void
}) {
  // Answers live in the address (?svar=builds_model:yes,own_product:no) so a scenario can be shared.
  const answers = useMemo(() => {
    const out: Record<string, Answer> = {}
    for (const pair of encoded.split(',').filter(Boolean)) {
      const [id, a] = pair.split(':')
      if (a === 'yes' || a === 'no' || a === 'unsure') out[id] = a
    }
    return out
  }, [encoded])
  const answer = (id: string, a: Answer) => {
    const next = { ...answers }
    if (next[id] === a) delete next[id]
    else next[id] = a
    setEncoded(
      Object.entries(next)
        .map(([k, v]) => `${k}:${v}`)
        .join(','),
    )
  }
  const nav = data.navigator
  const questions = nav.questions.filter((q) => isShown(q, answers))
  const result = navigatorResult(nav, answers, data.obligations)
  const classLabel = (id: string) => {
    const r = data.riskClasses.find((x) => x.risk_class_id === id)
    return r ? l(r.label_en, r.label_sv) : id
  }

  return (
    <div className="aa-navigator">
      <p className="aa-disclaimer" role="note">
        {pick(nav.disclaimer)}
      </p>
      <div className="aa-nav-grid">
        <ol className="aa-questions">
          {questions.map((q, i) => (
            <li key={q.id} className="aa-question">
              <fieldset>
                <legend>
                  <span className="aa-q-number">{i + 1}</span>
                  {pick(q.text)}
                </legend>
                <div className="aa-answers">
                  {ANSWERS.map(([a, en, sv]) => (
                    <label
                      key={a}
                      className={answers[q.id] === a ? 'is-chosen' : ''}
                    >
                      <input
                        type="checkbox"
                        checked={answers[q.id] === a}
                        onChange={() => answer(q.id, a)}
                      />
                      {l(en, sv)}
                    </label>
                  ))}
                </div>
                <p className="aa-meta">
                  {q.articles.map((a, j) => (
                    <span key={a}>
                      {j > 0 && ' · '}
                      <ArticleLink n={a} />
                    </span>
                  ))}
                </p>
              </fieldset>
            </li>
          ))}
        </ol>

        <aside
          className="aa-result"
          aria-live="polite"
          aria-labelledby="aa-result-title"
        >
          <p className="aa-kicker">
            {l('Potentially relevant', 'Möjligen relevant')}{' '}
            <Kind type="interpretation" />
          </p>
          <p className="aa-result-aid">
            {l(
              'Navigation aid, not legal advice.',
              'Navigationsstöd, inte juridisk rådgivning.',
            )}
          </p>
          <h2 id="aa-result-title">
            {result.answered
              ? l('This scenario may involve', 'Scenariot kan beröra')
              : l(
                  'Answer a question to begin',
                  'Svara på en fråga för att börja',
                )}
          </h2>
          {result.answered > 0 && (
            <>
              <dl>
                <div>
                  <dt>{l('Role considerations', 'Roller att överväga')}</dt>
                  <dd>
                    {result.roles.length
                      ? result.roles
                          .map((r) => actorLabel(data.actors, r))
                          .join(', ')
                      : l('None established yet', 'Ingen fastställd ännu')}
                  </dd>
                </div>
                <div>
                  <dt>{l('Risk classes', 'Riskklasser')}</dt>
                  <dd>
                    {result.riskClasses.length
                      ? result.riskClasses.map(classLabel).join(', ')
                      : '–'}
                  </dd>
                </div>
                {result.obligations.length > 0 && (
                  <div>
                    <dt>{l('Topics', 'Ämnen')}</dt>
                    <dd>
                      {[
                        ...new Set(
                          result.obligations.map((o) => o.requirement_type),
                        ),
                      ]
                        .map(requirementLabel)
                        .join(', ')}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{l('Articles to read', 'Artiklar att läsa')}</dt>
                  <dd>
                    {result.articles.map((a, i) => (
                      <span key={a}>
                        {i > 0 && ', '}
                        <ArticleLink n={a}>{a}</ArticleLink>
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
              <p className="aa-meta">
                {l('Official source', 'Officiell källa')}:{' '}
                <Source href={data.summary.current_version.source_url}>
                  {l(
                    `The consolidated text of ${data.summary.current_version.published_at}`,
                    `Den konsoliderade texten från ${data.summary.current_version.published_at}`,
                  )}
                </Source>
              </p>
              {result.notes.length > 0 && (
                <ul className="aa-notes">
                  {result.notes.map((n) => (
                    <li key={n.question}>{pick(n.text)}</li>
                  ))}
                </ul>
              )}
              <p className="aa-muted aa-small">
                {l(
                  'This scenario may involve the obligations below. Whether they apply depends on the facts and the full text; check the official source.',
                  'Scenariot kan beröra skyldigheterna nedan. Om de gäller beror på omständigheterna och hela texten; kontrollera den officiella källan.',
                )}
              </p>
              <button
                type="button"
                className="aa-reset"
                onClick={() => setEncoded('')}
              >
                {l('Start over', 'Börja om')}
              </button>
            </>
          )}
        </aside>
      </div>

      {result.obligations.length > 0 && (
        <section className="aa-section">
          <h2>
            {l(
              `${result.obligations.length} obligations to look at`,
              `${result.obligations.length} skyldigheter att titta på`,
            )}
          </h2>
          <ObligationList
            data={data}
            today={today}
            items={result.obligations}
          />
        </section>
      )}
    </div>
  )
}
