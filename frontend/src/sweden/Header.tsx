/**
 * The SWEDEN header: no band of its own. The name, the product row and two boxed controls sit
 * on the page and fade into the scene below (a gradient, never a hard edge). It replaces the
 * site header on SWEDEN routes only (App.tsx); every other page keeps SiteHeader.
 *
 * The menu is a native <dialog>: it takes focus, closes on Escape and hands focus back.
 * The theme control switches SWEDEN between its dark default and light, per reader.
 */
import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import { SWEDEN_PRODUCTS } from './products'

const b = (text: { en: string; sv: string }) => l(text.en, text.sv)
const THEME_KEY = 'sw-theme'

function useSwedenTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.swTheme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    return () => {
      delete document.documentElement.dataset.swTheme
    }
  }, [theme])
  return [theme, setTheme] as const
}

export function SwedenHeader({ current }: { current: string }) {
  const [theme, setTheme] = useSwedenTheme()
  const menu = useRef<HTMLDialogElement>(null)
  const close = () => menu.current?.close()
  return (
    <header className="sw-header">
      <div className="sw-header-main">
        <a className="sw-wordmark" href="#start">
          Anton Ernstsson
        </a>
        <nav className="sw-nav" aria-label="SWEDEN">
          <a
            href="#sweden"
            aria-current={current === '#sweden' ? 'page' : undefined}
          >
            SWEDEN
          </a>
          {SWEDEN_PRODUCTS.map((p) => (
            <a
              key={p.href}
              href={p.href}
              aria-current={current === p.href ? 'page' : undefined}
              aria-label={`${p.id === 'X' ? '' : p.id + ' · '}${b(p.title)}`}
            >
              <b aria-hidden="true">{p.id === 'X' ? '×' : p.id}</b>
              <span aria-hidden="true">{b(p.short)}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="sw-header-tools">
        <button
          type="button"
          className="sw-box"
          aria-haspopup="dialog"
          onClick={() => menu.current?.showModal()}
        >
          {l('MENU', 'MENY')}
        </button>
        <button
          type="button"
          className="sw-box"
          aria-pressed={theme === 'light'}
          aria-label={l('Light theme', 'Ljust tema')}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle
              cx="9"
              cy="9"
              r="7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M9 1.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <dialog
        ref={menu}
        className="sw-menu"
        aria-label={l('Menu', 'Meny')}
        onClick={(e) => e.target === menu.current && close()}
      >
        <div className="sw-menu-top">
          <span className="sw-wordmark">Anton Ernstsson</span>
          <button
            type="button"
            className="sw-box"
            onClick={close}
            aria-label={l('Close the menu', 'Stäng menyn')}
          >
            ×
          </button>
        </div>
        <nav onClick={(e) => (e.target as HTMLElement).closest('a') && close()}>
          <h2>{l('Start', 'Start')}</h2>
          <a href="#start">Intro</a>
          <h2>SWEDEN</h2>
          <a
            href="#sweden"
            aria-current={current === '#sweden' ? 'page' : undefined}
          >
            {l('All research', 'Alla undersökningar')}
          </a>
          {SWEDEN_PRODUCTS.map((p) => (
            <a
              key={p.href}
              href={p.href}
              aria-current={current === p.href ? 'page' : undefined}
            >
              <span>{b(p.title)}</span>
              <small>{p.id === 'X' ? '×' : p.id}</small>
            </a>
          ))}
          <a href="#sweden-atlas">
            <span>{l('Atlas (preview)', 'Atlas (förhandsvisning)')}</span>
            <small>3D</small>
          </a>
          <h2>{l('More', 'Övrigt')}</h2>
          <a href="#projekt">{l('All projects', 'Alla projekt')}</a>
          <a href="#cluster-visuals">Cluster Visuals</a>
          <a href="#om-mig">{l('About me', 'Om mig')}</a>
        </nav>
      </dialog>
    </header>
  )
}
