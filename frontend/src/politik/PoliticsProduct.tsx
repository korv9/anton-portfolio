/**
 * Svensk politik i siffror: the politics product. One navigation with seven themes (a sidebar
 * on wide screens, a horizontal menu on small ones); each theme is one question answered by
 * one chart, and every older detailed view opens as a deep dive under its theme.
 */
import { Suspense, lazy, useEffect, useRef } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { THEMES, deepDiveOf, themeByPath, type ThemeKey } from './nav'
import './politik.css'

const LageTheme = lazy(() => import('./themes/LageTheme'))
const ValjarnaTheme = lazy(() => import('./themes/ValjarnaTheme'))
const RosterTheme = lazy(() => import('./themes/RosterTheme'))
const BudgetTheme = lazy(() => import('./themes/BudgetTheme'))
const TalTheme = lazy(() => import('./themes/TalTheme'))
const UtforskaTheme = lazy(() => import('./themes/UtforskaTheme'))
const KallorTheme = lazy(() => import('./themes/KallorTheme'))
const DeepDive = lazy(() => import('./DeepDive'))

function ThemeView({ theme, route }: { theme: ThemeKey; route: Route }) {
  switch (theme) {
    case 'lage':
      return <LageTheme />
    case 'valjarna':
      return <ValjarnaTheme route={route} />
    case 'roster':
      return <RosterTheme route={route} />
    case 'budget':
      return <BudgetTheme route={route} />
    case 'tal':
      return <TalTheme route={route} />
    case 'utforska':
      return <UtforskaTheme />
    case 'kallor':
      return <KallorTheme />
  }
}

export default function PoliticsProduct({ route }: { route: Route }) {
  const theme = themeByPath(route.path)
  const dive = theme ? null : deepDiveOf(route.path)
  const active: ThemeKey = theme?.key ?? dive?.dive.parent ?? 'utforska'
  const nav = useRef<HTMLElement>(null)
  // Keep the active item in view in the horizontal menu on small screens, scrolling only the
  // menu itself (scrollIntoView would also move the page).
  useEffect(() => {
    const menu = nav.current
    const item = menu?.querySelector<HTMLElement>('[aria-current]')
    if (!menu || !item || menu.scrollWidth <= menu.clientWidth) return
    menu.scrollLeft =
      item.offsetLeft - (menu.clientWidth - item.offsetWidth) / 2
  }, [active])

  return (
    <div className="politik" id="politik">
      <aside className="politik-side">
        <a className="politik-brand" href="#politik">
          <span>{l('Swedish politics', 'Svensk politik')}</span>
          <small>{l('in numbers', 'i siffror')}</small>
        </a>
        <nav
          ref={nav}
          className="politik-nav"
          aria-label={l('Politics', 'Politik')}
        >
          <ol>
            {THEMES.map((t, index) => (
              <li key={t.key}>
                <a
                  href={t.path}
                  aria-current={
                    t.key === active ? (theme ? 'page' : 'true') : undefined
                  }
                >
                  <span className="politik-nav-no" aria-hidden="true">
                    {index + 1}
                  </span>
                  {l(t.en, t.sv)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <div className="politik-main">
        <Suspense
          fallback={
            <p className="theme-loading" role="status">
              {l('Loading…', 'Laddar…')}
            </p>
          }
        >
          {theme ? (
            <ThemeView theme={theme.key} route={route} />
          ) : (
            <DeepDive path={route.path} />
          )}
        </Suspense>
      </div>
    </div>
  )
}
