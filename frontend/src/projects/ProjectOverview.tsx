import { l } from '../i18n'
import { PROJECTS } from './projectRegistry'
import { PROJECT_TOPICS } from './topics'

export default function ProjectOverview({ id }: { id: string }) {
  const project = PROJECTS.find((p) => p.id === id)!
  const topics = PROJECT_TOPICS[id] ?? []
  const sources =
    id === 'politics'
      ? '#politik-kallor'
      : id === 'jobs'
        ? '#jobb-kallor'
        : id === 'ai-act'
          ? '#ai-act-sources'
          : '#sweden-explorer'
  return (
    <article className="project-overview">
      <header>
        <p className="eyebrow">Observatories</p>
        <h1>{l(project.title.en, project.title.sv)}</h1>
        <p className="overview-intro">
          {l(project.summary.en, project.summary.sv)}
        </p>
      </header>
      <nav
        className="overview-topics"
        aria-label={l('Choose a topic', 'Välj ett tema')}
      >
        {topics.map((topic, index) => (
          <a key={topic.href} href={topic.href}>
            <span className="overview-topic-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2>{l(topic.title.en, topic.title.sv)}</h2>
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
      <footer>
        <a href={sources}>
          {l(
            id === 'welfare'
              ? 'Explore the indicator data'
              : 'Sources and method',
            id === 'welfare' ? 'Utforska indikatordata' : 'Källor och metod',
          )}
        </a>
      </footer>
    </article>
  )
}
