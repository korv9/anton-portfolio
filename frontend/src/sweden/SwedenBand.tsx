/**
 * The one header of the SWEDEN pages (App.tsx renders it instead of SiteHeader on SWEDEN routes):
 * a black band with the identity, SWEDEN and a pill per research product, and a menu that slides
 * in from the right. On phones the pills move to a second, horizontally scrolling row under the
 * band; that row is SWEDEN's own navigation, not a second site header.
 *
 * The menu is a native <dialog>: Escape closes it and focus returns to the button that opened it.
 */
import { useEffect, useRef } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useHeaderHeight } from '../site/SiteHeader'
import { SWEDEN_PRODUCTS } from './products'
import './sweden.css'

const b = (text: { en: string; sv: string }) => l(text.en, text.sv)
const mark = (id: string) => (id === 'X' ? '×' : id)

export default function SwedenBand({ route }: { route: Route }) {
  const header = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useHeaderHeight(header)
  // A link in the menu navigates within the page: close the menu with it.
  useEffect(() => {
    dialog.current?.close()
  }, [route.hash])
  const pills = (
    <ul className="sw-pills">
      {SWEDEN_PRODUCTS.map((p) => {
        const current = route.path === p.href
        return (
          <li key={p.id}>
            <a
              href={p.href}
              className="sw-pill"
              aria-label={`${mark(p.id)} — ${b(p.title)}`}
              aria-current={current ? 'page' : undefined}
            >
              <span aria-hidden="true">{mark(p.id)}</span>
              {current && (
                <span className="sw-pill-name" aria-hidden="true">
                  · {b(p.title)}
                </span>
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
  return (
    <header ref={header} className="sw-band-wrap">
      <div className="sw-band">
        <a className="sw-band-identity" href="#start">
          ANTON ERNSTSSON
        </a>
        <nav className="sw-band-nav" aria-label="SWEDEN">
          <a
            href="#sweden"
            className="sw-band-home"
            aria-current={route.path === '#sweden' ? 'page' : undefined}
          >
            SWEDEN
          </a>
          {pills}
        </nav>
        <button
          type="button"
          className="sw-menu-button"
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M2 4h12M2 8h12M2 12h12"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          {l('Menu', 'Meny')}
        </button>
      </div>
      <nav
        className="sw-band-row"
        aria-label={l('SWEDEN research', 'SWEDEN-forskning')}
      >
        {pills}
      </nav>
      <dialog
        ref={dialog}
        className="sw-menu"
        aria-label={l('Menu', 'Meny')}
        onClick={(e) => {
          // A click on the backdrop (the dialog itself, outside its panel) closes it.
          if (e.target === dialog.current) dialog.current.close()
        }}
      >
        <div className="sw-menu-panel">
          <div className="sw-menu-head">
            <b>{l('Menu', 'Meny')}</b>
            <button
              type="button"
              className="sw-menu-close"
              onClick={() => dialog.current?.close()}
            >
              {l('Close', 'Stäng')}
            </button>
          </div>
          <MenuGroup
            title={l('Start', 'Start')}
            links={[
              ['#start', l('Intro', 'Intro')],
              [
                '#sweden',
                l('SWEDEN / Sweden in relief', 'SWEDEN / Sverige i höjd'),
              ],
            ]}
            current={route.path}
          />
          <MenuGroup
            title="SWEDEN"
            links={[
              ['#sweden', l('All investigations', 'Alla undersökningar')],
              ...SWEDEN_PRODUCTS.map(
                (p) =>
                  [p.href, `${mark(p.id)} — ${b(p.title)}`] as [string, string],
              ),
            ]}
            current={route.path}
          />
          <MenuGroup
            title={l('More', 'Övrigt')}
            links={[
              ['#projekt', l('Other projects', 'Andra projekt')],
              ['#tech', l('Tech panel', 'Teknikpanel')],
              ['#om-mig', l('About me', 'Om mig')],
            ]}
            current={route.path}
          />
        </div>
      </dialog>
    </header>
  )
}

function MenuGroup({
  title,
  links,
  current,
}: {
  title: string
  links: [string, string][]
  current: string
}) {
  return (
    <section className="sw-menu-group" aria-label={title}>
      <h2>{title}</h2>
      <ul>
        {links.map(([href, text]) => (
          <li key={href + text}>
            <a href={href} aria-current={href === current ? 'page' : undefined}>
              {text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The notice the site header carries elsewhere, moved out of the band on SWEDEN pages. */
export function SwedenFooter() {
  return (
    <footer className="sw-footer">
      <p>{l('Site still in development', 'Webbplatsen är under utveckling')}</p>
    </footer>
  )
}
