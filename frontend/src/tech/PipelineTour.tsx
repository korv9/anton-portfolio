/**
 * How the pipeline works, step by step: a rail of the seven stages with what each holds, read
 * from architecture/graph.json, and the chosen step explained under it. The rail is the
 * diagram; the arrows between its stops are the order a subject goes through.
 */
import { useState } from 'react'
import { l } from '../i18n'

export type TourNode = {
  id: string
  label: string
  layer: string
  type: string
  path?: string
  files?: number
}

const num = (n: number) => n.toLocaleString('en-GB')

type Step = {
  key: string
  name: () => string
  /** The graph layers this step counts. */
  layers: string[]
  unit: () => string
  text: () => string
  /** Optional steps are drawn dashed: not every subject passes through them. */
  optional?: boolean
}

const STEPS: Step[] = [
  {
    key: 'source',
    name: () => l('Sources', 'Källor'),
    layers: ['source'],
    unit: () => l('publishers', 'utgivare'),
    text: () =>
      l(
        'Open APIs and files from public publishers. Each has its own format and its own rhythm of updates, so each gets a fetch script of its own.',
        'Öppna API:er och filer från offentliga utgivare. Var och en har sitt eget format och sin egen takt för uppdateringar, så var och en får ett eget hämtningsskript.',
      ),
  },
  {
    key: 'ingestion',
    name: () => l('Fetch', 'Hämtning'),
    layers: ['ingestion'],
    unit: () => l('scripts', 'skript'),
    text: () =>
      l(
        'Python scripts fetch each source on a schedule in GitHub Actions: every day for public statistics, job ads and news, every week for the rest. A run fetches only what can have changed and logs every request, so a fetch that stops halfway is never taken for complete history.',
        'Python-skript hämtar varje källa på schema i GitHub Actions: varje dag för offentlig statistik, jobbannonser och nyheter, varje vecka för resten. En körning hämtar bara det som kan ha ändrats och loggar varje anrop, så en hämtning som avbryts halvvägs räknas aldrig som komplett historik.',
      ),
  },
  {
    key: 'raw',
    name: () => l('Raw store', 'Rålager'),
    layers: ['raw'],
    unit: () => l('raw tables and seeds', 'råtabeller och seeds'),
    text: () =>
      l(
        'What was fetched is kept as it came, in Cloudflare R2, with a log per source: when it was fetched, when its content last changed and its hash. Seeds are small reference tables kept as CSV in the repository.',
        'Det som hämtats sparas som det kom, i Cloudflare R2, med en logg per källa: när det hämtades, när innehållet senast ändrades och dess hash. Seeds är små referenstabeller som ligger som CSV i repot.',
      ),
  },
  {
    key: 'dbt',
    name: () => l('Build and test', 'Bygg och testa'),
    layers: ['bronze', 'silver', 'gold'],
    unit: () => l('dbt models', 'dbt-modeller'),
    text: () =>
      l(
        'dbt builds the raw files into tables in DuckDB, in three layers. Bronze reads the files as they are, silver cleans and joins them, and gold holds the facts and dimensions the pages ask about. Tests check keys, grain and relations; a subject whose tests fail is not exported.',
        'dbt bygger råfilerna till tabeller i DuckDB, i tre lager. Bronze läser filerna som de är, silver rensar och kopplar ihop dem, och gold håller de fakta och dimensioner som sidorna frågar efter. Tester kontrollerar nycklar, korn och relationer; ett ämne vars tester fallerar exporteras inte.',
      ),
  },
  {
    key: 'ml',
    name: () => l('Machine learning', 'Maskininlärning'),
    layers: ['ml'],
    unit: () => l('ML stages', 'ML-steg'),
    optional: true,
    text: () =>
      l(
        'Subjects made of text pass through an ML stage: sentence embeddings, UMAP for the map and HDBSCAN for the clusters. It runs when its stored output is missing, or on request when its inputs have changed, and its results go back into the warehouse.',
        'Ämnen som består av text går genom ett ML-steg: meningsinbäddningar, UMAP för kartan och HDBSCAN för klustren. Det körs när dess sparade resultat saknas, eller på begäran när indata har ändrats, och resultaten går tillbaka in i lagret.',
      ),
  },
  {
    key: 'delivery',
    name: () => l('Publish', 'Publicering'),
    layers: ['delivery'],
    unit: () => l('published files', 'publicerade filer'),
    text: () =>
      l(
        'Export scripts write the gold tables as JSON and Parquet. A subject is exported only after its fetch, build, tests and ML all came through, and a group of subjects is released to R2 only when every subject in it succeeded in the same run.',
        'Exportskript skriver gold-tabellerna som JSON och Parquet. Ett ämne exporteras först när hämtning, bygge, tester och ML har gått igenom, och en grupp ämnen släpps till R2 bara när alla ämnen i den lyckades i samma körning.',
      ),
  },
  {
    key: 'frontend',
    name: () => l('Pages', 'Sidor'),
    layers: ['frontend'],
    unit: () => l('products', 'produkter'),
    text: () =>
      l(
        'The site reads the published files in the browser, with no server in between. Each product below is one page built on them: choose one to see its charts.',
        'Webbplatsen läser de publicerade filerna i webbläsaren, utan någon server emellan. Varje produkt nedan är en sida byggd på dem: välj en för att se dess grafer.',
      ),
  },
]

export default function PipelineTour({ nodes }: { nodes: TourNode[] }) {
  const [at, setAt] = useState(0)
  const of = (step: Step) => nodes.filter((n) => step.layers.includes(n.layer))
  const count = (step: Step) =>
    step.key === 'delivery'
      ? of(step).reduce((s, n) => s + (n.files ?? 0), 0)
      : of(step).length
  const step = STEPS[at]
  const items = of(step)
  const layers = step.key === 'dbt' ? step.layers : []
  return (
    <div className="tour">
      <ol
        className="tour-rail"
        aria-label={l('Pipeline stages', 'Pipelinens steg')}
      >
        {STEPS.map((s, i) => (
          <li key={s.key} data-optional={s.optional || undefined}>
            <button
              type="button"
              aria-pressed={i === at}
              aria-controls="tour-step"
              onClick={() => setAt(i)}
            >
              <span className="tour-n">{String(i + 1).padStart(2, '0')}</span>
              <b>{s.name()}</b>
              <span className="tour-count">{num(count(s))}</span>
              <span className="tour-unit">{s.unit()}</span>
            </button>
          </li>
        ))}
      </ol>
      <section
        id="tour-step"
        className="tour-step"
        aria-live="polite"
        aria-labelledby="tour-step-title"
      >
        <h3 id="tour-step-title">
          {String(at + 1).padStart(2, '0')} {step.name()}
        </h3>
        <p>{step.text()}</p>
        {layers.length > 0 ? (
          <dl className="tour-layers">
            {layers.map((layer) => {
              const n = items.filter((i) => i.layer === layer).length
              return (
                <div
                  key={layer}
                  style={{ ['--share' as string]: n / items.length }}
                >
                  <dt>{layer}</dt>
                  <dd>{num(n)}</dd>
                </div>
              )
            })}
          </dl>
        ) : (
          <ul className="tour-items">
            {items.map((n) => (
              <li key={n.id}>
                {n.label}
                {step.key === 'delivery' && n.files ? (
                  <span> {num(n.files)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="tour-nav">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => setAt(at - 1)}
          >
            ← {l('Previous step', 'Föregående steg')}
          </button>
          <button
            type="button"
            disabled={at === STEPS.length - 1}
            onClick={() => setAt(at + 1)}
          >
            {l('Next step', 'Nästa steg')} →
          </button>
        </div>
      </section>
    </div>
  )
}
