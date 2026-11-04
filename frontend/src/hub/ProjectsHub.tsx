/**
 * Overview (#projects): the platform case study as prose (words in overviewContent.ts), with
 * four numbers read from its own published files, the flow diagram and the project index.
 * Older hub addresses (#projects-jobs, #platform-health, #tech-er) land here.
 */
import { l } from '../i18n'
import PageHead from '../ui/PageHead'
import type { Quality, Summary } from './overviewTypes'
import { ok, useJson as useFile } from '../useJson'
import { ProjectSection } from '../ui/Project'
import ProjectIndex from './ProjectIndex'
import PlatformFlow from './PlatformFlow'
import {
  BUILT,
  DECISIONS,
  LEDE,
  NEEDS,
  PROJECTS_TITLE,
  WORK,
  WRONG,
  type Bilingual,
} from './overviewContent'
import '../ui/dash/dash.css'
import './hub.css'

export default function ProjectsHub() {
  const summary = useFile<Summary>('schema/summary.json')
  const quality = useFile<Quality>('quality/summary.json')
  const statuses = ok(quality) ? quality.run.check_statuses : undefined
  const kpis = [
    {
      label: l('warehouse rows', 'rader i lagret'),
      value: ok(summary) ? `${(summary.rows / 1e6).toFixed(1)}M` : '…',
    },
    {
      label: l('dbt models', 'dbt-modeller'),
      value: ok(summary) ? summary.models : '…',
    },
    {
      label: l('dbt tests', 'dbt-tester'),
      value: ok(summary) ? summary.tests : '…',
    },
    {
      label: l(
        'quality checks passing, of those applicable and measured',
        'kvalitetskontroller godkända, av dem som gäller och är mätta',
      ),
      value: !ok(quality)
        ? '…'
        : statuses
          ? `${statuses.pass ?? 0} ${l('of', 'av')} ${quality.run.checks - (statuses.not_applicable ?? 0) - (statuses.not_measured ?? 0)}`
          : '–',
    },
  ]
  const tr = (b: Bilingual) => l(b.en, b.sv)
  return (
    <article className="hub-overview" id="projects">
      <PageHead
        title={l('Overview', 'Översikt')}
        sentence={l(
          'One data platform of my own runs every project here.',
          'En egen dataplattform driver alla projekt här.',
        )}
        lede={LEDE.map(tr)}
        kpis={kpis}
      />
      <ProjectSection id="projects-needs" title={tr(NEEDS.title)}>
        <p>{tr(NEEDS.intro)}</p>
        <ul>
          {NEEDS.items.map((item) => (
            <li key={item.en}>{tr(item)}</li>
          ))}
        </ul>
      </ProjectSection>
      <ProjectSection id="projects-built" title={tr(BUILT.title)}>
        <figure className="hub-figure">
          <h3 id="projects-flow-title">{tr(BUILT.flowTitle)}</h3>
          <PlatformFlow titleId="projects-flow-title" />
        </figure>
        <div className="dk-table-wrap">
          <table className="dk-table">
            <thead>
              <tr>
                {BUILT.head.map((h) => (
                  <th key={h.en} scope="col">
                    {tr(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUILT.rows.map(([stage, text]) => (
                <tr key={stage.en}>
                  <td>{tr(stage)}</td>
                  <td>{tr(text)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProjectSection>
      <ProjectSection id="projects-decisions" title={tr(DECISIONS.title)}>
        <dl className="hub-why">
          {DECISIONS.items.map((d) => (
            <div key={d.term.en}>
              <dt>{tr(d.term)}</dt>
              <dd>{tr(d.text)}</dd>
            </div>
          ))}
        </dl>
      </ProjectSection>
      <ProjectSection id="projects-wrong" title={tr(WRONG.title)}>
        {WRONG.paragraphs.map((p) => (
          <p key={p.en}>{tr(p)}</p>
        ))}
      </ProjectSection>
      <ProjectSection id="projects-work" title={tr(WORK.title)}>
        <p>
          {tr(WORK.text)}{' '}
          <a href={WORK.repo} target="_blank" rel="noreferrer">
            {WORK.repoLabel}
          </a>
          .
        </p>
      </ProjectSection>
      <ProjectSection id="projects-index" title={tr(PROJECTS_TITLE)}>
        <ProjectIndex />
      </ProjectSection>
    </article>
  )
}
