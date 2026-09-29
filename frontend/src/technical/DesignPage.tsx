/**
 * The design system, as a page: the principles, every token with the value the browser
 * actually resolves (read from the stylesheet, so this page cannot drift from the site), the
 * party colours, the type roles, the space scale and the components every page is built from.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import {
  PARTY_IDENTITY,
  PartyLogo,
  RIKSDAG_PARTIES,
  partyName,
} from '../parties/identity'
import { Card, Cards, Kpi, Kpis } from '../politik/board/Board'
import '../home/home.css'
import '../politik/board/board.css'
import '../politik/dash/dash.css'
import './technical.css'
import './design.css'

const COLOURS: [string, string, string][] = [
  ['ink', 'Text and marks', 'Text och markeringar'],
  ['ink-2', 'Secondary text', 'Sekundär text'],
  ['muted', 'Labels and notes', 'Etiketter och noter'],
  ['page', 'Page', 'Sida'],
  ['paper', 'Cards', 'Kort'],
  ['wash', 'Quiet fills', 'Lugna fält'],
  ['line', 'Rules', 'Linjer'],
  ['line-strong', 'Borders', 'Ramar'],
  ['accent', 'Current and chosen', 'Vald och aktuell'],
  ['accent-2', 'Accent, second step', 'Accent, andra steget'],
  ['select', 'Selected rows', 'Valda rader'],
  ['wash-cool', 'Read-outs', 'Avläsningar'],
  ['side', 'Sidebar', 'Sidomeny'],
  ['info', 'Information', 'Information'],
  ['negative', 'A fall, a no', 'En minskning, ett nej'],
  ['note-bg', 'Notes', 'Noteringar'],
]

const TYPE: [string, string, string][] = [
  [
    'fs-display',
    'Display: a page’s one big heading',
    'Display: sidans enda stora rubrik',
  ],
  ['fs-section-title', 'Section title', 'Sektionsrubrik'],
  ['fs-page-title', 'Page title in a dashboard', 'Sidrubrik i en dashboard'],
  ['fs-card-title', 'Card title', 'Kortrubrik'],
  ['fs-body', 'Body text in cards and lists', 'Brödtext i kort och listor'],
  [
    'fs-meta',
    'Meta: what a card shows, and how',
    'Meta: vad ett kort visar, och hur',
  ],
  ['fs-label', 'LABEL · CHIP · AXIS', 'ETIKETT · CHIP · AXEL'],
]

const SPACE = ['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5', 'sp-6']

function useTokens(names: string[]) {
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    setValues(
      Object.fromEntries(
        names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()]),
      ),
    )
    // The token list is static.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return values
}

export default function DesignPage() {
  const tokens = useTokens([
    ...COLOURS.map(([n]) => n),
    ...TYPE.map(([n]) => n),
    ...SPACE,
    'card-pad',
    'font',
    'font-mono',
  ])
  return (
    <div className="cv technical design" id="design">
      <header className="page-hero">
        <p className="page-eyebrow">{l('Design system', 'Designsystem')}</p>
        <h1>{l('One system for every page', 'Ett system för varje sida')}</h1>
        <p className="page-lead">
          {l(
            'Every page is built from the same tokens and components: near-black on warm white, one accent for what is chosen, colour only where it means something (a party, a fall), square corners and thin rules. The values below are read from the stylesheet the site runs on.',
            'Varje sida byggs av samma tokens och komponenter: nästan svart på varmvitt, en accent för det som är valt, färg bara där den betyder något (ett parti, en minskning), raka hörn och tunna linjer. Värdena nedan läses från stilmallen som sajten körs på.',
          )}
        </p>
      </header>

      <section className="tech-section" aria-labelledby="ds-principles">
        <h2 id="ds-principles">{l('Principles', 'Principer')}</h2>
        <ol className="ds-principles">
          {(
            [
              [
                'Colour means something',
                'Färg betyder något',
                'A colour is a party, a state or a direction, never decoration. Everything else is ink on paper.',
                'En färg är ett parti, ett läge eller en riktning, aldrig dekoration. Allt annat är svärta på papper.',
              ],
              [
                'One size per job',
                'En storlek per uppgift',
                'Seven type roles, used the same way on every page: a card title is always a card title.',
                'Sju typografiroller, använda likadant på varje sida: en kortrubrik är alltid en kortrubrik.',
              ],
              [
                'Cards hold one question',
                'Ett kort, en fråga',
                'A card has a title, a line on what it shows, and one chart or table.',
                'Ett kort har en rubrik, en rad om vad det visar och en graf eller tabell.',
              ],
              [
                'The chosen thing is dark',
                'Det valda är mörkt',
                'The current page, the chosen tab, the pressed filter: the same accent, everywhere.',
                'Aktuell sida, vald flik, nedtryckt filter: samma accent, överallt.',
              ],
            ] as const
          ).map(([en, sv, ten, tsv], i) => (
            <li key={en}>
              <span>{i + 1}</span>
              <b>{l(en, sv)}</b>
              <p>{l(ten, tsv)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="tech-section" aria-labelledby="ds-colour">
        <h2 id="ds-colour">{l('Colour', 'Färg')}</h2>
        <ul className="ds-swatches">
          {COLOURS.map(([name, en, sv]) => (
            <li key={name}>
              <i style={{ background: `var(--${name})` }} />
              <b>--{name}</b>
              <small>{l(en, sv)}</small>
              <code>{tokens[name] || '…'}</code>
            </li>
          ))}
        </ul>
        <h3>{l('Party colours', 'Partifärger')}</h3>
        <ul className="ds-parties">
          {RIKSDAG_PARTIES.map((p) => (
            <li key={p}>
              <PartyLogo party={p} size={28} />
              <i style={{ background: PARTY_IDENTITY[p].color }} />
              <b>{p}</b>
              <small>{partyName(p)}</small>
              <code>{PARTY_IDENTITY[p].color}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="tech-section" aria-labelledby="ds-type">
        <h2 id="ds-type">{l('Type', 'Typografi')}</h2>
        <p className="tech-lead">
          <code>{tokens.font?.split(',')[0] || 'Geist'}</code>{' '}
          {l('for text,', 'för text,')}{' '}
          <code>{tokens['font-mono']?.split(',')[0] || 'Geist Mono'}</code>{' '}
          {l('for figures and labels.', 'för siffror och etiketter.')}
        </p>
        <ol className="ds-type">
          {TYPE.map(([name, en, sv]) => (
            <li key={name}>
              <code>
                --{name} · {tokens[name] || '…'}
              </code>
              <span style={{ fontSize: `var(--${name})` }}>{l(en, sv)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="tech-section" aria-labelledby="ds-space">
        <h2 id="ds-space">{l('Space', 'Avstånd')}</h2>
        <ol className="ds-space">
          {SPACE.map((name) => (
            <li key={name}>
              <i style={{ width: `var(--${name})` }} />
              <code>
                --{name} · {tokens[name] || '…'}
              </code>
            </li>
          ))}
          <li>
            <code>--card-pad · {tokens['card-pad'] || '…'}</code>
          </li>
        </ol>
      </section>

      <section className="tech-section" aria-labelledby="ds-components">
        <h2 id="ds-components">{l('Components', 'Komponenter')}</h2>
        <p className="tech-lead">
          {l(
            'The same components the dashboards use, rendered here from the same code.',
            'Samma komponenter som dashboardarna använder, renderade här från samma kod.',
          )}
        </p>
        <Kpis>
          <Kpi
            index={0}
            label={l('Key figure', 'Nyckeltal')}
            value={349}
            format={(v) => String(v)}
            sub={l('with a note', 'med en not')}
          />
          <Kpi
            index={1}
            label={l('A share', 'En andel')}
            value={33.9}
            format={(v) => `${v.toFixed(1).replace('.', ',')} %`}
            sub={l('one decimal', 'en decimal')}
          />
        </Kpis>
        <div className="ds-row">
          <a className="board-button" href="#design">
            {l('Primary button', 'Primärknapp')} →
          </a>
          <button type="button" className="ds-toggle" aria-pressed="true">
            {l('Chosen', 'Vald')}
          </button>
          <button type="button" className="ds-toggle" aria-pressed="false">
            {l('Not chosen', 'Inte vald')}
          </button>
          <ul className="cv-chips" aria-label={l('Chips', 'Chips')}>
            <li>dbt</li>
            <li>DuckDB</li>
            <li>React</li>
          </ul>
          <p className="home-notice ds-notice" role="note">
            {l('A note', 'En notering')}
          </p>
        </div>
        <Cards>
          <Card
            index={0}
            title={l('A card has a title', 'Ett kort har en rubrik')}
            meta={l(
              'and a line on what it shows',
              'och en rad om vad det visar',
            )}
            href="#design"
          >
            <p className="ds-body">
              {l(
                'Then one chart or one table. The link in the corner goes further in.',
                'Sedan en graf eller en tabell. Länken i hörnet går vidare in.',
              )}
            </p>
          </Card>
          <Card
            index={1}
            title={l('The same on every page', 'Likadant på varje sida')}
            meta={l('Cards sit in a grid', 'Kort ligger i ett rutnät')}
          >
            <p className="ds-body">
              {l(
                'Wide cards span the grid; the others share it two by two.',
                'Breda kort spänner över rutnätet; de andra delar det två och två.',
              )}
            </p>
          </Card>
        </Cards>
      </section>
    </div>
  )
}
