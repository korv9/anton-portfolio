/**
 * Skiljelinjerna: where the parties differ most. The main visual is the policy areas where
 * roll calls split the parties most, with what it means beside it. Who votes with whom (the
 * similarity matrix, a pair to compare) and the most divided roll calls are one click deeper,
 * under Explore.
 */
import { useState } from 'react'
import { TraceResult } from '../../ui/Trace'
import {
  ChartSection,
  ExploreSection,
  Interpretation,
  SourceCaption,
} from '../../ui/Story'
import { l } from '../../i18n'
import { partyName } from '../../parties/identity'
import { dayName, num, pct } from '../controls'
import type { Analytics } from '../analytics/load'
import { areaName } from '../analytics/areas'
import { Bars, Heatmap, Info, Insight, PartyMark, Section } from './parts'

const POS_SV: Record<string, string> = {
  Ja: 'Ja',
  Nej: 'Nej',
  Avstår: 'Avstår',
}
const POS_EN: Record<string, string> = {
  Ja: 'Yes',
  Nej: 'No',
  Avstår: 'Abstain',
}
const pos = (p: string | null) => (p ? l(POS_EN[p] ?? p, POS_SV[p] ?? p) : '–')

/** The headline facts of the dividing lines, for the page's answer and this section. */
export function dividingLines(a: Analytics) {
  const pairs = a.similarity.filter(
    (s) => a.parties.indexOf(s.a) < a.parties.indexOf(s.b),
  )
  const areas = a.areas.filter((x) => x.votes >= 15)
  return {
    closest: [...pairs].sort((x, y) => y.pct - x.pct)[0],
    furthest: [...pairs].sort((x, y) => x.pct - y.pct)[0],
    areas,
    topArea: areas[0],
    lowArea: areas.at(-1),
  }
}

export default function Skiljelinjerna({ a }: { a: Analytics }) {
  const [pair, setPair] = useState<[string, string]>(['S', 'M'])
  const [open, setOpen] = useState<string | null>(null)
  const sim = (x: string, y: string) =>
    a.similarity.find((s) => s.a === x && s.b === y) ?? null
  const { closest, furthest, areas, topArea, lowArea } = dividingLines(a)
  const chosen = sim(pair[0], pair[1])
  const period = `${a.votes[0].session}–${a.votes.at(-1)!.session}`

  return (
    <Section
      id="skiljelinjerna"
      kicker={l('The major difference', 'Den stora skillnaden')}
      question={l(
        'Where do the parties differ most?',
        'Var skiljer sig partierna mest?',
      )}
      deeper={[
        {
          href: '#politik-roster',
          label: l(
            'Votes per session since 1993',
            'Röster per riksmöte sedan 1993',
          ),
        },
      ]}
    >
      <ChartSection
        title={
          topArea
            ? l(
                `Roll calls in ${areaName(topArea.committee).toLowerCase()} split the parties most`,
                `Voteringarna inom ${areaName(topArea.committee).toLowerCase()} delar partierna mest`,
              )
            : l(
                'Most divided policy areas',
                'Mest polariserande politikområden',
              )
        }
        subtitle={
          <>
            <Info term={l('Polarisation', 'Polarisering')}>
              {l(
                'Per roll call: 1 − (members in the largest group of parties with the same position) / (members of all parties with a position). 0 when every party took the same position, about 0.5 when the chamber split down the middle. The area’s value is the mean over its roll calls, shown ×100.',
                'Per votering: 1 − (ledamöter i största gruppen partier med samma ståndpunkt) / (ledamöter i alla partier med ståndpunkt). 0 när alla partier tog samma ståndpunkt, ungefär 0,5 när kammaren delades mitt itu. Områdets värde är snittet över dess voteringar, visat ×100.',
              )}
            </Info>{' '}
            {l(
              `per policy area, ×100, areas with at least 15 roll calls, ${period}`,
              `per politikområde, ×100, områden med minst 15 voteringar, ${period}`,
            )}
          </>
        }
        finding={
          topArea &&
          lowArea &&
          l(
            `${areaName(topArea.committee)} divided the parties most (${num(topArea.polarisation * 100, 0)}), ${areaName(lowArea.committee).toLowerCase()} least (${num(lowArea.polarisation * 100, 0)}).`,
            `${areaName(topArea.committee)} delade partierna mest (${num(topArea.polarisation * 100, 0)}), ${areaName(lowArea.committee).toLowerCase()} minst (${num(lowArea.polarisation * 100, 0)}).`,
          )
        }
        source={
          <SourceCaption
            source={l('Riksdagen, roll calls', 'Riksdagen, voteringar')}
            period={period}
            definition={l(
              `${num(a.votes.length)} roll calls`,
              `${num(a.votes.length)} voteringar`,
            )}
          />
        }
      >
        <Bars
          rows={areas.map((x) => ({
            key: x.committee,
            label: areaName(x.committee),
            value: x.polarisation * 100,
            text: `${num(x.polarisation * 100, 0)}, ${num(x.votes)} ${l('roll calls', 'voteringar')}`,
            color: 'var(--ink)',
          }))}
          max={50}
          format={(v) => num(v, 0)}
          label={l(
            'Polarisation per policy area',
            'Polarisering per politikområde',
          )}
        />
      </ChartSection>
      <Interpretation
        notMeaning={l(
          'Voting alike is not cooperation or shared ideology, and a divided area is not necessarily the most important one; it is where the roll calls split.',
          'Att rösta lika är inte samarbete eller delad ideologi, och ett delat område är inte nödvändigtvis det viktigaste; det är där voteringarna delade sig.',
        )}
      >
        <p>
          {l(
            `The chart shows where the roll calls split the parties; between the parties themselves, ${closest.a} and ${closest.b} took the same position most often (${pct(closest.pct, 0)}), ${furthest.a} and ${furthest.b} least often (${pct(furthest.pct, 0)}). It says where disagreement shows in votes, not why.`,
            `Grafen visar var voteringarna delar partierna; mellan partierna själva hade ${closest.a} och ${closest.b} oftast samma ståndpunkt (${pct(closest.pct, 0)}), ${furthest.a} och ${furthest.b} mest sällan (${pct(furthest.pct, 0)}). Det säger var oenigheten syns i röster, inte varför.`,
          )}
        </p>
      </Interpretation>
      <TraceResult
        node="out:politics/decisions/**"
        what={l('the roll calls behind the chart', 'voteringarna bakom grafen')}
      />
      <ExploreSection
        id="vem-med-vem"
        title={l(
          'Explore: who votes with whom',
          'Utforska: vem röstar med vem',
        )}
        summary={l(
          'The voting similarity of every pair of parties, a pair to compare, and the most divided roll calls with every party’s position.',
          'Röstlikheten mellan alla par av partier, ett par att jämföra och de mest delade voteringarna med varje partis ståndpunkt.',
        )}
      >
        <h3>
          <Info term={l('Voting similarity', 'Röstlikhet')}>
            {l(
              `Of the roll calls where both parties had a position (the vote most of their members cast), the share where it was the same. ${num(a.votes.length)} roll calls, ${a.votes[0].session}–${a.votes.at(-1)!.session}.`,
              `Av voteringarna där båda partierna hade en ståndpunkt (den röst flest av deras ledamöter lade), andelen där den var densamma. ${num(a.votes.length)} voteringar, ${a.votes[0].session}–${a.votes.at(-1)!.session}.`,
            )}
          </Info>
          , {l('per cent', 'procent')}
        </h3>
        <Heatmap
          rows={a.order}
          cols={a.order}
          value={(r, c) => (r === c ? null : (sim(r, c)?.pct ?? null))}
          format={(v) => num(v, 0)}
          label={l(
            'Voting similarity between the parties',
            'Röstlikhet mellan partierna',
          )}
          min={30}
          max={100}
          rowLabel={(r) => <PartyMark party={r} />}
          colLabel={(c) => <PartyMark party={c} />}
          title={(r, c, v) =>
            l(
              `${partyName(r)} and ${partyName(c)}: the same position in ${pct(v, 0)} of the roll calls`,
              `${partyName(r)} och ${partyName(c)}: samma ståndpunkt i ${pct(v, 0)} av voteringarna`,
            )
          }
        />
        <p className="story-axis-note">
          {l(
            'The parties are ordered by the first axis of the voting map (Advanced analysis), so parties that vote alike sit side by side.',
            'Partierna står i ordning efter första axeln i röstkartan (Fördjupad analys), så partier som röstar lika hamnar bredvid varandra.',
          )}
        </p>
        <div className="story-pair">
          <label>
            {l('Compare', 'Jämför')}{' '}
            <select
              value={pair[0]}
              onChange={(e) => setPair([e.target.value, pair[1]])}
            >
              {a.parties.map((p) => (
                <option key={p} value={p}>
                  {partyName(p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {l('with', 'med')}{' '}
            <select
              value={pair[1]}
              onChange={(e) => setPair([pair[0], e.target.value])}
            >
              {a.parties.map((p) => (
                <option key={p} value={p}>
                  {partyName(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {chosen && pair[0] !== pair[1] && (
          <Insight>
            {l(
              `${partyName(pair[0])} and ${partyName(pair[1])} took the same position in ${pct(chosen.pct, 0)} of ${num(chosen.compared)} roll calls.`,
              `${partyName(pair[0])} och ${partyName(pair[1])} hade samma ståndpunkt i ${pct(chosen.pct, 0)} av ${num(chosen.compared)} voteringar.`,
            )}
          </Insight>
        )}
        <Insight>
          {l(
            `Most alike: ${closest.a} and ${closest.b} (${pct(closest.pct, 0)}). Least alike: ${furthest.a} and ${furthest.b} (${pct(furthest.pct, 0)}).`,
            `Mest lika: ${closest.a} och ${closest.b} (${pct(closest.pct, 0)}). Minst lika: ${furthest.a} och ${furthest.b} (${pct(furthest.pct, 0)}).`,
          )}
        </Insight>

        <h3>
          {l(
            'The most divided roll calls',
            'De mest polariserande voteringarna',
          )}
        </h3>
        <ol className="story-votes">
          {a.polarised.map((p) => {
            const key = `${p.vote.id}|${p.vote.point}`
            const isOpen = open === key
            return (
              <li key={key} className={isOpen ? 'open' : ''}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : key)}
                >
                  <span className="story-vote-title">
                    {p.vote.title}
                    <small>
                      {dayName(p.vote.date)}, {areaName(p.vote.committee)},{' '}
                      {p.vote.designation}
                    </small>
                  </span>
                  <span className="story-vote-count">
                    <b>{num(p.yes)}</b> {l('yes', 'ja')}, <b>{num(p.no)}</b>{' '}
                    {l('no', 'nej')}, {num(p.abstain)} {l('abst.', 'avst.')}
                  </span>
                </button>
                {isOpen && (
                  <div className="story-vote-detail">
                    <p>{p.vote.heading}</p>
                    <ul>
                      {p.vote.parties.map((x) => (
                        <li key={x.party}>
                          <PartyMark party={x.party} /> {pos(x.party_position)}{' '}
                          <small>
                            ({x.yes_votes}/{x.no_votes}/{x.abstain_votes}/
                            {x.absent_votes})
                          </small>
                        </li>
                      ))}
                    </ul>
                    <p className="story-axis-note">
                      {l(
                        'Per party: position (yes/no/abstain/absent members).',
                        'Per parti: ståndpunkt (ja/nej/avstår/frånvarande ledamöter).',
                      )}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </ExploreSection>
    </Section>
  )
}
