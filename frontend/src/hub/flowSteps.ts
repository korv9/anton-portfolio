/**
 * The seven steps of the flow (PlatformFlow.tsx): for each, what it does, the tool, its figures
 * from the published files, the keys in a subject's counts that mean a project uses it, and the
 * link to its deeper section. Figures whose file cannot be read arrive as undefined and drop out.
 */
import type { ReactNode } from 'react'
import { l } from '../i18n'
import type { Graph } from '../tech/PipelineTables'
import { REPO, ago, day, num } from '../tech/techData'
import type { Run } from '../tech/WorkflowRuns'
import type { Summary } from './Headline'
import type { readStatus } from './platformStatus'

export type Quality = {
  run: {
    evaluated_at: string
    checks: number
    check_statuses: Record<string, number>
  }
}

export type Step = {
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

type Context = {
  g: boolean
  typed: (...types: string[]) => number
  graph?: Graph
  size?: Summary
  sizeAt?: string
  status: ReturnType<typeof readStatus>
  quality?: Quality
  checks: Record<string, number>
  measured: number
  layers: string
  release?: string
  ci?: Run
}

export function buildSteps({
  g,
  typed,
  graph,
  size,
  sizeAt,
  status,
  quality,
  checks,
  measured,
  layers,
  release,
  ci,
}: Context): Step[] {
  return [
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
        graph &&
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
        quality &&
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
}
