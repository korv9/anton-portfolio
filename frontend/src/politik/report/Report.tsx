/**
 * The politics report: one question per tab, three tabs, at most three charts in each. Every
 * tab reads the same way: the question, the parties to follow, the main chart, the charts that
 * complete it, and the ways further in. A tab is an address of its own, and the chosen parties
 * follow the reader from tab to tab.
 */
import { useState } from 'react'
import { l } from '../../i18n'
import { REPORT_TABS, type Route } from '../../router'
import { Pick } from '../../charts/feature/Feature'
import { useParties, withParties } from '../partySelection'
import PartyPicker from '../PartyPicker'
import SeatHistory from '../features/SeatHistory'
import PollTrend from '../features/PollTrend'
import VoteShares from '../features/VoteShares'
import BudgetBoard from '../budget/BudgetBoard'
import SkatterTheme from '../themes/SkatterTheme'
import { FocusLines, IssueAreas, StudiesPerYear, VoteAlike } from './charts'
import './report.css'

const TABS = [
  {
    en: 'Power and opinion',
    sv: 'Makt och opinion',
    question: {
      en: 'Who holds power, and who is gaining?',
      sv: 'Vem har makten, och vem växer?',
    },
  },
  {
    en: 'Budget and taxes',
    sv: 'Budget och skatter',
    question: {
      en: 'What do the parties want to do with the money?',
      sv: 'Vad vill partierna göra med pengarna?',
    },
  },
  {
    en: 'Debates and decisions',
    sv: 'Debatter och beslut',
    question: {
      en: 'What does the Riksdag talk about, and what becomes law?',
      sv: 'Vad pratar riksdagen om, och vad blir lag?',
    },
  },
].map((tab, i) => ({ ...tab, path: REPORT_TABS[i] }))

/** What sits behind the report: the analyses that take a page of their own. */
const DEEPER = [
  {
    href: '#politik-partier',
    en: 'The parties',
    sv: 'Partierna',
    about: {
      en: 'Each party’s seats, municipal councils and members',
      sv: 'Varje partis mandat, kommunfullmäktige och ledamöter',
    },
  },
  {
    href: '#politik-partiledardebatter',
    en: 'Party-leader debates',
    sv: 'Partiledardebatter',
    about: {
      en: 'Who replies to whom, and a debate read turn by turn',
      sv: 'Vem replikerar på vem, och en debatt läst inlägg för inlägg',
    },
  },
  {
    href: '#politik-sakdebatter',
    en: 'Issue debates',
    sv: 'Sakdebatter',
    about: {
      en: 'Pick an issue area and read one debate as a chat',
      sv: 'Välj ett sakområde och läs en debatt som chatt',
    },
  },
  {
    href: '#politik-utredningar',
    en: 'Studies and laws',
    sv: 'Utredningar och lagar',
    about: {
      en: 'Recent laws and the studies each of them rests on',
      sv: 'Nya lagar och utredningarna de bygger på',
    },
  },
  {
    href: '#politik-modell',
    en: 'The voting model',
    sv: 'Röstmodellen',
    about: {
      en: 'Can a model learn how a party votes?',
      sv: 'Kan en modell lära sig hur ett parti röstar?',
    },
  },
  {
    href: '#politik-kallor',
    en: 'Sources and method',
    sv: 'Källor och metod',
    about: {
      en: 'Where every figure comes from',
      sv: 'Var varje siffra kommer ifrån',
    },
  },
]

function Power({ route }: { route: Route }) {
  const { selected } = useParties(route)
  const [lines, setLines] = useState<'seats' | 'polls'>('seats')
  return (
    <>
      <div className="report-main">
        <Pick
          label={l('Measure', 'Mått')}
          value={lines}
          options={[
            { value: 'seats', label: l('Seats', 'Mandat') },
            { value: 'polls', label: l('Opinion', 'Opinion') },
          ]}
          onChange={setLines}
        />
        {lines === 'seats' ? (
          <SeatHistory parties={selected} />
        ) : (
          <PollTrend selected={selected} />
        )}
      </div>
      <div className="report-pair">
        <VoteShares />
        <VoteAlike parties={selected} />
      </div>
    </>
  )
}

function Money({ route }: { route: Route }) {
  return (
    <>
      <div className="report-main">
        <BudgetBoard route={route} />
      </div>
      <SkatterTheme route={route} />
    </>
  )
}

function Debates({ route }: { route: Route }) {
  const { selected } = useParties(route)
  return (
    <>
      <div className="report-main">
        <IssueAreas />
      </div>
      <div className="report-pair">
        <FocusLines party={selected[0] ?? null} />
        <StudiesPerYear />
      </div>
    </>
  )
}

export default function Report({ route }: { route: Route }) {
  const { selected } = useParties(route)
  const at = Math.max(0, REPORT_TABS.indexOf(route.path))
  const tab = TABS[at]
  const Body = [Power, Money, Debates][at]
  return (
    <div className="report">
      <header className="politik-intro">
        <p className="politik-intro-name">Political Observatory</p>
        <p className="politik-intro-data">
          {l(
            'Open data on Swedish politics: elections and opinion, the Riksdag’s votes and debates, the budget and taxes, and the studies behind new laws.',
            'Öppna data om svensk politik: val och opinion, riksdagens röster och debatter, budget och skatter, och utredningarna bakom nya lagar.',
          )}
        </p>
      </header>
      <nav className="report-tabs" aria-label={l('Report', 'Rapport')}>
        {TABS.map((t, i) => (
          <a
            key={t.path}
            href={withParties(t.path, selected)}
            aria-current={i === at ? 'page' : undefined}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            {l(t.en, t.sv)}
          </a>
        ))}
      </nav>
      <section className="report-tab" aria-labelledby="report-question">
        <header className="report-head">
          <h1 id="report-question">{l(tab.question.en, tab.question.sv)}</h1>
          <div className="report-slicers">
            <p>{l('Follow parties', 'Följ partier')}</p>
            <PartyPicker route={route} small />
          </div>
        </header>
        <Body route={route} />
      </section>
      <nav className="report-deeper" aria-labelledby="report-deeper">
        <h2 id="report-deeper">{l('Go deeper', 'Fördjupning')}</h2>
        <ul>
          {DEEPER.map((d) => (
            <li key={d.href}>
              <a href={withParties(d.href, selected)}>
                <b>{l(d.en, d.sv)}</b>
                <span>{l(d.about.en, d.about.sv)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
