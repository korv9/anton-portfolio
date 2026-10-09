/**
 * Svensk politik i siffror: the politics product. Its themes are listed under the project in
 * the site sidebar, in groups: Översikt, Makten, Pengarna, Debatter, Besluten and Mer.
 * The main pages are dashboards; every older detailed view opens as a deep dive under its
 * theme, and one debate opens replik för replik under Debatter.
 */
import { Suspense, lazy, useEffect } from 'react'
import { l } from '../i18n'
import {
  PartyLogo,
  RIKSDAG_PARTIES,
  partyFill,
  partyName,
} from '../parties/identity'
import { carryParties, useParties, withParties } from './partySelection'
import type { Route } from '../router'
import {
  THEMES,
  chapterOf,
  neighbours,
  themeByPath,
  type ThemeKey,
} from './nav'
import './politik.css'
import './dash/dash.css'

const PolitikDash = lazy(() => import('./PolitikDash'))
const ValjarnaTheme = lazy(() => import('./themes/ValjarnaTheme'))
const RosterTheme = lazy(() => import('./themes/RosterTheme'))
const BudgetTheme = lazy(() => import('./themes/BudgetTheme'))
const BudgetBoard = lazy(() => import('./budget/BudgetBoard'))
const SkatterTheme = lazy(() => import('./themes/SkatterTheme'))
const UtredningarTheme = lazy(() => import('./themes/UtredningarTheme'))
const NyheterTheme = lazy(() => import('./themes/NyheterTheme'))
const Partier = lazy(() => import('./partier/Partier'))
const Sakdebatter = lazy(() => import('./debatter/Sakdebatter'))
const Partiledardebatter = lazy(() => import('./debatter/Partiledardebatter'))
const DebateView = lazy(() => import('./debatter/DebateView'))
const TalTheme = lazy(() => import('./themes/TalTheme'))
const UtforskaTheme = lazy(() => import('./themes/UtforskaTheme'))
const ModellTheme = lazy(() => import('./modell/ModellTheme'))
const KallorTheme = lazy(() => import('./themes/KallorTheme'))
const DeepDive = lazy(() => import('./DeepDive'))

function ThemeView({ theme, route }: { theme: ThemeKey; route: Route }) {
  switch (theme) {
    case 'lage':
      return <PolitikDash route={route} />
    case 'valjarna':
      return <ValjarnaTheme route={route} />
    case 'roster':
      return <RosterTheme route={route} />
    case 'budget':
      return <BudgetBoard route={route} />
    case 'skatter':
      return <SkatterTheme route={route} />
    case 'utredningar':
      return <UtredningarTheme route={route} />
    case 'nyheter':
      return <NyheterTheme route={route} />
    case 'partier':
      return <Partier route={route} />
    case 'sakdebatter':
      return <Sakdebatter route={route} />
    case 'partiledare':
      return <Partiledardebatter route={route} />
    case 'tal':
      return <TalTheme route={route} />
    case 'modell':
      return <ModellTheme route={route} />
    case 'utforska':
      return <UtforskaTheme />
    case 'kallor':
      return <KallorTheme />
  }
}

export default function PoliticsProduct({ route }: { route: Route }) {
  // The themes are listed in the site sidebar (site/Sidebar.tsx).
  const theme = themeByPath(route.path)
  const { selected } = useParties(route)
  // Moving between pages keeps the parties chosen earlier in the session.
  useEffect(() => carryParties(route), [route.path])
  // The overview opens on its own first screen, with the party bar under it.
  const landing = route.path === '#politik'
  return (
    <div className={`politik${landing ? ' politik-landing' : ''}`} id="politik">
      <div className="politik-body">
        {!landing && <PartySlicer route={route} />}
        <div className="politik-main">
          <Suspense
            fallback={
              <p className="theme-loading" role="status">
                {l('Loading…', 'Laddar…')}
              </p>
            }
          >
            {theme ? (
              <>
                <ThemeView theme={theme.key} route={route} />
                <NextPage theme={theme.key} selected={selected} />
              </>
            ) : route.path === '#politik-debatt' ? (
              <DebateView route={route} />
            ) : route.path === '#politik-budget-detalj' ? (
              <BudgetTheme route={route} />
            ) : (
              <DeepDive path={route.path} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/**
 * The party bar: one row of party buttons above every page, like a slicer. Any number can be
 * chosen; every chart then shows those parties side by side. None chosen means all parties.
 */
function PartySlicer({ route }: { route: Route }) {
  const { selected, toggle, clear } = useParties(route)
  return (
    <div
      className={selected.length ? 'politik-slicer active' : 'politik-slicer'}
      role="group"
      aria-label={l('Parties', 'Partier')}
    >
      <p className="politik-slicer-label" aria-hidden="true">
        {l('Parties', 'Partier')}
      </p>
      <ul>
        {RIKSDAG_PARTIES.map((code) => (
          <li key={code}>
            <button
              type="button"
              aria-pressed={selected.includes(code)}
              aria-label={partyName(code)}
              title={partyName(code)}
              className="round"
              style={{ ['--party' as string]: partyFill(code) }}
              onClick={() => toggle(code)}
            >
              <PartyLogo party={code} size={32} />
              <span aria-hidden="true">{code}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="politik-slicer-state" aria-live="polite">
        {selected.length ? (
          <>
            <span>
              {selected.length === 1
                ? partyName(selected[0])
                : l(
                    `${selected.length} parties compared`,
                    `${selected.length} partier jämförs`,
                  )}
            </span>
            <button type="button" onClick={clear}>
              {l('Show all', 'Visa alla')}
            </button>
          </>
        ) : (
          <span>
            {l(
              'All parties, choose one or more to compare',
              'Alla partier, välj ett eller flera för att jämföra',
            )}
          </span>
        )}
      </p>
    </div>
  )
}

/**
 * The end of every page: where it sits in the story, and the question the next page answers,
 * as a link, so the pages read in order like chapters.
 */
function NextPage({
  theme,
  selected,
}: {
  theme: ThemeKey
  selected: string[]
}) {
  const { previous, next } = neighbours(theme)
  if (!next && !previous) return null
  const chapter = (t: (typeof THEMES)[number]) => {
    const c = chapterOf(t)
    return c.n
      ? `${l('Chapter', 'Kapitel')} ${c.n}, ${l(c.en, c.sv)}`
      : l(t.en, t.sv)
  }
  return (
    <nav
      className="politik-next"
      aria-label={l('Next in the story', 'Nästa i berättelsen')}
    >
      {previous && (
        <a
          className="politik-prev-link"
          href={withParties(previous.path, selected)}
        >
          <small>{chapter(previous)}</small>
          <span>{l(previous.en, previous.sv)}</span>
        </a>
      )}
      {next && (
        <a
          className="politik-next-link"
          href={withParties(next.path, selected)}
        >
          <small>
            {l('Next', 'Nästa')}: {chapter(next)}
          </small>
          <span>{l(next.question.en, next.question.sv)}</span>
        </a>
      )}
    </nav>
  )
}
