/**
 * How the platform is built, as one flow from public source to this site: seven steps on a rail,
 * each with what it does, the tool, its counts from the published files and, where it has one,
 * its health. Choosing a project marks the steps its data passes through, from the per-subject
 * counts in architecture/graph.json. The list is the diagram's text: it reads in order without
 * the rail. A figure whose file cannot be read, or that has no date, is left out.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import type { Graph } from '../tech/PipelineTables'
import { day, num, ok, useFile } from '../tech/techData'
import { loadWorkflows, type Run } from '../tech/WorkflowRuns'
import { useDbtSize, useStatus } from './Headline'
import { HUB_GROUPS } from './hubProjects'
import PlatformMap, { type MapNode } from './PlatformMap'
import { buildSteps, type Quality, type Step } from './flowSteps'

/** The latest finished CI run on main, or nothing when GitHub cannot be read. */
function useCi() {
  const [run, setRun] = useState<Run>()
  useEffect(() => {
    loadWorkflows().then(
      (workflows) =>
        setRun(
          workflows
            .find((w) => w.path.endsWith('/ci.yml'))
            ?.runs.find(
              (r) => r.head_branch === 'main' && r.status === 'completed',
            ),
        ),
      () => undefined,
    )
  }, [])
  return run
}

/** The projects with a subject in the graph, in the hub's order: job search first. */
const PROJECTS = HUB_GROUPS.flatMap((g) => g.items).filter((i) => i.domain)

const plural = (n: number, [one, many]: [string, string]) =>
  `${num(n)} ${n === 1 ? one : many}`

export default function PlatformFlow() {
  const graph = useFile<Graph>('architecture/graph.json')
  const quality = useFile<Quality>('quality/summary.json')
  const status = useStatus()
  const ci = useCi()
  const { size, at: sizeAt, release } = useDbtSize()
  const [chosen, setChosen] = useState(PROJECTS[0]?.id)
  const project = PROJECTS.find((p) => p.id === chosen)
  const counts = ok(graph)
    ? graph.domains.find((d) => d.id === project?.domain)?.counts
    : undefined
  // Models dbt has switched off are in the graph too; the counts are of what dbt builds.
  const typed = (...types: string[]) =>
    ok(graph)
      ? graph.nodes.filter((n) => n.enabled !== false && types.includes(n.type))
          .length
      : 0
  const g = ok(graph)
  const checks = ok(quality) ? quality.run.check_statuses : {}
  const measured = ok(quality)
    ? quality.run.checks -
      (checks.not_applicable ?? 0) -
      (checks.not_measured ?? 0)
    : 0
  const layers = `bronze ${num(typed('bronze'))} · silver ${num(typed('silver'))} · gold ${num(typed('gold'))}`
  const steps = buildSteps({
    g,
    typed,
    graph: ok(graph) ? graph : undefined,
    size,
    status,
    quality: ok(quality) ? quality : undefined,
    checks,
    measured,
    layers,
    release,
    ci,
  })
  const name = project && counts && l(project.title.en, project.title.sv)
  const usedBy = (step: Step) =>
    counts ? step.count.some((key) => (counts[key] ?? 0) > 0) : false
  const used = steps.filter(usedBy).length
  // The picture's boxes: a short name, the step's headline count and its unit.
  const box: Record<string, [string, number | undefined, string]> = {
    sources: [
      l('Sources', 'Källor'),
      g ? typed('source') : undefined,
      l('publishers', 'utgivare'),
    ],
    ingestion: [
      l('Ingestion', 'Inläsning'),
      g ? typed('ingestion') : undefined,
      l('jobs', 'jobb'),
    ],
    dbt: ['dbt', size?.models, l('models', 'modeller')],
    ml: ['ML', g ? typed('ml') : undefined, l('stages', 'steg')],
    tests: [l('Tests', 'Tester'), size?.tests, l('dbt tests', 'dbt-tester')],
    publish: [
      'R2',
      g ? typed('delivery') : undefined,
      l('exports', 'exporter'),
    ],
    site: [
      l('Site', 'Sidan'),
      g ? typed('frontend') : undefined,
      l('products', 'produkter'),
    ],
  }
  const nodes: MapNode[] = steps.map((step) => ({
    id: step.id,
    short: box[step.id][0],
    value: box[step.id][1] === undefined ? undefined : num(box[step.id][1]!),
    unit: box[step.id][2],
    used: Boolean(counts) && usedBy(step),
  }))
  const mapSummary = steps
    .map((step) => {
      const [, value, unit] = box[step.id]
      return `${step.title}${value === undefined ? '' : ` (${num(value)} ${unit})`}`
    })
    .join(', ')
  // Each file with its own date, so a figure's age is never hidden behind a newer one.
  const dated = (file: string, at?: string) =>
    at ? `${file} (${day(at).slice(0, 10)})` : file
  const files = [
    size && dated('schema/summary.json', sizeAt),
    ok(graph) && dated('architecture/graph.json', graph.generated_at),
    status && 'status/ingestion.json',
    ok(quality) && dated('quality/summary.json', quality.run.evaluated_at),
    release && l('the active R2 manifest', 'det aktiva R2-manifestet'),
    ci && 'GitHub Actions',
  ].filter(Boolean)
  return (
    <section
      id="projects-flow"
      className="hub-flow"
      aria-labelledby="projects-flow-title"
    >
      <h2 id="projects-flow-title">
        {l('How the platform is built', 'Så är plattformen byggd')}
      </h2>
      <p className="tech-note">
        {l(
          'From a public source to this site in seven steps. Choose a project to mark its path.',
          'Från en offentlig källa till den här sidan i sju steg. Välj ett projekt för att markera dess väg.',
        )}
      </p>
      {g && PROJECTS.length > 0 && (
        <div
          className="tech-pick hub-flow-pick"
          role="group"
          aria-label={l('Project', 'Projekt')}
        >
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === chosen}
              onClick={() => setChosen(p.id)}
            >
              {l(p.title.en, p.title.sv)}
            </button>
          ))}
        </div>
      )}
      {name && (
        <p className="hub-flow-summary" aria-live="polite">
          {l(
            `${name} uses ${used} of the ${steps.length} steps.`,
            `${name} använder ${used} av de ${steps.length} stegen.`,
          )}
        </p>
      )}
      <PlatformMap
        nodes={nodes}
        chosen={chosen}
        summary={
          name
            ? l(
                `${mapSummary}. ${name} uses ${used} of the seven.`,
                `${mapSummary}. ${name} använder ${used} av de sju.`,
              )
            : mapSummary
        }
      />
      <ol className="hub-flow-steps">
        {steps.map((step, i) => {
          const isUsed = usedBy(step)
          const own = counts?.[step.count[0]] ?? 0
          return (
            <li
              key={step.id}
              id={`flow-${step.id}`}
              data-used={isUsed || undefined}
            >
              <span className="hub-flow-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="hub-flow-head">
                <h3>{step.title}</h3>
                <p className="hub-flow-tool">{step.tool}</p>
              </div>
              <p className="hub-flow-what">{step.what}</p>
              <div className="hub-flow-data">
                {step.figures.filter(Boolean).map((f, k) => (
                  <p key={k}>{f}</p>
                ))}
                {name && (
                  <p className="hub-flow-project">
                    {`${name}: `}
                    {!isUsed
                      ? l('not used', 'används inte')
                      : step.id === 'tests'
                        ? l('its models are tested', 'dess modeller testas')
                        : own > 0
                          ? plural(own, step.unit)
                          : l(
                              'through other subjects’ data',
                              'genom andra ämnens data',
                            )}
                  </p>
                )}
                <a
                  href={step.link[0]}
                  {...(step.link[0].startsWith('http')
                    ? { target: '_blank', rel: 'noreferrer' }
                    : {})}
                >
                  {step.link[1]}
                  {step.link[0].startsWith('http') && (
                    <span aria-hidden="true"> ↗</span>
                  )}
                </a>
              </div>
            </li>
          )
        })}
      </ol>
      {files.length > 0 && (
        <p className="tech-meta">
          {l('Read from', 'Läst från')} {files.join(', ')}.
        </p>
      )}
    </section>
  )
}
