import { useEffect, useRef, useState } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import LanguageToggle from './LanguageToggle'
import './header.css'

export default function SiteHeader({ route }: { route: Route }) {
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
  const [projectsReached, setProjectsReached] = useState(false)
  const hidden = route.page === 'home' && !projectsReached
  useEffect(() => {
    if (route.page !== 'home') return
    const projects = document.querySelector('.home-project-marker')
    if (!projects) return
    const update = () =>
      setProjectsReached(projects.getBoundingClientRect().top <= 160)
    const observer = new IntersectionObserver(update, {
      rootMargin: '-160px 0px 0px 0px',
    })
    observer.observe(projects)
    const section = projects.parentElement
    if (section) observer.observe(section)
    update()
    return () => observer.disconnect()
  }, [route.page])
  return (
    <header
      ref={header}
      className="site-header"
      data-hidden={hidden}
      inert={hidden}
    >
      <a className="site-identity" href="#start">
        <strong>ANTON ERNSTSSON</strong>
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
