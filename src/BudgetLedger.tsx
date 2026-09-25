import { currentLocale, l, t } from './i18n'
import { useEffect, useMemo, useState } from 'react'

export type BudgetLine = {
  session: string
  budget_year: number
  expenditure_area: number
  expenditure_area_name: string
  actor: string
  amount_msek: number
  deviation_msek: number
  source_url: string
}
type BudgetContextYear = {
  session: string
  budget_year: number
  government_parties: string[]
  agreement_party: string[]
  agreement_source_url: string | null
  comparison_source_url: string
  adopted: 'alternative' | 'government_proposal'
  adopted_parties: string[]
  adoption_source_url: string
  frame_rows: Record<string, number>
  frame_status: string
  decision_point: string | null
  decision_date: string | null
  party_votes: {
    party: string
    position: string
    yes: number
    no: number
    abstain: number
    absent: number
  }[]
  cited_documents: { reference: string; type: string; url: string }[]
  reservations: string[]
  related_speeches: { party: string; url: string; evidence: string }[]
}
const money = (msek: number) => {
  const sv = currentLocale() === 'sv'
  const amount = Math.abs(msek) < 100 ? msek : msek / 1000
  return `${amount.toLocaleString(sv ? 'sv-SE' : 'en-GB', { maximumFractionDigits: 1 })} ${Math.abs(msek) < 100 ? (sv ? 'mnkr' : 'm SEK') : sv ? 'mdkr' : 'bn SEK'}`
}
const signed = (msek: number) =>
  `${msek > 0 ? '+' : msek < 0 ? '−' : ''}${money(Math.abs(msek))}`

export default function BudgetLedger({
  rows,
  nameOf,
}: {
  rows: BudgetLine[]
  nameOf: (area: number) => string
}) {
  const [year, setYear] = useState('2025/26')
  const [actor, setActor] = useState('S')
  const [selectedArea, setSelectedArea] = useState(9)
  const [context, setContext] = useState<BudgetContextYear[]>([])
  useEffect(() => {
    fetch('/data/gold/marts/budget-context.json')
      .then((response) => {
        if (!response.ok) throw new Error('Budget context unavailable')
        return response.json()
      })
      .then((report) => setContext(report.years))
      .catch(() => setContext([]))
  }, [])
  const years = context.length
    ? context.map((item) => item.session).reverse()
    : [...new Set(rows.map((row) => row.session))].sort().reverse()
  const selectedContext = context.find((item) => item.session === year)
  const inYear =
    selectedContext?.frame_status === 'partial'
      ? []
      : rows.filter((row) => row.session === year)
  const actors = [...new Set(inYear.map((row) => row.actor))].sort((a, b) =>
    a === 'GOV' ? -1 : b === 'GOV' ? 1 : a.localeCompare(b),
  )
  const chosen = actors.includes(actor) ? actor : 'GOV'
  const own = inYear.filter((row) => row.actor === chosen)
  const government = new Map(
    inYear
      .filter((row) => row.actor === 'GOV')
      .map((row) => [row.expenditure_area, row]),
  )
  const byArea = new Map(own.map((row) => [row.expenditure_area, row]))
  const budgetYear = selectedContext?.budget_year ?? inYear[0]?.budget_year
  const display = useMemo(
    () =>
      Array.from({ length: 27 }, (_, index) => index + 1).map((area) => {
        const row = byArea.get(area),
          gov = government.get(area)
        return {
          area,
          row,
          gov,
          difference: row && gov ? row.amount_msek - gov.amount_msek : null,
        }
      }),
    [own, inYear],
  )
  const complete = own.length === 27 && government.size === 27
  const top = [...display]
    .filter((item) => item.row)
    .sort((a, b) =>
      chosen === 'GOV'
        ? (b.row?.amount_msek ?? 0) - (a.row?.amount_msek ?? 0)
        : Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0),
    )
    .slice(0, 7)
  const max = Math.max(
    1,
    ...top.map((item) =>
      chosen === 'GOV'
        ? (item.row?.amount_msek ?? 0)
        : Math.abs(item.difference ?? 0),
    ),
  )
  const focus = display.find((item) => item.area === selectedArea)
  const total = own.reduce((sum, row) => sum + row.amount_msek, 0)
  const govTotal = [...government.values()].reduce(
    (sum, row) => sum + row.amount_msek,
    0,
  )
  return (
    <section
      className="budget-ledger"
      aria-label={t('Browse budget proposals')}
    >
      <p className="eyebrow">{t('Budget proposals / the money')}</p>
      <h4>{t('Choose a year and see each proposed spending frame.')}</h4>
      <p>
        {t(
          "All amounts below are proposed expenditure by area for the selected budget year. “Difference” means compared with the government's proposal for that same year. It is not a change from the previous year, actual spending or a measure of a party's support in a vote.",
        )}
      </p>
      <div className="budget-controls">
        <label>
          {t('Budget year')}
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setActor('GOV')
            }}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {Number(value.slice(0, 4)) + 1} · {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Proposal')}
          <select
            value={chosen}
            onChange={(e) => setActor(e.target.value)}
            disabled={!actors.length}
          >
            {actors.length ? (
              actors.map((value) => (
                <option key={value} value={value}>
                  {value === 'GOV'
                    ? l('Government (collective)', 'Regeringen (gemensamt)')
                    : value}
                </option>
              ))
            ) : (
              <option>
                {l('Figures not imported', 'Belopp ej importerade')}
              </option>
            )}
          </select>
        </label>
      </div>
      {selectedContext && (
        <div className="budget-year-context">
          <div className="budget-context-top">
            <div>
              <span className="eyebrow">
                {l('Who proposed it', 'Vem föreslog budgeten')}
              </span>
              <strong>{selectedContext.government_parties.join(' · ')}</strong>
              <small>
                {selectedContext.agreement_party.length
                  ? l(
                      `Budget agreement with ${selectedContext.agreement_party.join(', ')}`,
                      `Budgetöverenskommelse med ${selectedContext.agreement_party.join(', ')}`,
                    )
                  : l('Government proposal', 'Regeringens förslag')}
              </small>
            </div>
            <div>
              <span className="eyebrow">
                {l('What Parliament adopted', 'Vad riksdagen antog')}
              </span>
              <strong>
                {selectedContext.adopted === 'alternative'
                  ? l('Opposition alternative', 'Oppositionens alternativ')
                  : l('Government proposal', 'Regeringens förslag')}
              </strong>
              <small>{selectedContext.adopted_parties.join(' · ')}</small>
            </div>
          </div>
          <p>
            {selectedContext.adopted === 'alternative'
              ? l(
                  'The government figures below describe its submitted proposal, not the frames ultimately adopted for this year.',
                  'Regeringsbeloppen nedan gäller dess inlämnade förslag, inte de ramar som slutligen antogs detta år.',
                )
              : l(
                  'The government proposal was adopted. The figures below are proposal frames; later changes and actual spending are separate.',
                  'Regeringens förslag antogs. Beloppen nedan är föreslagna ramar; senare ändringar och utfall är separata.',
                )}
          </p>
          <a
            href={selectedContext.comparison_source_url}
            target="_blank"
            rel="noreferrer"
          >
            {l(
              'Read budget alternatives in FiU1 ↗',
              'Läs budgetalternativen i FiU1 ↗',
            )}
          </a>
          {' · '}
          <a
            href={selectedContext.adoption_source_url}
            target="_blank"
            rel="noreferrer"
          >
            {l('Decision source ↗', 'Källa till beslutet ↗')}
          </a>
          {selectedContext.agreement_source_url && (
            <>
              {' '}
              ·{' '}
              <a
                href={selectedContext.agreement_source_url}
                target="_blank"
                rel="noreferrer"
              >
                {l('Agreement source ↗', 'Källa till överenskommelsen ↗')}
              </a>
            </>
          )}
          {selectedContext.frame_status !== 'complete' && (
            <p className="budget-context-gap">
              {l(
                'The official document is available, but this site has no verified 27-area numeric import for this year. No amounts are filled in.',
                'Det officiella dokumentet finns, men webbplatsen saknar en verifierad import av 27 utgiftsområden för detta år. Inga belopp fylls i.',
              )}
            </p>
          )}
          {selectedContext.party_votes.length > 0 && (
            <div className="budget-vote-block">
              <strong>
                {l(
                  `Recorded FiU1 budget-frame vote · ${selectedContext.decision_date}`,
                  `Registrerad omröstning om budgetramar i FiU1 · ${selectedContext.decision_date}`,
                )}
              </strong>
              <div className="budget-vote-list">
                {selectedContext.party_votes.map((vote) => (
                  <span
                    key={vote.party}
                    className={`budget-vote budget-vote-${vote.position.toLowerCase()}`}
                  >
                    <b>{vote.party}</b>{' '}
                    {vote.position === 'Ja'
                      ? l('Yes', 'Ja')
                      : vote.position === 'Nej'
                        ? l('No', 'Nej')
                        : l('Abstained', 'Avstod')}{' '}
                    <small>
                      {vote.yes}/{vote.no}/{vote.abstain}
                    </small>
                  </span>
                ))}
              </div>
              <p>
                {l(
                  'Yes/No is to the Finance Committee proposal, not to every cited motion. Counts show members voting Yes/No/Abstain. A No vote does not establish why a party opposed the proposal; party alternatives and reservations give context.',
                  'Ja/Nej gäller finansutskottets förslag, inte varje citerad motion. Antalen visar ledamöter som röstade Ja/Nej/Avstod. En Nej-röst visar inte varför partiet motsatte sig förslaget; budgetalternativ och reservationer ger sammanhang.',
                )}
              </p>
              {selectedContext.reservations.length > 0 && (
                <p>
                  {l(
                    'Parties with reservations at this decision point:',
                    'Partier med reservationer vid denna beslutspunkt:',
                  )}{' '}
                  <b>{selectedContext.reservations.join(' · ')}</b>
                </p>
              )}
              {selectedContext.cited_documents.length > 0 && (
                <details>
                  <summary>
                    {l(
                      `Cited proposals and motions (${selectedContext.cited_documents.length})`,
                      `Citerade propositioner och motioner (${selectedContext.cited_documents.length})`,
                    )}
                  </summary>
                  <div className="budget-source-links">
                    {selectedContext.cited_documents.map((doc, index) => (
                      <a
                        key={`${doc.reference}-${index}`}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {doc.type === 'mot'
                          ? l('Motion', 'Motion')
                          : l('Proposition', 'Proposition')}{' '}
                        {doc.reference} ↗
                      </a>
                    ))}
                  </div>
                  <p>
                    {l(
                      'A citation links a document to the decision point; it does not mean the party supported it.',
                      'En hänvisning kopplar dokumentet till beslutspunkten; den betyder inte att partiet stödde det.',
                    )}
                  </p>
                </details>
              )}
              {selectedContext.related_speeches.length > 0 && (
                <details>
                  <summary>
                    {l(
                      'Related speeches to explore',
                      'Relaterade tal att utforska',
                    )}
                  </summary>
                  <div className="budget-source-links">
                    {selectedContext.related_speeches.map((speech) => (
                      <a
                        key={speech.party}
                        href={speech.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {speech.party} ↗
                      </a>
                    ))}
                  </div>
                  <p>
                    {l(
                      'These are semantic search candidates, not verified links between a statement and a vote or proof of motive.',
                      'Dessa är semantiska sökkandidater, inte verifierade kopplingar mellan ett uttalande och en röst eller bevis för motiv.',
                    )}
                  </p>
                </details>
              )}
            </div>
          )}
          {selectedContext.government_parties.length > 0 && (
            <p className="budget-context-note">
              {l(
                'A collective government budget is shown once. Missing separate rows for governing or agreement parties are not zero amounts.',
                'En gemensam regeringsbudget visas en gång. Saknade separata rader för regerings- eller avtalspartier är inte nollbelopp.',
              )}
            </p>
          )}
        </div>
      )}
      <div className="budget-ledger-summary">
        <div>
          <strong>{budgetYear}</strong>
          <span>
            {t('Budget year · session ')}
            {year}
          </span>
        </div>
        <div>
          <strong>
            {selectedContext?.frame_rows[chosen] ?? own.length}/27
          </strong>
          <span>
            {t('Areas present for ')}
            {chosen}
          </span>
        </div>
        <div>
          <strong>{complete ? money(total) : t('Incomplete')}</strong>
          <span>
            {t(
              complete
                ? 'Total proposed expenditure'
                : 'No comparable total calculated',
            )}
          </span>
        </div>
        <div>
          <strong>
            {complete && chosen !== 'GOV' ? signed(total - govTotal) : '—'}
          </strong>
          <span>{t('Versus government · complete frames only')}</span>
        </div>
      </div>
      <p className="budget-ledger-coverage">
        {t('Available in this import: ')}
        {selectedContext?.frame_status === 'partial'
          ? l(
              'partial import withheld from the charts pending column validation',
              'ofullständig import dold i graferna tills kolumnerna har validerats',
            )
          : actors.length
            ? actors
                .map(
                  (code) =>
                    `${code} ${inYear.filter((row) => row.actor === code).length}/27`,
                )
                .join(' · ')
            : l('no numeric frames', 'inga numeriska ramar')}
        {t(
          '. A missing separate party frame cannot be inferred from the collective government proposal.',
        )}
      </p>
      <div className="budget-ledger-layout">
        <div>
          <p className="eyebrow">
            {t(
              chosen === 'GOV'
                ? 'Largest spending areas'
                : 'Largest differences, either direction',
            )}
          </p>
          {top.map(({ area, row, difference }) => (
            <button
              key={area}
              className="budget-ledger-bar"
              aria-pressed={selectedArea === area}
              onClick={() => setSelectedArea(area)}
            >
              <span>
                <b>{nameOf(area)}</b>
                <strong>
                  {chosen === 'GOV'
                    ? money(row!.amount_msek)
                    : signed(difference ?? 0)}
                </strong>
              </span>
              <i
                className={
                  difference != null && difference < 0 ? 'negative' : ''
                }
                style={{
                  width: `${Math.max(1, ((chosen === 'GOV' ? row!.amount_msek : Math.abs(difference ?? 0)) / max) * 100)}%`,
                }}
              />
            </button>
          ))}
        </div>
        <aside className="budget-ledger-detail">
          <p className="eyebrow">
            {t('Area ')}
            {selectedArea} · {nameOf(selectedArea)}
          </p>
          {focus?.row ? (
            <>
              <strong>{money(focus.row.amount_msek)}</strong>
              <p>
                {chosen === 'GOV'
                  ? t('Government proposal')
                  : currentLocale() === 'sv'
                    ? `${chosen}:s förslag`
                    : `${chosen}'s proposal`}
                {focus.gov && chosen !== 'GOV'
                  ? currentLocale() === 'sv'
                    ? ` · ${signed(focus.difference ?? 0)} jämfört med regeringen`
                    : ` · ${signed(focus.difference ?? 0)} relative to government`
                  : ''}
              </p>
              <a href={focus.row.source_url} target="_blank" rel="noreferrer">
                {t('Read the parliamentary comparison table ↗')}
              </a>
            </>
          ) : (
            <p>{t('This proposal has no imported row for this area.')}</p>
          )}
        </aside>
      </div>
      <details className="budget-ledger-all">
        <summary>
          {t('View all 27 expenditure areas and source amounts')}
        </summary>
        <div
          className="coverage-scroll"
          tabIndex={0}
          aria-label={t('All expenditure areas, scroll horizontally')}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">{t('Area')}</th>
                <th scope="col">{t('Government amount')}</th>
                <th scope="col">
                  {chosen} {t('amount')}
                </th>
                <th scope="col">{t('Difference')}</th>
                <th scope="col">{t('Source')}</th>
              </tr>
            </thead>
            <tbody>
              {display.map(({ area, row, gov, difference }) => (
                <tr key={area}>
                  <th scope="row">
                    {area}. {nameOf(area)}
                  </th>
                  <td>{gov ? money(gov.amount_msek) : t('Missing')}</td>
                  <td>{row ? money(row.amount_msek) : t('Missing')}</td>
                  <td>{difference == null ? '—' : signed(difference)}</td>
                  <td>
                    {row && (
                      <a href={row.source_url} target="_blank" rel="noreferrer">
                        {t('Riksdagen ↗')}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
