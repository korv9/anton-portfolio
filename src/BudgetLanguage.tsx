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
      <h4>What counts as “talking about” an area?</h4>
      <p>
        A zero is no detected match, not silence or lack of support. Short
        party-leader debates, a small vocabulary and exact word forms can all
        create zeros. Issue debates cover a different agenda and are shown
        separately.
      </p>
      <div className="budget-controls">
        <label>
          Speech corpus
          <select value={corpus} onChange={(e) => setCorpus(e.target.value)}>
            <option value="leaders">Party-leader debates</option>
            <option value="issues">Issue debates</option>
          </select>
        </label>
        <label>
          Language method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="exact">Exact keyword baseline</option>
            <option value="stem">Swedish stemming · exploratory NLP</option>
          </select>
        </label>
      </div>
      <p>
        <strong>
          {coverage.reduce((n, r) => n + r.zero_areas, 0)} of{' '}
          {coverage.length * 27} party–area cells have no matches.
        </strong>{' '}
        {coverage.reduce((n, r) => n + r.speeches, 0).toLocaleString('en-GB')}{' '}
        eligible speeches;{' '}
        {coverage.reduce((n, r) => n + r.hits, 0).toLocaleString('en-GB')}{' '}
        area-assigned hits. All charts below use this corpus and method.
      </p>
      <p className="evidence-note">
        The comparison uses the whole parliamentary session, including speeches
        after the budget proposal. It describes topic attention, not what caused
        a budget decision. Neither matching method detects support, opposition
        or references to another party.
      </p>
      <details>
        <summary>Inspect coverage and matching words</summary>
        <div
          className="coverage-scroll"
          tabIndex={0}
          aria-label="Language coverage table"
        >
          <table>
            <thead>
              <tr>
                <th>Party</th>
                <th>Speeches</th>
                <th>With any match</th>
                <th>Total hits</th>
                <th>Zero areas / 27</th>
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
          Dictionary for the selected area:{' '}
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
              <b>{r.party}</b>: {r.occurrences} matches ·{' '}
              {r.forms.length
                ? r.forms.map(([w, n]) => `${w} (${n})`).join(', ')
                : 'No matching word forms'}
              {r.forms.length === 8 ? ' · top 8 forms' : ''}
            </p>
          ))}
        <p>
          Stemming groups some inflected Swedish forms. It can also merge
          unrelated words and does not resolve synonyms, compounds, context or
          policy stance. It is a sensitivity check, not a validated semantic
          classifier. Shares use all area-assigned hits within that party and
          session; they are not a percentage of all speech.
        </p>
      </details>
      <details>
        <summary>How could semantic NLP improve this?</summary>
        <p>
          Next: split speeches into passages, retrieve candidate expenditure
          areas with multilingual embeddings, then review multi-label
          classifications against a hand-labelled Swedish sample. Keep an
          “unclassified” category, report precision and recall per area, and
          distinguish the speaker's proposal from criticism or quotations. Match
          time windows to budget submission dates. More matches alone do not
          demonstrate better results.
        </p>
      </details>
    </section>
  )
}
