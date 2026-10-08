/**
 * Ledamöterna: find a member by name, party or constituency and see their registered votes and
 * how often a cast vote differed from their party's position. Secondary on the page, and said
 * plainly: absence and deviation are not opposition by themselves.
 */
import { useMemo, useState } from 'react'
import { l } from '../../i18n'
import { RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { num, pct } from '../controls'
import type { StoryData } from '../analytics/types'
import { calculateMemberDeviation } from '../analytics/metrics'
import { Info, Kpi, PartyMark, Section } from './parts'

export default function Ledamoterna({
  story,
  member,
  onMember,
}: {
  story: StoryData
  member: string
  onMember: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [party, setParty] = useState('')
  const [area, setArea] = useState('')
  const constituencies = useMemo(
    () =>
      [
        ...new Set(
          story.members.map((m) => m.constituency).filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b, 'sv')),
    [story.members],
  )
  const words = query.trim().toLowerCase()
  const found = story.members.filter(
    (m) =>
      (!words || m.name.toLowerCase().includes(words)) &&
      (!party || m.parties.includes(party)) &&
      (!area || m.constituency === area),
  )
  const chosen = story.members.find((m) => m.id === member) ?? null
  const registered = chosen
    ? chosen.yes + chosen.no + chosen.abstain + chosen.absent
    : 0

  return (
    <Section
      id="ledamoterna"
      kicker={l('The members', 'Ledamöterna')}
      question={l('Explore the members', 'Utforska ledamöterna')}
      lead={l(
        `${num(story.members.length)} members with registered votes in ${story.sessions.map((s) => s.replace('-', '/')).join(' and ')}.`,
        `${num(story.members.length)} ledamöter med registrerade röster under ${story.sessions.map((s) => s.replace('-', '/')).join(' och ')}.`,
      )}
      deeper={[
        {
          href: '#politik-roster',
          label: l('How the parties vote', 'Hur partierna röstar'),
        },
      ]}
    >
      <div className="story-filters">
        <label>
          {l('Name', 'Namn')}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={l('e.g. Andersson', 't.ex. Andersson')}
          />
        </label>
        <label>
          {l('Party', 'Parti')}
          <select value={party} onChange={(e) => setParty(e.target.value)}>
            <option value="">{l('All', 'Alla')}</option>
            {RIKSDAG_PARTIES.map((p) => (
              <option key={p} value={p}>
                {partyName(p)}
              </option>
            ))}
            <option value="-">
              {l('Independent (–)', 'Politisk vilde (–)')}
            </option>
          </select>
        </label>
        <label>
          {l('Constituency', 'Valkrets')}
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">{l('All', 'Alla')}</option>
            {constituencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="story-members">
        <ul aria-label={l('Members found', 'Hittade ledamöter')}>
          {found.slice(0, 40).map((m) => (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={chosen?.id === m.id}
                onClick={() => onMember(m.id)}
              >
                {m.name}{' '}
                {m.parties.map((p) =>
                  p === '-' ? (
                    <small key={p}>–</small>
                  ) : (
                    <PartyMark key={p} party={p} />
                  ),
                )}
              </button>
            </li>
          ))}
          {found.length > 40 && (
            <li className="story-more">
              {l(
                `${found.length - 40} more: narrow the search`,
                `${found.length - 40} till: smalna av sökningen`,
              )}
            </li>
          )}
          {!found.length && (
            <li className="story-more">
              {l('No member matches.', 'Ingen ledamot matchar.')}
            </li>
          )}
        </ul>
        {chosen ? (
          <article className="story-member" aria-live="polite">
            <h3>{chosen.name}</h3>
            <p className="story-meta">
              {chosen.parties
                .map((p) =>
                  p === '-' ? l('independent', 'politisk vilde') : partyName(p),
                )
                .join(' → ')}
              {chosen.constituency ? `, ${chosen.constituency}` : ''}
            </p>
            <dl className="story-kpis small">
              <Kpi
                value={num(registered)}
                label={l('Registered votes', 'Registrerade röster')}
              />
              <Kpi value={num(chosen.yes)} label={l('Yes', 'Ja')} />
              <Kpi value={num(chosen.no)} label={l('No', 'Nej')} />
              <Kpi value={num(chosen.abstain)} label={l('Abstain', 'Avstår')} />
              <Kpi
                value={num(chosen.absent)}
                label={l('Absent', 'Frånvaro')}
                note={pct((chosen.absent / (registered || 1)) * 100, 0)}
              />
              <Kpi
                value={pct(calculateMemberDeviation(chosen), 1)}
                label={
                  <Info term={l('Differs from party', 'Avviker från partiet')}>
                    {l(
                      'Cast votes (yes, no, abstain) that differ from the party’s position in that roll call, of the cast votes where the party had one.',
                      'Avgivna röster (ja, nej, avstår) som skiljer sig från partiets ståndpunkt i voteringen, av de avgivna röster där partiet hade en.',
                    )}
                  </Info>
                }
                note={`${num(chosen.deviating)} ${l('of', 'av')} ${num(chosen.compared)}`}
              />
            </dl>
            <p className="story-axis-note">
              {l(
                'Absence and deviation do not by themselves mean political opposition: absence includes sick leave, other assignments and pairing, and a member can vote differently by agreement. A member who changed party is compared with the party they belonged to at each vote.',
                'Frånvaro och avvikelse innebär inte automatiskt politisk opposition: frånvaro omfattar sjukdom, andra uppdrag och kvittning, och en ledamot kan rösta annorlunda efter överenskommelse. En ledamot som bytt parti jämförs med det parti hen tillhörde vid varje votering.',
              )}
            </p>
          </article>
        ) : (
          <p className="story-member empty">
            {l('Choose a member.', 'Välj en ledamot.')}
          </p>
        )}
      </div>
    </Section>
  )
}
