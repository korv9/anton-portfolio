/**
 * The contents: everything on the site in one large menu, like a table of contents. Opened from
 * the header on every page. Built from the same lists the pages use (the politics and job-market
 * navigation, the projects), so a new page shows up here without a second list to keep.
 */
import { useEffect, useRef } from 'react'
import { l } from '../i18n'
import { profile } from '../content'
import { PROJECTS } from '../home/content'
import { DEEP_DIVES, NAV_GROUPS, THEMES } from '../politik/nav'
import { JOB_THEMES } from '../jobb/nav'

type Item = { href: string; en: string; sv: string; note?: [string, string] }
type Group = { en: string; sv: string; items: Item[] }
type Column = {
  key: string
  en: string
  sv: string
  lead?: [string, string]
  groups: Group[]
}

function columns(): Column[] {
  const politicsGroups: Group[] = NAV_GROUPS.map((g) => ({
    en: g.en || 'Main pages',
    sv: g.sv || 'Huvudsidor',
    items: THEMES.filter((t) => t.group === g.key).map((t) => ({
      href: t.path,
      en: t.en,
      sv: t.sv,
    })),
  }))
  // Each detailed view once, by address (two addresses share a name).
  const seen = new Set<string>()
  const dives: Item[] = Object.entries(DEEP_DIVES)
    .filter(([, d]) => (seen.has(d.sv) ? false : (seen.add(d.sv), true)))
    .map(([href, d]) => ({ href, en: d.en, sv: d.sv }))
  const project = (area: 'ai' | 'data'): Item[] =>
    PROJECTS.filter((p) => p.area === area && p.href).map((p) => ({
      href: p.href,
      en: p.title.en,
      sv: p.title.sv,
      note: [p.kind.en, p.kind.sv],
    }))
  return [
    {
      key: 'me',
      en: 'About me',
      sv: 'Om mig',
      groups: [
        {
          en: 'The start page',
          sv: 'Startsidan',
          items: [
            { href: '#start', en: 'Profile', sv: 'Profil' },
            { href: '#erfarenhet', en: 'Experience', sv: 'Erfarenhet' },
            { href: '#teknik', en: 'Tech stack', sv: 'Tech stack' },
            { href: '#projekt', en: 'All projects', sv: 'Alla projekt' },
          ],
        },
        {
          en: 'Contact',
          sv: 'Kontakt',
          items: [
            ...(profile.cv
              ? [{ href: profile.cv, en: 'Download CV', sv: 'Ladda ned CV' }]
              : []),
            ...(profile.email
              ? [{ href: `mailto:${profile.email}`, en: 'Email', sv: 'Mejl' }]
              : []),
            ...(profile.linkedin
              ? [{ href: profile.linkedin, en: 'LinkedIn', sv: 'LinkedIn' }]
              : []),
            { href: 'https://github.com/korv9', en: 'GitHub', sv: 'GitHub' },
          ],
        },
      ],
    },
    {
      key: 'politik',
      en: 'Political Observatory',
      sv: 'Political Observatory',
      lead: [
        'The flagship: elections, budgets, votes and debates.',
        'Huvudprojektet: val, budget, voteringar och debatter.',
      ],
      groups: [
        ...politicsGroups,
        { en: 'In depth', sv: 'Fördjupningar', items: dives },
      ],
    },
    {
      key: 'ai',
      en: 'AI and machine learning',
      sv: 'AI och maskininlärning',
      groups: [{ en: 'Projects', sv: 'Projekt', items: project('ai') }],
    },
    {
      key: 'data',
      en: 'Data and software',
      sv: 'Data och mjukvara',
      groups: [
        {
          en: 'The job market in numbers',
          sv: 'Jobbmarknaden i siffror',
          items: JOB_THEMES.map((t) => ({ href: t.path, en: t.en, sv: t.sv })),
        },
        {
          en: 'How is Sweden doing?',
          sv: 'Hur mår Sverige?',
          items: [
            { href: '#sweden', en: 'Overview', sv: 'Översikt' },
            {
              href: '#sweden-counties',
              en: 'Compare counties',
              sv: 'Jämför län',
            },
            {
              href: '#sweden-explorer',
              en: 'Explore indicators',
              sv: 'Utforska indikatorer',
            },
            {
              href: '#analysis-counties',
              en: 'Analysis: counties',
              sv: 'Analys: län',
            },
            {
              href: '#analysis-months',
              en: 'Analysis: over time',
              sv: 'Analys: över tid',
            },
            {
              href: '#analysis-europe',
              en: 'Analysis: Europe',
              sv: 'Analys: Europa',
            },
            {
              href: '#analysis-models',
              en: 'Model evaluation',
              sv: 'Modellutvärdering',
            },
          ],
        },
        {
          en: 'More projects',
          sv: 'Fler projekt',
          items: project('data').filter(
            (p) => !['#jobb', '#sweden'].includes(p.href),
          ),
        },
        {
          en: 'About the site',
          sv: 'Om sajten',
          items: [
            {
              href: '#technical',
              en: 'Technical: the architecture',
              sv: 'Technical: arkitekturen',
            },
            { href: '#data-model', en: 'Data model', sv: 'Datamodell' },
            { href: '#status', en: 'Pipeline status', sv: 'Pipelinestatus' },
            {
              href: '#raw-data',
              en: 'Tables and raw data',
              sv: 'Tabeller och rådata',
            },
            {
              href: 'https://github.com/korv9/anton-portfolio',
              en: 'Source code',
              sv: 'Källkoden',
            },
          ],
        },
      ],
    },
  ]
}

export default function SiteMap({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('a')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="site-map-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="site-map"
        id="site-map"
        role="dialog"
        aria-modal="true"
        aria-label={l('Contents', 'Innehåll')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="site-map-head">
          <p>{l('Contents', 'Innehåll')}</p>
          <button type="button" onClick={onClose}>
            {l('Close', 'Stäng')} ✕
          </button>
        </div>
        <nav className="site-map-grid" aria-label={l('Contents', 'Innehåll')}>
          {columns().map((column, c) => (
            <section
              key={column.key}
              className={`site-map-col is-${column.key}`}
              style={{ ['--i' as string]: c }}
              aria-labelledby={`site-map-${column.key}`}
            >
              <h2 id={`site-map-${column.key}`}>{l(column.en, column.sv)}</h2>
              {column.lead && (
                <p className="site-map-lead">{l(...column.lead)}</p>
              )}
              {column.groups
                .filter((g) => g.items.length)
                .map((group) => (
                  <div key={group.sv} className="site-map-group">
                    <h3>{l(group.en, group.sv)}</h3>
                    <ul>
                      {group.items.map((item) => {
                        const external = /^(https?:|mailto:)/.test(item.href)
                        const file = item.href.endsWith('.pdf')
                        return (
                          <li key={item.href + item.sv}>
                            <a
                              href={item.href}
                              onClick={onClose}
                              {...(external
                                ? { target: '_blank', rel: 'noreferrer' }
                                : {})}
                              {...(file ? { download: '' } : {})}
                            >
                              {l(item.en, item.sv)}
                              {external && ' ↗'}
                              {file && ' ↓'}
                            </a>
                            {item.note && <small>{l(...item.note)}</small>}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
            </section>
          ))}
        </nav>
      </div>
    </div>
  )
}
