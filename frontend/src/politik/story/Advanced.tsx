/**
 * Advanced analysis: the parties' voting as a map. Each party is a vector over the roll calls,
 * reduced to two principal components, so parties that vote alike land close together. Placed
 * after the plain charts, with its method stated in full.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { PartyLogo, partyFill, partyName } from '../../parties/identity'
import { useWidth } from '../../charts/feature/Feature'
import { num } from '../controls'
import type { Analytics } from '../analytics/load'
import { Insight, Section } from './parts'

export default function Advanced({ a }: { a: Analytics }) {
  const [ref, width] = useWidth<HTMLDivElement>(720)
  const [hover, setHover] = useState<string | null>(null)
  const { points, explained } = a.pca
  const H = Math.min(420, Math.max(300, width * 0.55))
  const pad = 56
  const padX = 110
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const span = (v: number[]) => [Math.min(...v), Math.max(...v)] as const
  const [x0, x1] = span(xs)
  const [y0, y1] = span(ys)
  const sx = (v: number) =>
    padX + ((v - x0) / (x1 - x0 || 1)) * (width - 2 * padX)
  const sy = (v: number) =>
    H - pad - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * pad)
  const left = [...points].sort((p, q) => p.x - q.x)
  // Parties that voted (nearly) identically land on the same spot: draw them as one group.
  const groups: { parties: string[]; x: number; y: number }[] = []
  for (const p of points) {
    const g = groups.find(
      (g) => Math.hypot(sx(g.x) - sx(p.x), sy(g.y) - sy(p.y)) < 46,
    )
    if (g) {
      g.x = (g.x * g.parties.length + p.x) / (g.parties.length + 1)
      g.y = (g.y * g.parties.length + p.y) / (g.parties.length + 1)
      g.parties.push(p.party)
    } else groups.push({ parties: [p.party], x: p.x, y: p.y })
  }
  const near = (p: string) =>
    a.similarity
      .filter((s) => s.a === p && s.b !== p)
      .sort((x, y) => y.pct - x.pct)[0]

  return (
    <Section
      id="fordjupad"
      n={8}
      kicker={l('Advanced analysis', 'Fördjupad analys')}
      question={l(
        'Latent patterns in how the parties vote',
        'Latenta mönster i partiernas röstande',
      )}
      lead={l(
        'A map where parties that vote alike land close together. The axes have no names of their own: they are the directions in which the parties’ votes differ most.',
        'En karta där partier som röstar lika hamnar nära varandra. Axlarna har inga egna namn: de är de riktningar där partiernas röster skiljer sig mest.',
      )}
      deeper={[
        {
          href: '#debates',
          label: l(
            'Map of similar speeches (embeddings)',
            'Karta över liknande anföranden (embeddings)',
          ),
        },
        {
          href: '#technical',
          label: l('Models and evaluation', 'Modeller och utvärdering'),
        },
      ]}
    >
      <div
        className="story-map"
        ref={ref}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={left.map((p) => partyName(p.party)).join(', ')}
        >
          <line
            x1={pad}
            x2={width - pad}
            y1={H - pad}
            y2={H - pad}
            className="story-grid"
          />
          <line
            x1={pad}
            x2={pad}
            y1={pad}
            y2={H - pad}
            className="story-grid"
          />
          <text
            x={width - pad}
            y={H - pad + 18}
            textAnchor="end"
            className="story-tick"
          >
            {l('Component 1', 'Komponent 1')} · {num(explained[0], 0)} % →
          </text>
          <text x={pad - 6} y={18} className="story-tick">
            ↑ {l('Component 2', 'Komponent 2')} · {num(explained[1], 0)} %
          </text>
          {groups.map((g) => {
            const w = g.parties.length * 28
            return (
              <g
                key={g.parties.join()}
                className={hover && !g.parties.includes(hover) ? 'dim' : ''}
                transform={`translate(${sx(g.x)} ${sy(g.y)})`}
                onPointerEnter={() => setHover(g.parties[0])}
                onPointerDown={() => setHover(g.parties[0])}
              >
                <rect
                  x={-w / 2 - 6}
                  y={-19}
                  width={w + 12}
                  height={38}
                  rx={19}
                  fill={
                    g.parties.length > 1
                      ? 'var(--paper)'
                      : partyFill(g.parties[0])
                  }
                  fillOpacity={g.parties.length > 1 ? 1 : 0.12}
                  stroke={
                    g.parties.length > 1
                      ? 'var(--line-strong)'
                      : partyFill(g.parties[0])
                  }
                />
                {g.parties.map((party, i) => (
                  <foreignObject
                    key={party}
                    x={-w / 2 + i * 28 + 1}
                    y={-13}
                    width={26}
                    height={26}
                  >
                    <PartyLogo party={party} size={26} />
                  </foreignObject>
                ))}
                <text y={34} textAnchor="middle" className="story-map-label">
                  {g.parties.join(' · ')}
                </text>
              </g>
            )
          })}
        </svg>
        <p className="story-readout" aria-live="polite">
          {hover
            ? (() => {
                const g = groups.find((x) => x.parties.includes(hover))!
                return g.parties.length > 1
                  ? l(
                      `${g.parties.join(', ')} voted the same way in almost every roll call, so they share a spot.`,
                      `${g.parties.join(', ')} röstade likadant i nästan varje votering och delar därför plats.`,
                    )
                  : l(
                      `${partyName(hover)} votes most like ${near(hover)?.b} (${num(near(hover)?.pct ?? 0, 0)} %).`,
                      `${partyName(hover)} röstar mest likt ${near(hover)?.b} (${num(near(hover)?.pct ?? 0, 0)} %).`,
                    )
              })()
            : l('Hover or tap a party.', 'Håll över eller tryck på ett parti.')}
        </p>
      </div>
      <Insight>
        {l(
          `The first component alone accounts for ${num(explained[0], 0)} % of the variation in the parties’ votes; along it they run from ${left[0].party} to ${left.at(-1)!.party}.`,
          `Första komponenten förklarar ensam ${num(explained[0], 0)} % av variationen i partiernas röster; längs den går de från ${left[0].party} till ${left.at(-1)!.party}.`,
        )}
      </Insight>
      <details className="story-method">
        <summary>{l('Method', 'Metod')}</summary>
        <dl>
          <dt>{l('Features', 'Variabler')}</dt>
          <dd>
            {l(
              `One per roll call (${num(a.votes.length)}, ${a.votes[0].session}–${a.votes.at(-1)!.session}): the party’s position, coded yes 1, no −1, abstain or none 0.`,
              `En per votering (${num(a.votes.length)}, ${a.votes[0].session}–${a.votes.at(-1)!.session}): partiets ståndpunkt, kodad ja 1, nej −1, avstår eller ingen 0.`,
            )}
          </dd>
          <dt>{l('Normalisation', 'Normalisering')}</dt>
          <dd>
            {l(
              'Each roll call centred on the parties’ mean; not scaled.',
              'Varje votering centrerad kring partiernas medelvärde; ingen skalning.',
            )}
          </dd>
          <dt>{l('Method', 'Metod')}</dt>
          <dd>
            {l(
              'Principal component analysis on the parties’ Gram matrix (Euclidean distance), two components by power iteration, computed in the browser from the same roll calls as the charts above.',
              'Principalkomponentanalys på partiernas Gram-matris (euklidiskt avstånd), två komponenter med potensmetoden, beräknad i webbläsaren från samma voteringar som graferna ovan.',
            )}
          </dd>
          <dt>{l('Reading it', 'Så läses den')}</dt>
          <dd>
            {l(
              'Distance reflects how differently two parties voted, not ideology. With eight parties the map is a summary; the similarity matrix gives the exact figures.',
              'Avstånd speglar hur olika två partier röstade, inte ideologi. Med åtta partier är kartan en sammanfattning; likhetsmatrisen ger de exakta siffrorna.',
            )}
          </dd>
        </dl>
      </details>
    </Section>
  )
}
