/**
 * The Overview's words (#projects, ProjectsHub.tsx), in one place. The platform case study
 * (docs/case-studies/platform.md) told as prose; numbers come from that case study and the
 * project catalogue.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

export const LEDE: Bilingual[] = [
  t(
    'Allt här körs live på riktig öppen data: riksdagens debatter, jobbannonser från Arbetsförmedlingen, statistik från svenska myndigheter och EU:s egna lagtexter. En del sidor är färdiga produkter, som Arbetsförmedla och Allegora. Andra är labb, mindre studier där jag prövar en metod på samma data.',
    "Everything here runs live on real public data: Riksdag debates, job ads from Arbetsförmedlingen, statistics from Swedish agencies and the EU's own legal texts. Some pages are finished products, like Arbetsförmedla and Allegora. Others are labs, smaller studies where I try out a method on the same data.",
  ),
  t(
    'Plattformen under dem har jag byggt själv, och jag driver den också. Den hämtar datan enligt schema, bygger den med dbt, testar den och publicerar den till sajten. Resten av sidan visar hur.',
    'I built the platform underneath them myself, and I run it too. It fetches the data on a schedule, builds it with dbt, tests it and publishes it to the site. The rest of this page shows how.',
  ),
]

export const FLOW_TITLE = t(
  'Från öppen källa till diagram',
  'From a public source to a chart',
)

export const DECISIONS = {
  title: t('Beslut', 'Decisions'),
  items: [
    {
      term: t('DuckDB med dbt.', 'DuckDB with dbt.'),
      text: t(
        'Lagret är en enda fil, så det körs på en laptop och i en GitHub-runner, och det kan kopieras till R2 och hämtas tillbaka. dbt ger tester, härkomst och dokumentation för SQL som annars skulle ligga utspridd i skript. Priset: DuckDB har en skrivare i taget, så parallella jobb köar på ett delat lås.',
        'The warehouse is one file, so it runs on a laptop and in a GitHub runner, and it can be copied to R2 and pulled back. dbt gives tests, lineage and documentation for SQL that would otherwise be scattered in scripts. The cost: DuckDB is single-writer, so parallel jobs queue on a shared lock.',
      ),
    },
    {
      term: t('Tre lager.', 'Three layers.'),
      text: t(
        'Bronze är filer på disk, aldrig redigerade. Silver och gold är scheman i DuckDB-filen, så de kan frågas och testas. Delade dimensioner för datum, kommuner och partier ligger på ett ställe, så varje ämne kopplar till samma.',
        'Bronze is files on disk, never edited. Silver and gold are schemas in the DuckDB file, so they can be queried and tested. Shared dimensions for dates, municipalities and parties live in one place, so every subject joins to the same ones.',
      ),
    },
    {
      term: t('Kontrakt före publicering.', 'Contracts before publishing.'),
      text: t(
        'En gold-modell med tvingande kontrakt fäller bygget om en kolumn eller typ ändras. Levererade filer kontrolleras mot JSON-scheman, och vissa ämnen stäms av mot en publicerad totalsumma: alla 1 436 ledamotstotaler i voteringarna räknas om från beslutsskärvorna. Inget värde hittas på; en rad som fyller en lucka anger hur den fylldes och från vilken källa.',
        'A gold model with an enforced contract fails the build if a column or type changes. Delivered files are checked against JSON Schemas, and some subjects are reconciled against a published total: all 1,436 roll-call member totals are recomputed from the decision shards. No value is invented; a row that fills a gap records how it was filled and from which source.',
      ),
    },
    {
      term: t('R2 för leverans.', 'R2 for delivery.'),
      text: t(
        'Att committa varje levererad fil gjorde sajtbygget 655 MB. Att flytta 3 470 dokumentskärvor till R2 tog ner det till 157 MB. Releaser är versionerade; ett veckojobb behåller den aktiva releasen och två att rulla tillbaka till.',
        'Committing every delivered file made the site build 655 MB. Moving 3,470 document shards to R2 cut it to 157 MB. Releases are versioned; a weekly job keeps the active release and two rollback targets.',
      ),
    },
  ],
}

/** The tools the platform uses, each where it is used in this repository. */
export const STACK: { group: Bilingual; items: string[] }[] = [
  { group: t('Data', 'Data'), items: ['Python', 'dbt', 'DuckDB', 'Parquet'] },
  {
    group: t('Orkestrering', 'Orchestration'),
    items: ['GitHub Actions', 'Apache Airflow'],
  },
  {
    group: t('Maskininlärning', 'Machine learning'),
    items: ['sentence-transformers', 'UMAP', 'HDBSCAN'],
  },
  {
    group: t('Språkmodeller', 'Language models'),
    items: ['Claude', 'Gemini on Vertex AI', 'Workers AI'],
  },
  {
    group: t('Moln', 'Cloud'),
    items: [
      'Cloudflare Workers',
      'Cloudflare R2',
      'Google Cloud Run',
      'Terraform',
    ],
  },
  {
    group: t('Webb', 'Web'),
    items: ['React', 'TypeScript', 'Vite', 'three.js'],
  },
]
