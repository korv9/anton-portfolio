/**
 * Besluten: what the Riksdag decides, month by month, and in which policy areas (the committee
 * that prepared the decision), with how often the parties disagreed there.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { monthName, num, pct } from '../controls'
import type { Analytics } from '../analytics/load'
import { areaName } from '../analytics/areas'
import { CLOSE_MARGIN } from '../analytics/metrics'
import { Bars, Info, Insight, Section } from './parts'

export default function Besluten({ a }: { a: Analytics }) {
  const [hover, setHover] = useState<number | null>(null)
  const months = a.months
  const top = Math.max(...months.map((m) => m[1]))
  const busiest = [...months].sort((x, y) => y[1] - x[1])[0]
  const areas = [...a.areas].sort((x, y) => y.votes - x.votes)
  const maxClose = Math.max(...a.areas.map((x) => x.close), 1)
  const mostVotes = areas[0]
  const closest = [...a.areas]
    .filter((x) => x.votes >= 15)
    .sort((x, y) => y.close - x.close)[0]
  const shown = hover != null ? months[hover] : null

  return (
    <Section
      id="besluten"
      n={3}
      kicker={l('Decisions', 'Besluten')}
      question={l('What happens in the Riksdag?', 'Vad händer i riksdagen?')}
      lead={l(
        `${num(a.votes.length)} decision points put to a roll call in ${a.votes[0].session}–${a.votes.at(-1)!.session}.`,
        `${num(a.votes.length)} beslutspunkter som avgjordes med votering ${a.votes[0].session}–${a.votes.at(-1)!.session}.`,
      )}
      deeper={[
        {
          href: '#politik-roster',
          label: l('How the parties vote', 'Hur partierna röstar'),
        },
        {
          href: '#politik-utredningar',
          label: l('From study to law', 'Från utredning till lag'),
        },
        { href: '#politik-budget', label: l('The budget', 'Budgeten') },
      ]}
    >
      <h3>{l('Roll calls per month', 'Voteringar per månad')}</h3>
      <div className="story-columns" onPointerLeave={() => setHover(null)}>
        <ol aria-label={l('Roll calls per month', 'Voteringar per månad')}>
          {months.map(([m, n], i) => (
            <li
              key={m}
              className={hover === i ? 'on' : ''}
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              aria-label={`${monthName(`${m}-01`)}: ${n}`}
            >
              <span style={{ height: `${(n / top) * 100}%` }} />
              <small>{m.endsWith('-01') || i === 0 ? m.slice(0, 4) : ''}</small>
            </li>
          ))}
        </ol>
        <p className="story-readout" aria-live="polite">
          {shown
            ? `${monthName(`${shown[0]}-01`)}: ${num(shown[1])} ${l('roll calls', 'voteringar')}`
            : l(
                'Hover or tap a month. The summer and the turn of the year are breaks in the Riksdag’s work.',
                'Håll över eller tryck på en månad. Sommaren och årsskiftet är uppehåll i riksdagens arbete.',
              )}
        </p>
      </div>
      <Insight>
        {l(
          `The busiest month was ${monthName(`${busiest[0]}-01`)}, with ${num(busiest[1])} roll calls.`,
          `Flest voteringar hölls i ${monthName(`${busiest[0]}-01`)}: ${num(busiest[1])}.`,
        )}
      </Insight>

      <h3>
        {l('Policy areas', 'Politikområden')}{' '}
        <small className="story-h3-note">
          {l('roll calls · and', 'voteringar · och')}{' '}
          <Info term={l('close votes', 'jämna voteringar')}>
            {l(
              `The share of the area’s roll calls where yes and no were within ${CLOSE_MARGIN} percentage points of each other (|yes − no| / (yes + no) < ${CLOSE_MARGIN} %). Almost every roll call has some party voting differently, so a near-even split says more.`,
              `Andelen av områdets voteringar där ja och nej låg inom ${CLOSE_MARGIN} procentenheter från varandra (|ja − nej| / (ja + nej) < ${CLOSE_MARGIN} %). Nästan varje votering har något parti som röstar annorlunda, så en nästan jämn delning säger mer.`,
            )}
          </Info>
        </small>
      </h3>
      <Bars
        rows={areas.map((x) => ({
          key: x.committee,
          label: areaName(x.committee),
          value: x.votes,
          second: x.close,
          text: `${num(x.votes)} · ${pct(x.close, 0)}`,
          color: 'var(--ink)',
        }))}
        secondMax={maxClose}
        format={(v) => num(v)}
        label={l(
          'Roll calls and disagreement per policy area',
          'Voteringar och oenighet per politikområde',
        )}
      />
      <p className="story-axis-note">
        {l(
          'Thick bar: number of roll calls. Thin red bar and the per cent: share of close votes.',
          'Tjock stapel: antal voteringar. Tunn röd stapel och procenten: andel jämna voteringar.',
        )}
      </p>
      <Insight>
        {l(
          `${areaName(mostVotes.committee)} had the most roll calls (${num(mostVotes.votes)}); the closest votes were most common in ${areaName(closest.committee).toLowerCase()} (${pct(closest.close, 0)} of its roll calls).`,
          `${areaName(mostVotes.committee)} hade flest voteringar (${num(mostVotes.votes)}); jämna voteringar var vanligast inom ${areaName(closest.committee).toLowerCase()} (${pct(closest.close, 0)} av voteringarna).`,
        )}
      </Insight>
    </Section>
  )
}
