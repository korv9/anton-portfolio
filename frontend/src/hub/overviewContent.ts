/**
 * The Overview's words (#projects, ProjectsHub.tsx), in one place. The platform case study
 * (docs/case-studies/platform.md) told as prose; numbers come from that case study and the
 * project catalogue.
 */
export type Bilingual = { sv: string; en: string }
const t = (sv: string, en: string): Bilingual => ({ sv, en })

export const LEDE: Bilingual[] = [
  t(
    'Alla projekt på den här sajten körs på en dataplattform som jag har byggt och driver själv. Python hämtar öppna data från svenska myndigheter och EU enligt schema och sparar varje råfil med källa, hämtningstid och kontrollsumma. dbt på DuckDB bygger datan i tre lager, tester stoppar en dålig körning innan något publiceras, och varje release går till Cloudflare R2 med ett leveranskontrakt som sajten läser från.',
    'Every project on this site runs on one data platform I built and operate myself. Python fetches public data from Swedish agencies and the EU on a schedule and keeps every raw file with its source, fetch time and checksum. dbt on DuckDB builds it in three layers, tests stop a bad run before anything is published, and each release goes to Cloudflare R2 with a delivery contract the site reads from.',
  ),
  t(
    'Maskininlärningen körs ovanpå det. Meningsinbäddningar, UMAP och HDBSCAN klustrar 33 000 inlägg ur riksdagens debatter, tretton filosofiska verk och 101 böcker med myter och folksagor; varje klustringskörning loggas och bedöms mot en grind som skrivits ner i förväg, och bara en vinnare som klarar grinden når en sida. Allegora svarar på frågor om svenska lagar och EU:s AI-förordning med retrieval-augmented generation: paragrafsökningen körs i webbläsaren på int8-inbäddningar, en Cloudflare Worker låter en modell svara med citat, och varje citat kontrolleras ord för ord mot lagtexten innan det visas. Mitt examensarbete använde samma recept på 16 811 riktiga IT-supportärenden i ett företags Databricks-miljö.',
    "The machine learning runs on top of that. Sentence embeddings, UMAP and HDBSCAN cluster 33,000 Riksdag debate passages, thirteen works of philosophy and 101 books of myth and folklore; every clustering run is logged and scored against a gate written down in advance, and only a champion that passes reaches a page. Allegora answers questions over Swedish statutes and the EU AI Act with retrieval-augmented generation: the paragraph search runs in the browser on int8 embeddings, a Cloudflare Worker has a model answer with quotes, and every quote is checked word for word against the legal text before it is shown. My degree project used the same recipe on 16,811 real IT support tickets inside a company's Databricks environment.",
  ),
]

export const NEEDS = {
  title: t('Vad den behövde klara', 'What it had to do'),
  intro: t(
    'Datan kommer i många format: REST-API:er, PX-Web-tabeller, XML-arkiv, PDF:er, RSS-flöden. Källorna ändras i olika takt, och några kan inte hämtas två gånger. Plattformen behövde därför:',
    'The data arrives in many formats: REST APIs, PX-Web tables, XML archives, PDFs, RSS feeds. Sources change on different schedules, and some cannot be fetched twice. So the platform had to:',
  ),
  items: [
    t(
      'spara varje råfil med URL, hämtningsdatum och SHA-256, så att varje publicerad siffra kan spåras till en källfil;',
      'keep every raw file with its URL, fetch date and SHA-256, so any published number can be traced to a source file;',
    ),
    t(
      'uppdatera dagligen och bygga om veckovis utan att någon sitter vid tangentbordet;',
      'refresh daily and rebuild weekly with nobody at the keyboard;',
    ),
    t(
      'fela högt när en källa byter form, i stället för att publicera ett felaktigt diagram;',
      'fail loudly when a source changes shape, instead of publishing a wrong chart;',
    ),
    t(
      'servera en statisk sajt snabbt, även filer som är för stora för Git;',
      'serve a static site fast, including files too large to commit to Git;',
    ),
    t(
      'inte kosta något att driva utöver domänen.',
      'cost nothing to run beyond the domain.',
    ),
  ],
}

export const BUILT = {
  title: t('Så är den byggd', 'How it is built'),
  flowTitle: t(
    'Från öppen källa till diagram',
    'From a public source to a chart',
  ),
  head: [t('Steg', 'Stage'), t('Vad det gör', 'What it does')],
  rows: [
    [
      t('Inläsning', 'Ingestion'),
      t(
        'Ett paket per källa. Varje råfil skrivs med en manifestrad: URL, hämtningstid, SHA-256.',
        'One package per source. Each raw file is written with a manifest line: URL, fetch time, SHA-256.',
      ),
    ],
    [
      t('Transformation', 'Transformation'),
      t(
        'dbt på DuckDB. Bronze typar råposterna, silver harmoniserar dem, gold håller de delade dimensionerna och de marts som sajten läser.',
        'dbt on DuckDB. Bronze types the raw records, silver conforms them, gold holds the shared dimensions and the marts the site reads.',
      ),
    ],
    [
      t('Kontroller', 'Checks'),
      t(
        'dbt-tester och tvingande modellkontrakt, JSON-scheman för levererade filer, och Python-validatorer som stämmer av levererade totaler mot lagret.',
        'dbt tests and enforced model contracts, JSON Schemas for delivered files, and Python validators that reconcile delivered totals against the warehouse.',
      ),
    ],
    [
      t('Leverans', 'Delivery'),
      t(
        'JSON för första renderingen följer med sajten. Parquet-marts och dokumentskärvor ligger i R2; varje publicering laddar upp en versionerad release, läser tillbaka varje fil och jämför byte för byte, och aktiverar den sist.',
        'JSON for first paint ships with the site. Parquet marts and document shards live in R2; each publish uploads a versioned release, reads every file back to compare bytes, and activates it last.',
      ),
    ],
    [
      t('Servering', 'Serving'),
      t(
        'En Cloudflare Worker serverar sajten, två Workers AI-ändpunkter och jobbassistentens ägarposter.',
        "A Cloudflare Worker serves the site, two Workers AI endpoints and the job assistant's owner records.",
      ),
    ],
    [
      t('Orkestrering', 'Orchestration'),
      t(
        'Ett register listar varje ämne med dess steg och schema och kör dem på samma sätt på en laptop och i GitHub Actions.',
        'One registry lists every subject with its stages and schedule and runs them the same way on a laptop and in GitHub Actions.',
      ),
    ],
  ],
}

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
    {
      term: t('Gratisplaner.', 'Free tiers.'),
      text: t(
        'Workern körs på Cloudflares gratisplan och de schemalagda jobben på GitHub Actions för ett publikt repo. Inget här har en månadskostnad utöver domänen.',
        "The Worker runs on Cloudflare's free plan and the scheduled jobs on GitHub Actions for a public repository. Nothing here has a monthly bill beyond the domain.",
      ),
    },
  ],
}

export const WRONG = {
  title: t('Vad som gick fel', 'What went wrong'),
  paragraphs: [
    t(
      'Hinkens r2.dev-adress begränsade den första CI-körningen som läste från den; sajten läser nu från sin egen datadomän.',
      "The bucket's r2.dev address rate-limited the first CI run that read from it; the site now reads from its own data domain.",
    ),
    t(
      'En kostnadsuppskattning för Workers AI blev fyra gånger för låg, eftersom en modells resonemangstokens saknades i den rapporterade förbrukningen; kontot slog i dagsgränsen innan loggen sa det.',
      "A Workers AI cost estimate came out four times too low, because one model's reasoning tokens were missing from the reported usage; the account hit its daily limit before the log said so.",
    ),
    t(
      'Några äldre byggare körs fortfarande som skript. Ett ämne flyttar till dbt först när dess utdata är byte för byte identisk med den levererade filen, och CI fortsätter kontrollera det efteråt.',
      'Some older builders still run as scripts. A subject moves to dbt only when its output is byte-identical to the delivered file, and CI keeps checking that afterwards.',
    ),
  ],
}

/** The text runs up to the repository link, which follows as the address itself. */
export const WORK = {
  title: t('Så jobbar jag', 'How I work'),
  text: t(
    'Repot bär sitt eget minne. PROJECTS.md säger vad varje projekt är till för och var det står, DECISIONS.md antecknar vad som beslutats och varför, och en idéjournal håller historiken per projekt. Jag utvecklar med AI-kodagenter, och de filerna är det som håller många parallella projekt sammanhängande: en agent läser dem först, ändrar PROJECTS.md bara när jag ber om det, och rapporterar när koden inte stämmer med texten. Repot är publikt:',
    'The repository carries its own memory. PROJECTS.md says what each project is for and where it stands, DECISIONS.md records what was decided and why, and an idea-lineage journal keeps the history per project. I develop with AI coding agents, and those files are what keeps many parallel projects coherent: an agent reads them first, changes PROJECTS.md only when I ask, and reports when the code disagrees with the text. The repository is public:',
  ),
  repo: 'https://github.com/korv9/anton-portfolio',
  repoLabel: 'github.com/korv9/anton-portfolio',
}

export const PROJECTS_TITLE = t('Projekt', 'Projects')
