/**
 * How the platform is built, as one flow from public source to this site: seven steps on a rail,
 * each with what it does, the tool, its counts from the published files and, where it has one,
 * its health. Choosing a project marks the steps its data passes through, from the per-subject
 * counts in architecture/graph.json. The list is the diagram's text: it reads in order without
 * the rail. A figure whose file cannot be read, or that has no date, is left out.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import type { Graph } from '../tech/PipelineTables'
import { REPO, ago, day, num, ok, useFile } from '../tech/techData'
import { loadWorkflows, type Run } from '../tech/WorkflowRuns'
import { useDbtSize, useStatus } from './Headline'
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
  /**
   * The keys in a subject's counts that mean its data passes this step: the step's own count
   * first, then the later stages its data can only have reached through it.
   */
  count: string[]
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
  const quality = useFile<Quality>('quality/summary.json')
  const status = useStatus()
  const ci = useCi()
  const { size, at: sizeAt, release } = useDbtSize()
  const [chosen, setChosen] = useState(PROJECTS[0]?.id)
  const project = PROJECTS.find((p) => p.id === chosen)
  const counts = ok(graph)
    ? graph.domains.find((d) => d.id === project?.domain)?.counts
    : undefined
  const typed = (...types: string[]) =>
    ok(graph) ? graph.nodes.filter((n) => types.includes(n.type)).length : 0
  const g = ok(graph)
  const checks = ok(quality) ? quality.run.check_statuses : {}
  const measured = ok(quality)
    ? quality.run.checks -
      (checks.not_applicable ?? 0) -
      (checks.not_measured ?? 0)
    : 0
  const layers = `bronze ${num(typed('bronze'))} · silver ${num(typed('silver'))} · gold ${num(typed('gold'))}`
  const steps: Step[] = [
    {
      id: 'sources',
      title: l('Public sources', 'Offentliga källor'),
      tool: l('Swedish and EU open data', 'Svensk och europeisk öppen data'),
      what: l(
        'Open data from agencies such as JobTech, Riksdagen and SCB, taken as each publisher releases it. A publisher offers one or more feeds, and each feed lands as source tables in dbt.',
        'Öppen data från myndigheter som JobTech, Riksdagen och SCB, hämtad som varje utgivare släpper den. En utgivare har ett eller flera flöden, och varje flöde blir källtabeller i dbt.',
      ),
      figures: [
        g && `${num(typed('source'))} ${l('publishers', 'utgivare')}`,
        status &&
          `${num(status.feeds)} ${l('feeds with a recorded fetch time', 'flöden med registrerad hämtningstid')}`,
      ],
      count: ['sources', 'ingestion', 'raw'],
      unit: [l('publisher', 'utgivare'), l('publishers', 'utgivare')],
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
          `${num(typed('ingestion'))} ${l('ingestion jobs', 'inläsningsjobb')}`,
        status &&
          l(
            `last ingestion run ${ago(status.last.recorded_at!)}; ${status.passed} of ${status.total} datasets passed their latest run`,
            `senaste inläsning för ${ago(status.last.recorded_at!)}; ${status.passed} av ${status.total} dataset gick igenom sin senaste körning`,
          ),
        status &&
          status.failed.length > 0 &&
          `${l('failed', 'föll')}: ${status.failed.join(', ')}`,
        status &&
          status.timed > 0 &&
          l(
            `${status.fresh} of ${status.timed} datasets with an update limit are within it`,
            `${status.fresh} av ${status.timed} dataset med en uppdateringsgräns ligger inom den`,
          ),
      ],
      count: ['ingestion', 'raw'],
      unit: [
        l('ingestion job', 'inläsningsjobb'),
        l('ingestion jobs', 'inläsningsjobb'),
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
        size &&
          `${num(size.models)} ${l('models in the dbt project', 'modeller i dbt-projektet')} (${ago(sizeAt!)})`,
        size &&
          `${num(size.sources)} ${l('dbt source tables read the fetched files', 'dbt-källtabeller läser de hämtade filerna')}`,
        ok(graph) &&
          l(
            `the lineage graph, built ${ago(graph.generated_at)}, places ${num(typed('bronze', 'silver', 'gold'))} of them in a subject: ${layers}`,
            `härkomstgrafen, byggd för ${ago(graph.generated_at)}, placerar ${num(typed('bronze', 'silver', 'gold'))} av dem i ett ämne: ${layers}`,
          ),
      ],
      count: ['models'],
      unit: [l('model', 'modell'), l('models', 'modeller')],
      link: ['#tech-er', l('Data model', 'Datamodell')],
    },
    {
      id: 'ml',
      title: l('Machine learning', 'Maskininlärning'),
      tool: 'bge-m3 · UMAP · HDBSCAN · k-means',
      what: l(
        'Where the data is text, embedding and clustering stages add features, which dbt then reads like any other source.',
        'Där datan är text lägger inbäddnings- och klustringssteg till egenskaper, som dbt sedan läser som vilken källa som helst.',
      ),
      figures: [g && `${num(typed('ml'))} ${l('ML stages', 'ML-steg')}`],
      count: ['ml'],
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
        size && `${num(size.tests)} ${l('dbt tests', 'dbt-tester')}`,
        ok(quality) &&
          l(
            `${num(checks.pass ?? 0)} of ${num(measured)} measured quality checks passed (${ago(quality.run.evaluated_at)}); ${num(checks.not_measured ?? 0)} not measured`,
            `${num(checks.pass ?? 0)} av ${num(measured)} mätta kvalitetskontroller godkända (för ${ago(quality.run.evaluated_at)}); ${num(checks.not_measured ?? 0)} ej mätta`,
          ),
      ],
      count: ['models'],
      unit: [l('model', 'modell'), l('models', 'modeller')],
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
      count: ['delivery'],
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
        g && `${num(typed('frontend'))} ${l('products', 'produkter')}`,
        ci &&
          l(
            `CI on main ${ci.conclusion === 'success' ? 'passed' : 'failed'} ${ago(ci.updated_at)}`,
            `CI på main ${ci.conclusion === 'success' ? 'gick igenom' : 'föll'} för ${ago(ci.updated_at)}`,
          ),
      ],
      count: ['products'],
      unit: [l('product', 'produkt'), l('products', 'produkter')],
      link: [`https://github.com/${REPO}`, l('Code', 'Kod')],
    },
  ]
  const name = project && counts && l(project.title.en, project.title.sv)
  const usedBy = (step: Step) =>
    counts ? step.count.some((key) => (counts[key] ?? 0) > 0) : false
  const used = steps.filter(usedBy).length
  const files = [
    size && 'schema/summary.json',
    g && 'architecture/graph.json',
    status && 'status/ingestion.json',
    ok(quality) && 'quality/summary.json',
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
          'From a public source to this site in seven steps. Choose a project to mark the steps its data passes through; point at or focus a step to trace what it is built from.',
          'Från en offentlig källa till den här sidan i sju steg. Välj ett projekt för att markera stegen dess data går igenom; peka på eller fokusera ett steg för att följa vad det bygger på.',
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
      <ol className="hub-flow-steps">
        {steps.map((step, i) => {
          const isUsed = usedBy(step)
          const own = counts?.[step.count[0]] ?? 0
          return (
            <li key={step.id} data-used={isUsed || undefined}>
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
