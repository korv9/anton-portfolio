/**
 * Partierna: one party's voting fingerprint. Its members' votes, how united they voted, the
 * parties it voted most like, and the policy areas where its position most and least often
 * differed from the rest of the chamber. Descriptive statistics, not a grade.
 */
import { l } from '../../i18n'
import type { Now } from '../../parliament/data'
import {
  PartyLogo,
  identity,
  partyFill,
  partyName,
} from '../../parties/identity'
import { num, pct } from '../controls'
import type { Analytics } from '../analytics/load'
import { areaName } from '../analytics/areas'
import {
  partyDifferenceByArea,
  partyVoteDistribution,
} from '../analytics/metrics'
import { Bars, Info, Insight, Kpi, Section } from './parts'

const KINDS = [
  { key: 'yes', en: 'Yes', sv: 'Ja', color: '#1f78b4' },
  { key: 'no', en: 'No', sv: 'Nej', color: '#c8413b' },
  { key: 'abstain', en: 'Abstain', sv: 'Avstår', color: '#b8860b' },
  { key: 'absent', en: 'Absent', sv: 'Frånvaro', color: '#d9d9d4' },
] as const

export default function Partierna({
  a,
  now,
  party,
  onParty,
}: {
  a: Analytics
  now: Now
  party: string
  onParty: (p: string) => void
}) {
  const dist = partyVoteDistribution(a.votes, party)
  const all = dist.yes + dist.no + dist.abstain + dist.absent
  const cohesion = a.cohesion.find((c) => c.party === party)
  const alike = a.similarity
    .filter((s) => s.a === party && s.b !== party)
    .sort((x, y) => y.pct - x.pct)
  const areas = partyDifferenceByArea(a.votes, party)
  const seats = now.election.parties.find((p) => p.party === party)?.seats
  const most = areas[0]
  const least = areas.at(-1)

  return (
    <Section
      id="partierna"
      kicker={l('The parties', 'Partierna')}
      question={l('How do the parties vote?', 'Hur röstar partierna?')}
      lead={l(
        'Choose a party for its voting fingerprint: what its members voted, how united, like whom, and where it most often stood apart.',
        'Välj ett parti för dess röstfingeravtryck: vad ledamöterna röstade, hur enigt, som vilka, och var partiet oftast stod för sig.',
      )}
      deeper={[
        {
          href: `#politik-partier?partier=${party}`,
          label: l(
            `Everything about ${partyName(party)}`,
            `Allt om ${partyName(party)}`,
          ),
        },
        {
          href: '#politik-roster',
          label: l('Voting record since 1993', 'Röstmönster sedan 1993'),
        },
      ]}
    >
      <div
        className="story-party-picker"
        role="group"
        aria-label={l('Choose a party', 'Välj parti')}
      >
        {a.parties.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === party}
            onClick={() => onParty(p)}
            style={{ ['--c' as string]: partyFill(p) }}
          >
            <PartyLogo party={p} size={28} />
            <span>{p}</span>
          </button>
        ))}
      </div>

      <article
        className="story-fingerprint"
        style={{ ['--c' as string]: partyFill(party) }}
      >
        <h3>
          <PartyLogo party={party} size={34} /> {partyName(party)}
        </h3>
        <dl className="story-kpis small">
          <Kpi
            value={seats != null ? num(seats) : '–'}
            label={l('Seats', 'Mandat')}
          />
          <Kpi
            value={cohesion ? pct(cohesion.pct, 1) : '–'}
            label={
              <Info term={l('Cohesion', 'Partisammanhållning')}>
                {l(
                  'Votes cast by the party’s members that match the party’s most common vote in each roll call, of all their cast votes (yes, no, abstain).',
                  'Andel avgivna röster från partiets ledamöter som överensstämmer med partiets vanligaste röst i respektive votering (ja, nej, avstår).',
                )}
              </Info>
            }
          />
          <Kpi
            value={alike[0] ? `${alike[0].b} ${pct(alike[0].pct, 0)}` : '–'}
            label={l('Votes most like', 'Röstar mest som')}
          />
          <Kpi
            value={most ? areaName(most.committee) : '–'}
            label={l('Stands apart most in', 'Skiljer sig mest inom')}
            note={
              most
                ? `${pct(most.pct, 0)} ${l('of the roll calls', 'av voteringarna')}`
                : undefined
            }
          />
        </dl>

        <h4>{l('The members’ votes', 'Ledamöternas röster')}</h4>
        <div
          className="story-stack"
          role="img"
          aria-label={KINDS.map(
            (k) => `${l(k.en, k.sv)} ${pct((dist[k.key] / all) * 100, 0)}`,
          ).join(', ')}
        >
          {KINDS.map((k) => (
            <span
              key={k.key}
              style={{ flexGrow: dist[k.key], background: k.color }}
              title={`${l(k.en, k.sv)} ${num(dist[k.key])}`}
            />
          ))}
        </div>
        <ul className="feature-legend">
          {KINDS.map((k) => (
            <li key={k.key} style={{ ['--c' as string]: k.color }}>
              {l(k.en, k.sv)} {pct((dist[k.key] / all) * 100, 0)}
            </li>
          ))}
        </ul>
        <p className="story-axis-note">
          {l(
            'Absence includes sick leave, assignments and pairing; it is not a stance.',
            'Frånvaro omfattar sjukdom, uppdrag och kvittning; den är inte en ståndpunkt.',
          )}
        </p>

        <div className="story-two">
          <div>
            <h4>{l('Votes most like', 'Röstar oftast lika med')}</h4>
            <Bars
              rows={alike.map((s) => ({
                key: s.b,
                party: s.b,
                label: partyName(s.b),
                value: s.pct,
              }))}
              max={100}
              format={(v) => pct(v, 0)}
              label={l(
                'Voting similarity with each party',
                'Röstlikhet med varje parti',
              )}
            />
          </div>
          <div>
            <h4>
              <Info
                term={l(
                  'Differs from the rest, per area',
                  'Skiljer sig från övriga, per område',
                )}
              >
                {l(
                  'The share of the area’s roll calls where the party’s position differed from the position most members of the other parties took. Areas with at least 15 roll calls.',
                  'Andelen av områdets voteringar där partiets ståndpunkt skilde sig från den ståndpunkt flest ledamöter i övriga partier tog. Områden med minst 15 voteringar.',
                )}
              </Info>
            </h4>
            <Bars
              rows={areas.map((x) => ({
                key: x.committee,
                label: areaName(x.committee),
                value: x.pct,
                color: identity(party).color,
              }))}
              max={100}
              format={(v) => pct(v, 0)}
              label={l(
                'Difference from the other parties per area',
                'Skillnad mot övriga partier per område',
              )}
            />
          </div>
        </div>
        {most && least && (
          <Insight>
            {l(
              `${partyName(party)}’s position differed from the rest of the chamber most often in ${areaName(most.committee).toLowerCase()} (${pct(most.pct, 0)}) and least often in ${areaName(least.committee).toLowerCase()} (${pct(least.pct, 0)}).`,
              `${partyName(party)}s ståndpunkt skilde sig från resten av kammaren oftast inom ${areaName(most.committee).toLowerCase()} (${pct(most.pct, 0)}) och mest sällan inom ${areaName(least.committee).toLowerCase()} (${pct(least.pct, 0)}).`,
            )}
          </Insight>
        )}
      </article>
    </Section>
  )
}
