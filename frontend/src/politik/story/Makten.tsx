/**
 * Makten: how the Riksdag is made up after the latest election, and which parties grew or lost
 * seats since the election before. The governing side's seats are drawn against the 175 needed
 * for a majority, as a fact of the seat count, not a judgement.
 */
import { useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import type { Now } from '../../parliament/data'
import {
  PartyLogo,
  identity,
  partyFill,
  partyName,
} from '../../parties/identity'
import { num, pct, signed } from '../controls'
import { Bars, Insight, Section } from './parts'

export default function Makten({
  now,
  facts,
}: {
  now: Now
  /** The latest election, roll call and debate, under the seats. */
  facts?: ReactNode
}) {
  const [hover, setHover] = useState<string | null>(null)
  const parties = now.election.parties
    .filter((p) => p.seats > 0)
    .sort((a, b) => b.seats - a.seats)
  const total = parties.reduce((s, p) => s + p.seats, 0)
  const majority = now.election.majority
  const side = [
    ...now.government.government_parties,
    ...(now.government.agreement_parties ?? []),
  ]
  // The governing side first, then the others, each largest first: the bar reads against 175.
  const ordered = [
    ...parties.filter((p) => side.includes(p.party)),
    ...parties.filter((p) => !side.includes(p.party)),
  ]
  const sideSeats = parties
    .filter((p) => side.includes(p.party))
    .reduce((s, p) => s + p.seats, 0)
  const change = parties
    .filter((p) => p.previous_seats != null)
    .map((p) => ({ party: p.party, d: p.seats - (p.previous_seats ?? 0) }))
    .sort((a, b) => b.d - a.d)
  const span = Math.max(1, ...change.map((c) => Math.abs(c.d)))
  const grew = change[0]
  const lost = change.at(-1)
  const shown = hover ? parties.find((p) => p.party === hover) : null

  return (
    <Section
      id="makten"
      kicker={l('Latest', 'Läget')}
      question={l(
        'What is the political situation right now?',
        'Hur ser det politiska läget ut just nu?',
      )}
      lead={
        <>
          {now.government.government_name}:{' '}
          {l('prime minister', 'statsminister')} {now.government.prime_minister}{' '}
          ({now.government.government_parties.join(', ')}
          {now.government.agreement_parties?.length
            ? `; ${l('agreement with', 'avtal med')} ${now.government.agreement_parties.join(', ')}`
            : ''}
          ).{' '}
          {l(
            `Seats after the election of ${now.election.year}; a majority is ${majority} of ${total}.`,
            `Mandat efter valet ${now.election.year}; majoritet är ${majority} av ${total}.`,
          )}
        </>
      }
      deeper={[
        {
          href: '#politik-partier',
          label: l('Every election since 1973', 'Alla val sedan 1973'),
        },
        {
          href: '#politik-mandat',
          label: l('Count seats yourself', 'Räkna mandat själv'),
        },
        {
          href: '#politik-valjarna',
          label: l('What voters think now', 'Vad väljarna tycker nu'),
        },
      ]}
    >
      <div className="story-seatbar">
        <div
          className="story-seatbar-track"
          role="img"
          aria-label={ordered
            .map((p) => `${partyName(p.party)} ${p.seats}`)
            .join(', ')}
        >
          {ordered.map((p) => (
            <span
              key={p.party}
              className={hover && hover !== p.party ? 'dim' : ''}
              style={{
                flexGrow: p.seats,
                background: partyFill(p.party),
                color: identity(p.party).ink,
              }}
              onPointerEnter={() => setHover(p.party)}
              onPointerLeave={() => setHover(null)}
              onPointerDown={() => setHover(p.party)}
            >
              {p.seats >= 14 ? p.party : ''}
            </span>
          ))}
          <i
            className="story-seatbar-majority"
            style={{ left: `${(majority / total) * 100}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="story-seatbar-scale" aria-hidden="true">
          <span style={{ left: `${(majority / total) * 100}%` }}>
            {majority} {l('for a majority', 'för majoritet')}
          </span>
        </div>
        <p className="story-readout" aria-live="polite">
          {shown ? (
            <>
              <b>{partyName(shown.party)}</b> {shown.seats}{' '}
              {l('seats', 'mandat')}, {pct((shown.seats / total) * 100, 1)}{' '}
              {l('of the seats', 'av mandaten')},{' '}
              {shown.share_pct != null && (
                <>
                  {pct(shown.share_pct, 1)} {l('of the votes', 'av rösterna')}
                </>
              )}
            </>
          ) : (
            l(
              `Left of the line: the governing side (${side.join(', ')}), ${sideSeats} seats.`,
              `Till vänster om linjen: regeringssidan (${side.join(', ')}), ${sideSeats} mandat.`,
            )
          )}
        </p>
      </div>
      <Insight>
        {sideSeats >= majority
          ? l(
              `The governing side has ${sideSeats} seats, ${sideSeats - majority} more than a majority.`,
              `Regeringssidan har ${sideSeats} mandat, ${sideSeats - majority} fler än majoritet.`,
            )
          : l(
              `The governing side has ${sideSeats} seats, ${majority - sideSeats} short of a majority.`,
              `Regeringssidan har ${sideSeats} mandat, ${majority - sideSeats} färre än majoritet.`,
            )}
      </Insight>
      {facts}

      <div className="story-two">
        <div>
          <h3>{l('Seats per party', 'Mandat per parti')}</h3>
          <Bars
            rows={parties.map((p) => ({
              key: p.party,
              party: p.party,
              label: (
                <>
                  <PartyLogo party={p.party} size={18} /> {partyName(p.party)}
                </>
              ),
              value: p.seats,
            }))}
            max={parties[0].seats}
            format={(v) => num(v)}
            label={l('Seats per party', 'Mandat per parti')}
          />
        </div>
        <div>
          <h3>
            {l(
              `Change since ${now.election.year - 4}`,
              `Förändring sedan ${now.election.year - 4}`,
            )}
          </h3>
          <ol
            className="story-diverge"
            aria-label={l(
              'Change in seats per party',
              'Förändring i mandat per parti',
            )}
          >
            {change.map((c) => (
              <li key={c.party}>
                <span className="story-diverge-label">
                  {partyName(c.party)}
                </span>
                <span className="story-diverge-track">
                  <span
                    className={c.d >= 0 ? 'up' : 'down'}
                    style={{
                      width: `${(Math.abs(c.d) / span) * 50}%`,
                      background: partyFill(c.party),
                    }}
                  />
                </span>
                <span className="story-diverge-value">{signed(c.d)}</span>
              </li>
            ))}
          </ol>
          <p className="story-axis-note">
            {l(
              '← lost seats, gained seats →',
              '← tappade mandat, ökade mandat →',
            )}
          </p>
        </div>
      </div>
      {grew && lost && (
        <Insight>
          {l(
            `${partyName(grew.party)} changed most upwards (${signed(grew.d)} seats), ${partyName(lost.party)} most downwards (${signed(lost.d)}).`,
            `${partyName(grew.party)} ökade mest (${signed(grew.d)} mandat), ${partyName(lost.party)} minskade mest (${signed(lost.d)}).`,
          )}
        </Insight>
      )}
    </Section>
  )
}
