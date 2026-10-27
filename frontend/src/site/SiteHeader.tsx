import { useEffect, useRef } from 'react'
import { l } from '../i18n'
import Signature from '../home/Signature'
import LanguageToggle from './LanguageToggle'
import './header.css'

/** The header on every page but the start page and SWEDEN's. */
export default function SiteHeader() {
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = header.current
    if (!element) return
    const update = () =>
      document.documentElement.style.setProperty(
        '--header-h',
        `${element.getBoundingClientRect().height}px`,
      )
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--header-h')
    }
  }, [])
  return (
    <header ref={header} className="site-header">
      <a
        className="site-identity"
        href="#start"
        aria-label={l('Anton Ernstsson, home', 'Anton Ernstsson, start')}
      >
        <Signature className="site-signature" gradientId="site-signature-ink" />
      </a>
      <nav
        className="site-navigation"
        aria-label={l('Main navigation', 'Huvudnavigation')}
      >
        <a href="#om-mig">{l('About', 'Om mig')}</a>
        <a href="https://github.com/korv9" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <LanguageToggle />
      </nav>
    </header>
  )
}
