import { l } from '../i18n'
import type { Bilingual, Project } from '../home/content'

const b = (text: Bilingual) => l(text.en, text.sv)

const repoName = (url: string) => url.replace('https://github.com/', '')

/**
 * One project: what it is, what came of it and the tools, with the page and the code as
 * separate links. A project without a public page or repository says so.
 */
export default function ProjectTile({ project }: { project: Project }) {
  const external = project.href.startsWith('http')
  const code = project.code
    ? Array.isArray(project.code)
      ? project.code
      : [project.code]
    : []
  return (
    <li className={`cv-project${project.area === 'ai' ? ' ai' : ''}`}>
      <span className="cv-kind">{b(project.kind)}</span>
      <h3>
        {project.href ? (
          <a
            href={project.href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {b(project.title)}{' '}
            <span aria-hidden="true">{external ? '↗' : '→'}</span>
          </a>
        ) : (
          b(project.title)
        )}
      </h3>
      {project.area === 'ai' && <p>{b(project.summary)}</p>}
      <p className="cv-project-result">{b(project.result)}</p>
      <ul className="cv-chips" aria-label={l('Tools', 'Verktyg')}>
        {project.tech.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="cv-project-links">
        {project.team && <span>{b(project.team)}</span>}
        {code.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {code.length > 1 ? repoName(url) : l('Code', 'Kod')} ↗
          </a>
        ))}
        {!project.href && !code.length && (
          <span>{l('Code not public', 'Koden är inte publik')}</span>
        )}
      </p>
    </li>
  )
}
