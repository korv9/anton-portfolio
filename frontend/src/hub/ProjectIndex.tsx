/**
 * The projects index on Overview, on every viewport: the rail's groups (site/ProjectRail.tsx),
 * each project with its one-line descriptor from the registry, or the rail's own line for pages
 * without a registry entry. Experimental entries carry a muted status word.
 */
import { l } from '../i18n'
import { PROJECTS } from '../projects/projectRegistry'
import { GROUPS } from '../site/ProjectRail'
import './hub.css'

export default function ProjectIndex({
  groups = GROUPS,
}: {
  groups?: typeof GROUPS
}) {
  return (
    <nav className="hub-index" aria-label={l('Project index', 'Projektindex')}>
      {groups.map((group) => (
        <section key={group.en} className="hub-links">
          {groups.length > 1 && <h3>{l(group.en, group.sv)}</h3>}
          <ul>
            {group.items.map((item) => {
              const entry = PROJECTS.find((p) => p.href === item.href)
              const line = entry
                ? l(entry.descriptor.en, entry.descriptor.sv)
                : item.descriptor && l(...item.descriptor)
              return (
                <li key={item.href}>
                  <a href={item.href}>{l(item.en, item.sv)}</a>
                  {item.experimental && (
                    <>
                      {' '}
                      <span className="hub-status">
                        {l('experimental', 'experimentellt')}
                      </span>
                    </>
                  )}
                  {line && <p>{line}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
