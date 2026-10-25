/**
 * How the platform is built, as one flow from public source to this site: seven steps on a rail,
 * each with what it does, the tool, its counts from the published files and, where it has one,
 * its health. Choosing a project marks the steps its data passes through, from the per-subject
 * counts in architecture/graph.json. The list is the diagram's text: it reads in order without
 * the rail. A figure whose file cannot be read is left out.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { deliveryState } from '../dataSource'
import { l } from '../i18n'
import type { Graph } from '../tech/PipelineTables'
import { REPO, ago, day, num, ok, useFile } from '../tech/techData'
import { loadWorkflows, type Run } from '../tech/WorkflowRuns'
import { useStatus, type Summary } from './Headline'
import { HUB_GROUPS } from './hubProjects'

type Quality = {
  run: {
    evaluated_at: string
    checks: number
    check_statuses: Record<string, number>
  }
}

type Step = {
  id: string
  title: string
  tool: string
  what: string
  /** The platform-wide figures. */
  figures: ReactNode[]
  /** The key in a subject's counts that says whether a project uses this step. */
  count: string
  unit: [string, string]
  link: [href: string, label: string]
}

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
  const summary = useFile<Summary>('schema/summary.json')
  const quality = useFile<Quality>('quality/summary.json')
  const status = useStatus()
  const ci = useCi()
  const [release, setRelease] = useState<string>()
  useEffect(() => {
    deliveryState().then(
      (d) => setRelease(d.activatedAt ?? undefined),
      () => undefined,
    )
  }, [])
  const [chosen, setChosen] = useState(PROJECTS[0]?.id)
  const project = PROJECTS.find((p) => p.id === chosen)
  const counts = ok(graph)
    ? graph.domains.find((d) => d.id === project?.domain)?.counts
    : undefined
  const typed = (...types: string[]) =>
    ok(graph) ? graph.nodes.filter((n) => types.includes(n.type)).length : 0
  const named = (type: string) =>
    ok(graph)
      ? graph.nodes.filter((n) => n.type === type).map((n) => n.label)
      : []
  const checks = ok(quality) ? quality.run.check_statuses : {}
  const g = ok(graph)
  const steps: Step[] = [
    {
      id: 'sources',
      title: l('Public sources', 'Offentliga källor'),
      tool: named('source').slice(0, 4).join(', ') + (g ? ' …' : ''),
      what: l(
        'Open data from Swedish and EU agencies, taken as each publisher releases it.',
        'Öppna data från svenska och europeiska myndigheter, hämtade som varje utgivare släpper dem.',
      ),
      figures: [
        g && `${num(typed('source'))} ${l('publishers', 'utgivare')}`,
        status &&
          `${num(status.feeds)} ${l('source feeds with a fetch time', 'källflöden med hämtningstid')}`,
      ],
      count: 'sources',
      unit: [l('source', 'källa'), l('sources', 'källor')],
      link: ['#platform-pipeline', l('Pipeline', 'Pipeline')],
    },
    {
      id: 'ingestion',
      title: l('Ingestion', 'Inläsning'),
      tool: 'Python · GitHub Actions',
      what: l(
        'Scheduled jobs fetch each source and keep every raw file with its URL, fetch time and SHA-256, so a published number traces back to a file.',
        'Schemalagda jobb hämtar varje källa och sparar varje råfil med URL, hämtningstid och SHA-256, så att en publicerad siffra går att spåra till en fil.',
      ),
      figures: [
        g &&
          `${num(typed('ingestion'))} ${l('fetch scripts', 'hämtningsskript')}`,
        status &&
          l(
            `last run ${ago(status.last.recorded_at!)}; ${status.passed} of ${status.total} subjects passed their latest run`,
            `senaste körning ${ago(status.last.recorded_at!)}; ${status.passed} av ${status.total} ämnen gick igenom sin senaste körning`,
          ),
        status &&
          status.timed > 0 &&
          l(
            `${status.fresh} of ${status.timed} subjects with an update limit are within it`,
            `${status.fresh} av ${status.timed} ämnen med en uppdateringsgräns ligger inom den`,
          ),
      ],
      count: 'ingestion',
      unit: [
        l('fetch script', 'hämtningsskript'),
        l('fetch scripts', 'hämtningsskript'),
      ],
      link: ['#platform-health', l('Run health', 'Körhälsa')],
    },
    {
      id: 'dbt',
      title: l('Models', 'Modeller'),
      tool: 'dbt · DuckDB',
      what: l(
        'dbt builds the warehouse in three layers: bronze as fetched, silver cleaned and joined, gold ready for a page.',
        'dbt bygger lagret i tre lager: bronze som hämtat, silver rensat och sammanfogat, gold redo för en sida.',
      ),
      figures: [
        ok(summary) &&
          `${num(summary.models)} ${l('models in the dbt project', 'modeller i dbt-projektet')}`,
        g &&
          `bronze ${num(typed('bronze'))} · silver ${num(typed('silver'))} · gold ${num(typed('gold'))} ${l('in the lineage graph', 'i härkomstgrafen')}`,
      ],
      count: 'models',
      unit: [l('model', 'modell'), l('models', 'modeller')],
      link: ['#tech-er', l('Data model', 'Datamodell')],
    },
    {
      id: 'ml',
      title: l('Machine learning', 'Maskininlärning'),
      tool: named('ml').slice(0, 3).join(', '),
      what: l(
        'Where the data is text, embedding and clustering stages add features, which dbt then reads like any other source.',
        'Där datan är text lägger inbäddnings- och klustringssteg till egenskaper, som dbt sedan läser som vilken källa som helst.',
      ),
      figures: [g && `${num(typed('ml'))} ${l('ML stages', 'ML-steg')}`],
      count: 'ml',
      unit: [l('ML stage', 'ML-steg'), l('ML stages', 'ML-steg')],
      link: ['#tech-stages', l('Lineage', 'Härkomst')],
    },
    {
      id: 'tests',
      title: l('Contracts and tests', 'Kontrakt och tester'),
      tool: l('dbt tests · model contracts', 'dbt-tester · modellkontrakt'),
      what: l(
        'Contracts and tests gate the export: a run with a failing blocking check publishes nothing.',
        'Kontrakt och tester spärrar exporten: en körning med en blockerande kontroll som faller publicerar ingenting.',
      ),
      figures: [
        ok(summary) && `${num(summary.tests)} ${l('dbt tests', 'dbt-tester')}`,
        ok(quality) &&
          l(
            `${num(checks.pass ?? 0)} of ${num(quality.run.checks - (checks.not_applicable ?? 0))} applicable quality checks passed, ${day(quality.run.evaluated_at)} UTC (${ago(quality.run.evaluated_at)})`,
            `${num(checks.pass ?? 0)} av ${num(quality.run.checks - (checks.not_applicable ?? 0))} tillämpliga kvalitetskontroller godkända, ${day(quality.run.evaluated_at)} UTC (${ago(quality.run.evaluated_at)})`,
          ),
      ],
      count: 'models',
      unit: [
        l('tested model', 'testad modell'),
        l('tested models', 'testade modeller'),
      ],
      link: ['#tech-quality', l('Tests and quality', 'Tester och kvalitet')],
    },
    {
      id: 'publish',
      title: l('Publication', 'Publicering'),
      tool: l(
        'Cloudflare R2 · release manifests',
        'Cloudflare R2 · releasemanifest',
      ),
      what: l(
        'A passing run writes a versioned release to R2, and a manifest points the site at it; a failed run leaves the last good release in place.',
        'En godkänd körning skriver en versionerad release till R2, och ett manifest pekar sidan dit; en körning som faller lämnar den senaste goda releasen kvar.',
      ),
      figures: [
        g &&
          `${num(typed('delivery'))} ${l('published exports', 'publicerade exporter')}`,
        release &&
          `${l('release in use since', 'releasen används sedan')} ${day(release)} UTC (${ago(release)})`,
      ],
      count: 'delivery',
      unit: [l('export', 'export'), l('exports', 'exporter')],
      link: [
        `https://github.com/${REPO}/tree/main/docs/incidents`,
        l('Incidents', 'Incidenter'),
      ],
    },
    {
      id: 'site',
      title: l('This site', 'Den här sidan'),
      tool: 'React · Cloudflare Workers · Workers AI',
      what: l(
        'The pages read the release; a Worker serves the API, and Workers AI answers the questions in Ask the platform and Ask the law.',
        'Sidorna läser releasen; en Worker serverar API:t, och Workers AI svarar på frågorna i Fråga plattformen och Fråga lagen.',
      ),
      figures: [
        g &&
          `${num(typed('frontend'))} ${l('pages on the platform', 'sidor på plattformen')}`,
        ci &&
          l(
            `CI on main ${ci.conclusion === 'success' ? 'passed' : 'failed'} ${ago(ci.updated_at)}`,
            `CI på main ${ci.conclusion === 'success' ? 'gick igenom' : 'föll'} ${ago(ci.updated_at)}`,
          ),
      ],
      count: 'products',
      unit: [l('page', 'sida'), l('pages', 'sidor')],
      link: [`https://github.com/${REPO}`, l('Code', 'Kod')],
    },
  ]
  const name = project && l(project.title.en, project.title.sv)
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
          'From a public source to this site in seven steps. Choose a project to mark the steps its data passes through.',
          'Från en offentlig källa till den här sidan i sju steg. Välj ett projekt för att markera stegen dess data går igenom.',
        )}
      </p>
      {g && PROJECTS.length > 0 && (
        <div
          className="tech-pick"
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
      <ol className="hub-flow-steps">
        {steps.map((step, i) => {
          const n = counts?.[step.count] ?? 0
          const used = step.id === 'site' ? Boolean(counts) : n > 0
          return (
            <li key={step.id} data-used={used || undefined}>
              <span className="hub-flow-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="hub-flow-head">
                <h3>{step.title}</h3>
                {step.tool && <p className="hub-flow-tool">{step.tool}</p>}
              </div>
              <p className="hub-flow-what">{step.what}</p>
              <div className="hub-flow-data">
                {step.figures.filter(Boolean).map((f, k) => (
                  <p key={k}>{f}</p>
                ))}
                {name && (
                  <p className="hub-flow-project">
                    {used
                      ? `${name}: ${step.id === 'site' ? l('on this site', 'på den här sidan') : plural(n, step.unit)}`
                      : `${name}: ${l('not used', 'används inte')}`}
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
      {ok(graph) && (
        <p className="tech-meta">
          {l(
            `Counts: schema/summary.json, architecture/graph.json (built ${day(graph.generated_at)} UTC, ${ago(graph.generated_at)}), status/ingestion.json, quality/summary.json and GitHub Actions.`,
            `Siffror: schema/summary.json, architecture/graph.json (byggd ${day(graph.generated_at)} UTC, ${ago(graph.generated_at)}), status/ingestion.json, quality/summary.json och GitHub Actions.`,
          )}
        </p>
      )}
    </section>
  )
}
