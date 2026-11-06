/**
 * Overview (#projects): the platform case study as prose (words in overviewContent.ts), with
 * its decisions and tools, the step-by-step path beside them, and the
 * warehouse's entity–relationship diagram below.
 * Older hub addresses (#projects-jobs, #platform-health, #tech-er) land here.
 */
import { l } from '../i18n'
import PageHead from '../ui/PageHead'
import PipelineFlow from './PipelineFlow'
import ErDiagram from './ErDiagram'
import {
  DECISIONS,
  FLOW_TITLE,
  LEDE,
  STACK,
  type Bilingual,
} from './overviewContent'
import '../ui/dash/dash.css'
import './hub.css'

export default function ProjectsHub() {
  const tr = (b: Bilingual) => l(b.en, b.sv)
  return (
    <article className="hub-overview" id="projects">
      <div className="hub-top">
        <div className="hub-top-intro">
          <PageHead
            title={l('Overview', 'Översikt')}
            sentence={l(
              'This is my platform, where I host demos of my experiments and projects.',
              'Det här är min plattform, där jag visar demos av mina experiment och projekt.',
            )}
            lede={LEDE.map(tr)}
          />
          <section aria-labelledby="projects-decisions">
            <h2 id="projects-decisions" className="hub-top-title">
              {tr(DECISIONS.title)}
            </h2>
            <dl className="hub-why">
              {DECISIONS.items.map((d) => (
                <div key={d.term.en}>
                  <dt>{tr(d.term)}</dt>
                  <dd>{tr(d.text)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="projects-stack">
            <h2 id="projects-stack" className="hub-top-title">
              {l('Tech stack', 'Teknik')}
            </h2>
            <dl className="hub-stack">
              {STACK.map((s) => (
                <div key={s.group.en}>
                  <dt>{tr(s.group)}</dt>
                  <dd>{s.items.join(' · ')}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <figure className="hub-figure hub-top-path">
          <h3 id="projects-flow-title">{tr(FLOW_TITLE)}</h3>
          <PipelineFlow titleId="projects-flow-title" />
        </figure>
      </div>
      <section className="hub-er-section" aria-labelledby="projects-er">
        <h2 id="projects-er" className="hub-top-title">
          {l('Data model', 'Datamodell')}
        </h2>
        <ErDiagram />
      </section>
    </article>
  )
}
