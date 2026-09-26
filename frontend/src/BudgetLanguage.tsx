import { t } from './i18n'
export type LanguageRow = {
  corpus: string
  method: string
  session: string
  party: string
  expenditure_area: number
  occurrences: number
  keyword_share_pct: number | null
  forms: [string, number][]
}
type Coverage = {
  corpus: string
  method: string
  session: string
  party: string
  speeches: number
  words: number
  matched_speeches: number
  hits: number
  zero_areas: number
}
export type Language = {
  rows: LanguageRow[]
  coverage: Coverage[]
  lexicon: { expenditure_area: string; keyword: string }[]
}
export default function BudgetLanguage({
  data,
  session,
  corpus,
  method,
  area,
  setCorpus,
  setMethod,
}: {
  data: Language
  session: string
  corpus: string
  method: string
  area: number
  setCorpus: (s: string) => void
  setMethod: (s: string) => void
}) {
  const coverage = data.coverage.filter(
    (r) => r.session === session && r.corpus === corpus && r.method === method,
  )
  return (
    <section className="language-audit">
      <h4>{t('What counts as “talking about” an area?')}</h4>
      <p>
        {t(
          'A zero is no detected match, not silence or lack of support. Short\n        party-leader debates, a small vocabulary and exact word forms can all\n        create zeros. Issue debates cover a different agenda and are shown\n        separately.\n      ',
        )}
      </p>
      <div className="budget-controls">
        <label>
          {t('Speech corpus\n          ')}
          <select value={corpus} onChange={(e) => setCorpus(e.target.value)}>
            <option value="leaders">{t('Party-leader debates')}</option>
            <option value="issues">{t('Issue debates')}</option>
          </select>
        </label>
        <label>
          {t('Language method\n          ')}
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="exact">{t('Exact keyword baseline')}</option>
            <option value="stem">
              {t('Swedish stemming · exploratory NLP')}
            </option>
          </select>
        </label>
      </div>
      <p>
        <strong>
          {coverage.reduce((n, r) => n + r.zero_areas, 0)} {t('of')}{' '}
          {coverage.length * 27}{' '}
          {t('party–area cells have no matches.\n        ')}
        </strong>{' '}
        {coverage.reduce((n, r) => n + r.speeches, 0).toLocaleString('en-GB')}{' '}
        {t('eligible speeches;')}{' '}
        {coverage.reduce((n, r) => n + r.hits, 0).toLocaleString('en-GB')}{' '}
        {t(
          'area-assigned hits. All charts below use this corpus and method.\n      ',
        )}
      </p>
      <p className="evidence-note">
        {t(
          'The comparison uses the whole parliamentary session, including speeches\n        after the budget proposal. It describes topic attention, not what caused\n        a budget decision. Neither matching method detects support, opposition\n        or references to another party.\n      ',
        )}
      </p>
      <details>
        <summary>{t('Inspect coverage and matching words')}</summary>
        <div
          className="coverage-scroll"
          tabIndex={0}
          aria-label={t('Language coverage table')}
        >
          <table>
            <thead>
              <tr>
                <th>{t('Party')}</th>
                <th>{t('Speeches')}</th>
                <th>{t('With any match')}</th>
                <th>{t('Total hits')}</th>
                <th>{t('Zero areas / 27')}</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((r) => (
                <tr key={r.party}>
                  <th>{r.party}</th>
                  <td>{r.speeches}</td>
                  <td>{r.matched_speeches}</td>
                  <td>{r.hits}</td>
                  <td>{r.zero_areas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {t('Dictionary for the selected area:')}{' '}
          {data.lexicon
            .filter((r) => Number(r.expenditure_area) === area)
            .map((r) => r.keyword)
            .join(', ')}
          .
        </p>
        {data.rows
          .filter(
            (r) =>
              r.corpus === corpus &&
              r.method === method &&
              r.session === session &&
              r.expenditure_area === area,
          )
          .map((r) => (
            <p key={r.party}>
              <b>{r.party}</b>: {r.occurrences} {t('matches ·')}{' '}
              {r.forms.length
                ? r.forms.map(([w, n]) => `${w} (${n})`).join(', ')
                : t('No matching word forms')}
              {r.forms.length === 8 ? t(' · top 8 forms') : ''}
            </p>
          ))}
        <p>
          {t(
            'Stemming groups some inflected Swedish forms. It can also merge\n          unrelated words and does not resolve synonyms, compounds, context or\n          policy stance. It is a sensitivity check, not a validated semantic\n          classifier. Shares use all area-assigned hits within that party and\n          session; they are not a percentage of all speech.\n        ',
          )}
        </p>
      </details>
      <details>
        <summary>{t('How could semantic NLP improve this?')}</summary>
        <p>
          {t(
            "Next: split speeches into passages, retrieve candidate expenditure\n          areas with multilingual embeddings, then review multi-label\n          classifications against a hand-labelled Swedish sample. Keep an\n          “unclassified” category, report precision and recall per area, and\n          distinguish the speaker's proposal from criticism or quotations. Match\n          time windows to budget submission dates. More matches alone do not\n          demonstrate better results.\n        ",
          )}
        </p>
      </details>
    </section>
  )
}
