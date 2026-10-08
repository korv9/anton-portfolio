/**
 * Whose budget this is: the budget year and riksmöte, the government parties that proposed it
 * (and any party it was agreed with), what the Riksdag adopted and when, and how each party
 * voted on the frame. From gold/marts/budget-context.json.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load } from '../../parliament/data'
import { PartyLogo, RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { dayName } from '../controls'

type Vote = { party: string; position: string; yes: number; no: number }
type ContextYear = {
  session: string
  budget_year: number
  government_parties: string[]
  agreement_party: string[]
  agreement_source_url: string | null
  comparison_source_url: string | null
  adopted: 'government_proposal' | 'alternative'
  adopted_parties: string[]
  adoption_source_url: string | null
  decision_date: string | null
  party_votes: Vote[]
}

let pending: Promise<ContextYear[]> | null = null
const loadContext = () =>
  (pending ??= load<{ years: ContextYear[] }>(
    'gold/marts/budget-context.json',
  ).then((r) => r.years))

function Parties({ codes }: { codes: string[] }) {
  return (
    <span className="budget-id-parties">
      {codes.map((p) => (
        <span key={p} title={partyName(p)}>
          {RIKSDAG_PARTIES.includes(p) && <PartyLogo party={p} size={22} />}
          {p}
        </span>
      ))}
    </span>
  )
}

export default function BudgetIdentity({ year }: { year: number }) {
  const [years, setYears] = useState<ContextYear[] | null>(null)
  useEffect(() => {
    loadContext()
      .then(setYears)
      .catch(() => setYears([]))
  }, [])
  const c = years?.find((y) => y.budget_year === year)
  if (!years) return null
  const session = `${year - 1}/${String(year).slice(2)}`
  const order = { Ja: 0, Avstår: 1, Nej: 2 } as Record<string, number>
  return (
    <section
      className="budget-id"
      aria-label={l(`The budget for ${year}`, `Budgeten för ${year}`)}
    >
      <div className="budget-id-year">
        <span>{l('The budget for', 'Budgeten för')}</span>
        <strong>{year}</strong>
        <small>
          {l('Riksmöte', 'Riksmötet')} {session},{' '}
          {l('Budget bill', 'Budgetpropositionen')} {session}:1
        </small>
      </div>
      {c ? (
        <>
          <div>
            <span className="budget-id-label">
              {l('Proposed by', 'Lagd av')}
            </span>
            <Parties codes={c.government_parties} />
            <small>
              {c.agreement_party.length ? (
                <>
                  {l('Agreed with', 'Överenskommen med')}{' '}
                  {c.agreement_party.map(partyName).join(', ')}
                  {c.agreement_source_url && (
                    <>
                      {', '}
                      <a
                        href={c.agreement_source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {l('agreement', 'överenskommelsen')}
                      </a>
                    </>
                  )}
                </>
              ) : (
                l('The government alone', 'Regeringen ensam')
              )}
            </small>
          </div>
          <div>
            <span className="budget-id-label">
              {l('The Riksdag adopted', 'Riksdagen antog')}
            </span>
            <b>
              {c.adopted === 'alternative'
                ? l('An opposition alternative', 'Ett oppositionsalternativ')
                : l('The government’s proposal', 'Regeringens förslag')}
            </b>
            <small>
              {c.decision_date ? `${dayName(c.decision_date)}, ` : ''}
              {l('backed by', 'med stöd av')} {c.adopted_parties.join(', ')}
              {c.adoption_source_url && (
                <>
                  {', '}
                  <a
                    href={c.adoption_source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l('the decision', 'beslutet')}
                  </a>
                </>
              )}
            </small>
          </div>
          {c.party_votes.length > 0 && (
            <div>
              <span className="budget-id-label">
                {l('How they voted on the frame', 'Så röstade de om ramen')}
              </span>
              <ul className="budget-id-votes">
                {[...c.party_votes]
                  .sort(
                    (a, b) =>
                      (order[a.position] ?? 3) - (order[b.position] ?? 3),
                  )
                  .map((v) => (
                    <li
                      key={v.party}
                      className={
                        v.position === 'Ja'
                          ? 'yes'
                          : v.position === 'Nej'
                            ? 'no'
                            : 'abstain'
                      }
                      title={`${partyName(v.party)}: ${v.position}`}
                    >
                      {v.party} <small>{v.position}</small>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="dash-empty">
          {l(
            'Who proposed and adopted this year’s budget is not recorded yet.',
            'Vem som lade och antog årets budget är inte registrerat ännu.',
          )}
        </p>
      )}
    </section>
  )
}
