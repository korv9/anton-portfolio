/** Each skill the ad asks for, with every ad sentence and every CV line behind the judgement. */
import { l } from '../i18n'
import type { Judgement } from './data'
import { cvLevelLabel, cvSection, sourceLabel } from './labels'

const ASKS: Record<Judgement['strength'], [string, string]> = {
  required: ['required', 'krav'],
  preferred: ['preferred', 'meriterande'],
  ambiguous: ['mentioned', 'nämns'],
}

type Props = {
  skills: Judgement[]
  /** Shows a line of the full ad text; absent when the text is not published for this ad. */
  onLine?: (line: number) => void
}

export default function Evidence({ skills, onLine }: Props) {
  return (
    <section aria-labelledby="ja-evidence">
      <h3 id="ja-evidence">
        {l('Requirements and CV evidence', 'Krav och belägg i cv:t')}
      </h3>
      <div className="ja-table-wrap">
        <table className="ja-table ja-evidence">
          <thead>
            <tr>
              <th scope="col">{l('Skill', 'Kompetens')}</th>
              <th scope="col">{l('The ad', 'Annonsen')}</th>
              <th scope="col">{l('The CV', 'Cv:t')}</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((j) => (
              <tr
                key={j.skill}
                data-gap={
                  j.cv_level !== 'practical' &&
                  j.cv_level !== 'education_or_project'
                }
              >
                <th scope="row">
                  {j.skill}
                  <span>{l(...ASKS[j.strength])}</span>
                </th>
                <td data-label={l('The ad', 'Annonsen')}>
                  {j.ad_quotes.map((q, i) => (
                    <p key={i}>
                      <q>{q.quote}</q>
                      {onLine && q.line != null && (
                        <button
                          type="button"
                          className="btn-text ja-line-link"
                          aria-label={l(
                            `Show line ${q.line} in the full ad`,
                            `Visa rad ${q.line} i hela annonsen`,
                          )}
                          onClick={() => onLine(q.line!)}
                        >
                          {l('line', 'rad')} {q.line}
                        </button>
                      )}
                    </p>
                  ))}
                </td>
                <td data-label={l('The CV', 'Cv:t')}>
                  <strong>{cvLevelLabel(j.cv_level)}</strong>
                  {j.cv_quotes.map((q, i) => (
                    <p key={i}>
                      <q>{q.quote}</q>
                      {(q.source || q.ref) && (
                        <small className="ja-ref">
                          {[sourceLabel(q.source), q.ref && cvSection(q.ref)]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
