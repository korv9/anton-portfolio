/**
 * Läget just nu: the new Riksdag's seats, who governs, and whether the governing side has a
 * majority. From parliament/now.json (Valmyndigheten, Regeringskansliet, Riksdagen).
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load, type Now } from '../../parliament/data'
import { PartyName, identity, partyName } from '../../parties/identity'
import ThemeLayout from '../ThemeLayout'
import { dayName, num, pct, signed } from '../controls'

const TOTAL = 349

type Bloc = { key: string; label: string; parties: Now['election']['parties'] }

export default function LageTheme() {
  const [now, setNow] = useState<Now | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    load<Now>('parliament/now.json')
      .then(setNow)
      .catch((e: Error) => setError(e.message))
  }, [])

  const deepLinks = [
    {
      href: '#now-seats',
      label: l('Count the seats yourself', 'Räkna mandat själv'),
    },
    {
      href: '#now-government',
      label: l(
        'The government and forming one',
        'Regeringen och regeringsbildningen',
      ),
    },
    { href: '#now-news', label: l('Political news', 'Politiska nyheter') },
    {
      href: '#now-decisions',
      label: l('The latest decisions', 'De senaste besluten'),
    },
    {
      href: '#now-issues',
      label: l('Issue by issue', 'Sakfråga för sakfråga'),
    },
  ]

  if (!now)
    return (
      <ThemeLayout
        question={l('Who holds power right now?', 'Vem har makten just nu?')}
        why=""
        kpis={[]}
        chartTitle=""
        chartMeta=""
        chart={null}
        takeaway=""
        meaning={null}
        table={null}
        sources={[]}
        deepLinks={deepLinks}
        loading={!error}
        error={error}
      />
    )

  const { election, government } = now
  const seated = election.parties.filter((p) => p.seats > 0)
  const govParties = government.government_parties
  const support = government.agreement_parties ?? []
  const seatsOf = (codes: string[]) =>
    seated
      .filter((p) => codes.includes(p.party))
      .reduce((sum, p) => sum + p.seats, 0)
  const govSeats = seatsOf(govParties)
  const sideSeats = govSeats + seatsOf(support)
  const largest = [...seated].sort((a, b) => b.seats - a.seats)[0]
  const blocs: Bloc[] = [
    {
      key: 'gov',
      label: l('Government parties', 'Regeringspartier'),
      parties: seated.filter((p) => govParties.includes(p.party)),
    },
    {
      key: 'support',
      label: government.agreement_name
        ? l(
            `Support (${government.agreement_name})`,
            `Stödparti (${government.agreement_name})`,
          )
        : l('Support', 'Stödparti'),
      parties: seated.filter((p) => support.includes(p.party)),
    },
    {
      key: 'other',
      label: l('Other parties', 'Övriga partier'),
      parties: seated.filter(
        (p) => !govParties.includes(p.party) && !support.includes(p.party),
      ),
    },
  ].filter((b) => b.parties.length > 0)
  const hasMajority = sideSeats >= election.majority
  const sideNames = [...govParties, ...support].join(', ')

  let offset = 0
  const chart = (
    <figure
      className="seat-chart"
      aria-label={l(
        `Seats in the Riksdag: ${seated.map((p) => `${p.party} ${p.seats}`).join(', ')}. ${election.majority} seats are needed for a majority.`,
        `Mandat i riksdagen: ${seated.map((p) => `${p.party} ${p.seats}`).join(', ')}. Det krävs ${election.majority} mandat för egen majoritet.`,
      )}
    >
      <div className="seat-chart-track" aria-hidden="true">
        {blocs.flatMap((bloc) =>
          bloc.parties.map((p) => {
            const left = (offset / TOTAL) * 100
            offset += p.seats
            const meta = identity(p.party)
            return (
              <span
                key={p.party}
                className="seat-chart-seg"
                style={{
                  left: `${left}%`,
                  width: `${(p.seats / TOTAL) * 100}%`,
                  background: meta.color,
                  color: meta.ink,
                  boxShadow: meta.casing
                    ? `inset 0 0 0 1px ${meta.casing}`
                    : undefined,
                }}
              >
                <b>{p.party}</b>
                <small>{p.seats}</small>
              </span>
            )
          }),
        )}
        <span
          className="seat-chart-majority"
          style={{ left: `${(election.majority / TOTAL) * 100}%` }}
        />
      </div>
      <div className="seat-chart-scale" aria-hidden="true">
        <span style={{ left: `${(election.majority / TOTAL) * 100}%` }}>
          {l(`Majority ${election.majority}`, `Majoritet ${election.majority}`)}
        </span>
      </div>
      <dl className="seat-chart-blocs">
        {blocs.map((bloc) => (
          <div key={bloc.key}>
            <dt>{bloc.label}</dt>
            <dd>
              <strong>
                {num(bloc.parties.reduce((s, p) => s + p.seats, 0))}
              </strong>{' '}
              {l('seats', 'mandat')} ·{' '}
              {bloc.parties.map((p) => p.party).join(', ')}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  )

  const table = (
    <table className="data-table">
      <caption className="visually-hidden">
        {l('Election result by party', 'Valresultat per parti')}
      </caption>
      <thead>
        <tr>
          <th scope="col">{l('Party', 'Parti')}</th>
          <th scope="col">{l('Share of votes', 'Andel av rösterna')}</th>
          <th scope="col">{l('Change', 'Förändring')}</th>
          <th scope="col">{l('Seats', 'Mandat')}</th>
        </tr>
      </thead>
      <tbody>
        {election.parties.map((p) => (
          <tr key={p.party}>
            <th scope="row">
              <PartyName party={p.party} />
            </th>
            <td>{p.share_pct != null ? pct(p.share_pct, 2) : '–'}</td>
            <td>
              {p.previous_share_pct != null && p.share_pct != null
                ? `${signed(p.share_pct - p.previous_share_pct, 1)} ${l('pts', 'p.e.')}`
                : '–'}
            </td>
            <td>{p.seats}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <ThemeLayout
      question={l('Who holds power right now?', 'Vem har makten just nu?')}
      why={l(
        'The Riksdag decides laws and the budget, and the government needs its support. The seats show which parties can form a majority.',
        'Riksdagen beslutar om lagar och budget, och regeringen behöver dess stöd. Mandaten visar vilka partier som kan bilda majoritet.',
      )}
      kpis={[
        {
          value: `${largest.seats}`,
          label: l(
            `seats for ${partyName(largest.party)}, the largest party`,
            `mandat för ${partyName(largest.party)}, största parti`,
          ),
        },
        {
          value: `${sideSeats} / ${TOTAL}`,
          label: l(
            `seats for the governing side (${sideNames})`,
            `mandat för regeringssidan (${sideNames})`,
          ),
        },
        {
          value: `${election.majority}`,
          label: l(
            'seats needed for a majority',
            'mandat krävs för egen majoritet',
          ),
        },
      ]}
      chartTitle={l(
        `The Riksdag after the ${election.year} election`,
        `Riksdagen efter valet ${election.year}`,
      )}
      chartMeta={l(
        `Seats, of 349 · ${election.count_status === 'slutlig' ? 'final result' : 'preliminary result'}, ${dayName(election.election_date)}`,
        `Antal mandat av 349 · ${election.count_status === 'slutlig' ? 'slutligt resultat' : 'preliminärt resultat'}, valet ${dayName(election.election_date)}`,
      )}
      chart={chart}
      takeaway={
        hasMajority
          ? l(
              `The governing side (${sideNames}) has ${sideSeats} seats, ${sideSeats - election.majority} more than the ${election.majority} needed for a majority.`,
              `Regeringssidan (${sideNames}) har ${sideSeats} mandat, ${sideSeats - election.majority} fler än de ${election.majority} som krävs för egen majoritet.`,
            )
          : l(
              `The governing side (${sideNames}) has ${sideSeats} seats, ${election.majority - sideSeats} short of the ${election.majority} needed for a majority.`,
              `Regeringssidan (${sideNames}) har ${sideSeats} mandat, ${election.majority - sideSeats} färre än de ${election.majority} som krävs för egen majoritet.`,
            )
      }
      meaning={
        <>
          <p>
            {l(
              `${government.government_name} (${govParties.join(', ')}) governs${support.length ? `, with ${support.join(', ')} as a support party through ${government.agreement_name}` : ''}. `,
              `${government.government_name} (${govParties.join(', ')}) styr${support.length ? `, med ${support.join(', ')} som stödparti genom ${government.agreement_name}` : ''}. `,
            )}
            {government.status_note && `${government.status_note}.`}
          </p>
          <p>
            {l(
              'A government does not need a majority of its own: it may govern as long as a majority does not vote against it. The number to watch is therefore whether the other parties together reach 175.',
              'En regering behöver inte egen majoritet: den får regera så länge en majoritet inte röstar emot den. Det som avgör är därför om de andra partierna tillsammans når 175 mandat.',
            )}
          </p>
          {now.formation_news[0] && (
            <p>
              {l(
                'Latest in forming a government',
                'Senast i regeringsbildningen',
              )}
              , {dayName(now.formation_news[0].date)}:{' '}
              {now.formation_news[0].title}.
            </p>
          )}
        </>
      }
      table={table}
      sources={[
        { name: election.source, url: 'https://www.val.se' },
        { name: 'Regeringskansliet', url: government.source_url },
        { name: 'Sveriges riksdag', url: 'https://www.riksdagen.se' },
      ]}
      updated={dayName(now.generated_at)}
      method={
        <p>
          {l(
            'Seats and shares as Valmyndigheten publishes them; change compared with the previous election. The governing side is the government parties plus parties with a written agreement with the government.',
            'Mandat och andelar så som Valmyndigheten redovisar dem; förändringen jämförs med förra valet. Regeringssidan är regeringspartierna och partier med ett skriftligt avtal med regeringen.',
          )}
        </p>
      }
      deepLinks={deepLinks}
    />
  )
}
