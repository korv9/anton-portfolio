/**
 * The shared closing of every project page, from the "One page per project" sketches: the
 * question, what was built, what it shows, how it works, its limits. Keyed by the page's path.
 */
import type { Bilingual } from './projectRegistry'

export type Brief = {
  question: Bilingual
  /** Three to five pieces of work, each a short title and one sentence. */
  built: { title: Bilingual; text: Bilingual }[]
  /** Two or three findings, each a figure read from the page's own data and one sentence. */
  shows: { value: string; text: Bilingual }[]
  /** Three to five steps, from source to page. */
  how: { step: Bilingual; text: Bilingual }[]
  tech: string[]
  limits: Bilingual
  code?: string
}

const t = (sv: string, en: string): Bilingual => ({ sv, en })

export const BRIEFS: Record<string, Brief> = {
  '#jobs': {
    question: t(
      'Vilka av dagens Data/IT-annonser passar det som mitt cv faktiskt visar, och varför? Varje bedömning visar annonsens mening och cv-raden bakom den, aldrig en procentsats eller en chans att bli anställd.',
      'Which of today’s Data/IT ads fit what my CV actually shows, and why? Every judgement shows the ad sentence and the CV line behind it, never a percentage or a chance of being hired.',
    ),
    built: [
      {
        title: t('Annonsinläsning', 'Ad ingestion'),
        text: t(
          'JobSearch fyller på de senaste 60 dagarna, sedan läser JobStream nya, ändrade och borttagna Data/IT-annonser flera gånger om dagen. En borttagen annons finns kvar, markerad som stängd.',
          'JobSearch backfills the last 60 days, then JobStream brings new, changed and removed Data/IT ads several times a day. A removed ad stays, marked closed.',
        ),
      },
      {
        title: t('Graderad cv-profil', 'Graded CV profile'),
        text: t(
          'Varje kompetens behåller sin cv-rad och en av tre nivåer: använd i arbete, i utbildning eller projekt, eller bara listad. Önskemål räknas aldrig som erfarenhet.',
          'Every skill keeps its CV line and one of three levels: used in work, in education or a project, or only listed. Wishes never count as experience.',
        ),
      },
      {
        title: t('Regler först', 'Rules first'),
        text: t(
          'Fyra klasser (stark, möjlig, utmaning, utanför) utifrån roll, kompetenser, senioritet och ort. Kompetenser som bara finns i projekt gör aldrig en annons stark; bge-m3 sorterar bara inom en klass.',
          'Four classes (strong, possible, stretch, outside) from role, skills, seniority and place. Skills shown only in projects never make an ad strong; bge-m3 only orders ads within a class.',
        ),
      },
      {
        title: t('Kontrollerade förklaringar', 'Checked explanations'),
        text: t(
          'En språkmodell kan skriva en kort förklaring inom en liten daglig budget. Den visas bara om varje citat finns i annonsen eller cv:t.',
          'A language model may write a short explanation within a small daily budget. It is shown only if every quote is found in the ad or the CV.',
        ),
      },
    ],
    shows: [
      {
        value: '5 086 595',
        text: t(
          'Annonser i marknadsunderlaget: JobTechs historiska arkiv sedan 2020 plus strömmen.',
          'Ads in the market base: JobTech’s historical archives since 2020 plus the stream.',
        ),
      },
      {
        value: '3 045',
        text: t(
          'Nya Data/IT-annonser i september 2026, mot 3 336 i september 2025 och 5 932 i september 2022. Toppmånaden var maj 2023 med 7 386.',
          'New Data/IT ads in September 2026, against 3,336 in September 2025 and 5,932 in September 2022. The peak month was May 2023, with 7,386.',
        ),
      },
      {
        value: '651 → 187',
        text: t(
          'Juniora annonser för mjukvaruutvecklare 2022 och 2025, en minskning med 71,3 %. Alla annonser för mjukvaruutvecklare föll 52,6 %.',
          'Junior Software Developer ads in 2022 and 2025, down 71.3%. All Software Developer ads fell 52.6%.',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          'JobTech JobStream flera gånger om dagen, med annons-id och innehållshash.',
          'JobTech JobStream several times a day, keyed by ad id and content hash.',
        ),
      },
      {
        step: t('Lagra', 'Store'),
        text: t(
          'Annonser, matchningar och körlogg med proveniens i Cloudflare R2.',
          'Ads, matches and a run log with provenance in Cloudflare R2.',
        ),
      },
      {
        step: t('Matcha', 'Match'),
        text: t(
          'Regler, bge-m3-vektorer och kontrollerade Gemma-förklaringar.',
          'Rules, bge-m3 vectors and checked Gemma explanations.',
        ),
      },
      {
        step: t('Modellera', 'Model'),
        text: t(
          'dbt i bronze, silver och gold; export bara när alla tester gått igenom.',
          'dbt in bronze, silver and gold; export only when every test has passed.',
        ),
      },
      {
        step: t('Sida', 'Page'),
        text: t(
          'Filter i webbläsaren; mina egna statusar sparas via en Worker och D1.',
          'Filters in the browser; my own statuses are saved through a Worker and D1.',
        ),
      },
    ],
    tech: [
      'Python',
      'JobTech API',
      'DuckDB',
      'dbt',
      'Cloudflare Workers AI (bge-m3, Gemma)',
      'Cloudflare Worker + D1',
      'Cloudflare R2',
      'GitHub Actions',
      'React + TypeScript',
    ],
    limits: t(
      'GitHubs schemalagda körningar startar sent, och profilen har periodvis inte gått att läsa därifrån, så matchningen mot cv:t står still och sidan kan visa de senast sparade matchningarna. Om reglerna stämmer mäts med mina egna märkningar, och de siffrorna gäller bara det här jobbsöket.',
      'GitHub’s scheduled runs start late, and at times they could not reach the profile, so matching against the CV is paused and the page may show the last kept matches. Whether the rules are right is measured by my own labels, and those numbers describe this search only.',
    ),
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/job-assistant.md',
  },

  '#replik': {
    question: t(
      'Vad talar Sveriges partier om när de möts, vem sätter dagordningen, och vilka röstar ihop? Och betyder att tala lika att rösta lika?',
      'What do Sweden’s parties talk about when they face each other, who sets the agenda, and who votes together? And does talking alike mean voting alike?',
    ),
    built: [
      {
        title: t('Debattinlägg', 'Debate passages'),
        text: t(
          '108 partiledardebatter 1993–2026 delade i 33 023 inlägg med hela meningar, inbäddade med en svensk sentence-BERT och centrerade per talare.',
          '108 party-leader debates 1993–2026 cut into 33,023 passages of whole sentences, embedded with a Swedish sentence-BERT and centred per speaker.',
        ),
      },
      {
        title: t('Ämnesmodell', 'Topic model'),
        text: t(
          'En konsensus av 12 UMAP- och HDBSCAN-frön ger 33 ämnen, med 90 %-intervall per parti och årtionde från omdragna anföranden.',
          'A consensus of 12 UMAP and HDBSCAN seeds gives 33 topics, with a 90% range per party and decade from resampled speeches.',
        ),
      },
      {
        title: t('Voteringar', 'Roll calls'),
        text: t(
          '23 024 voteringar över 33 riksmöten, där partiets majoritet jämförs med regeringens.',
          '23,024 roll calls over 33 sessions, each party’s majority set against the government’s.',
        ),
      },
      {
        title: t('Särskiljbarhet', 'Separability'),
        text: t(
          'En TF-IDF-klassificerare med maskerade partinamn och uppdelning per talare, prövad mot en permutationsnolla i varje riksmöte.',
          'A TF-IDF classifier with party names masked and a split by speaker, tested against a permutation null in every session.',
        ),
      },
    ],
    shows: [
      {
        value: '0.66 → 0.73',
        text: t(
          'Hur väl språket skiljer partier åt i samma debatt (AUC): 0,66 i snitt under S-regeringen 1994/95–2005/06, 0,73 under alliansregeringen 2006/07–2013/14. 0,5 är slump.',
          'How well speech tells parties apart in the same debate (AUC): 0.66 on average under the Social Democratic government of 1994/95–2005/06, 0.73 under the Alliance government of 2006/07–2013/14. 0.5 is chance.',
        ),
      },
      {
        value: '6',
        text: t(
          'Epoker när de 33 riksmötena grupperas efter vad partiledarna talar om, med brott 1998, 2005, 2010, 2018 och 2021 (blandad ordning, p = 0,001).',
          'Eras when the 33 sessions are grouped by what party leaders talk about, with breaks at 1998, 2005, 2010, 2018 and 2021 (shuffled order, p = 0.001).',
        ),
      },
      {
        value: 'r = −0.04',
        text: t(
          'Att tala lika är inte att rösta lika: över 33 riksmöten säger likheten i debattämnen ingenting om hur ofta två partier röstar lika (Mantels r, p = 0,81).',
          'Talking alike is not voting alike: across 33 sessions, how similar two parties’ topics are says nothing about how often they vote together (Mantel r, p = 0.81).',
        ),
      },
    ],
    how: [
      {
        step: t('Källa', 'Source'),
        text: t(
          'Riksdagens öppna data: protokoll, anföranden och voteringar.',
          'Riksdagen open data: protocols, speeches and votes.',
        ),
      },
      {
        step: t('Rensa', 'Clean'),
        text: t(
          'Tilltal till talmannen, applådnoteringar och instämmandelistor tas bort; inlägg på 80–150 ord.',
          'Addresses to the Speaker, applause notes and endorsement lists removed; passages of 80–150 words.',
        ),
      },
      {
        step: t('Klustra', 'Cluster'),
        text: t(
          'Inbäddning, UMAP och HDBSCAN över 12 frön; namnförslag från en språkmodell.',
          'Embedding, UMAP and HDBSCAN over 12 seeds; names proposed by a language model.',
        ),
      },
      {
        step: t('Räkna', 'Count'),
        text: t(
          'Ämnesandelar per parti och år med omdragning, röstsamstämmighet per votering.',
          'Topic shares per party and year with resampling, agreement per roll call.',
        ),
      },
      {
        step: t('Sida', 'Page'),
        text: t(
          'Sidan läser de publicerade aggregaten och räknar om varje mening när den laddas.',
          'The page reads the published aggregates and recomputes each finding when it loads.',
        ),
      },
    ],
    tech: [
      'Python',
      'dbt',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'scikit-learn',
      'React',
    ],
    limits: t(
      'Ämnen är andelar av vad som sägs, inte ståndpunkter, och namnen skrevs av en språkmodell utan granskning för hand. Särskiljbarhet är inte polarisering: att sitta i regeringen ändrar hur ett parti talar, och ledarnas namn kan läcka. Epokerna är en lös gruppering (ARI 0,63 vid omskattning) på den äldre ämnesmodellen.',
      'Topics are shares of what is said, not stances, and their names were written by a language model, not checked by hand. Separability is not polarization: being in government changes how a party talks, and leaders’ names may leak. The eras are a loose grouping (ARI 0.63 on refitting) built on the older topic model.',
    ),
  },

  '#lag-ankomst': {
    question: t(
      'Hur snabbt når en EU-lag svenskt arbetsliv och riksdagen? AI-förordningens egna ord räknas i platsannonser och anföranden och prövas mot slumpade datum.',
      'How fast does an EU law reach Swedish working life and the Riksdag? The AI Act’s own words are counted in job ads and speeches and tested against random dates.',
    ),
    built: [
      {
        title: t('Begreppslista', 'Term list'),
        text: t(
          'Förordningens begrepp valda med viktade log-odds mot svensk författningssamling och granskade för hand; varje bortvald term sparas med sitt skäl.',
          'The Act’s terms chosen by weighted log-odds against the Swedish statute book and reviewed by hand; every dropped term keeps its reason.',
        ),
      },
      {
        title: t('Ordräkning', 'Dictionary counts'),
        text: t(
          '5 055 437 platsannonser (2020–2026) och 129 110 riksdagsanföranden matchade månad för månad.',
          '5,055,437 job ads (2020–2026) and 129,110 Riksdag speeches matched month by month.',
        ),
      },
      {
        title: t('Placebotest', 'Placebo test'),
        text: t(
          '266 förregistrerade fördröjningar, var och en mot 200 slumpade datum, med den ursprungliga och den ändrade begreppslistan sida vid sida.',
          '266 pre-registered lags, each against 200 random dates, with the original and the amended term list side by side.',
        ),
      },
      {
        title: t('Artikeljämförelse', 'Article comparison'),
        text: t(
          'Texten i EUT jämförd artikel för artikel med den konsoliderade texten från EUR-Lex.',
          'The Official Journal text compared article by article with the consolidated text from EUR-Lex.',
        ),
      },
    ],
    shows: [
      {
        value: '95',
        text: t(
          'Annonser som nämnde förordningen vid namn 2025, medan andelen annonser som nämner AI steg från 0,77 % 2020 till 3,07 % under årets första nio månader 2026. I riksdagen nämner 26 anföranden den totalt.',
          'Ads naming the Act in 2025, while the share of ads mentioning AI rose from 0.77% in 2020 to 3.07% in the first nine months of 2026. In the Riksdag, 26 speeches name it in all.',
        ),
      },
      {
        value: '39 / 266',
        text: t(
          'Fördröjningar som når p ≤ 0,05. 160 tar aldrig något skutt i datan och 67 är inte kortare än vid slumpade datum.',
          'Lags that reach p ≤ 0.05. 160 never jump in the data, and 67 are no shorter than at random dates.',
        ),
      },
      {
        value: '42 / 119',
        text: t(
          'Artiklar i förordningen som redan är nya eller ändrade sedan 2024, innan det mesta av den gäller.',
          'Articles of the Act already new or amended since 2024, before most of it applies.',
        ),
      },
    ],
    how: [
      {
        step: t('Begrepp', 'Terms'),
        text: t(
          'Log-odds mot SFS, granskade för hand, precision kontrollerad på upp till 50 träffar.',
          'Log-odds against SFS, reviewed by hand, precision checked on up to 50 matches.',
        ),
      },
      {
        step: t('Räkna', 'Count'),
        text: t(
          'Månadsandelar i annonser och anföranden; ofullständiga månader räknas inte.',
          'Monthly shares in ads and speeches; partial months are left out.',
        ),
      },
      {
        step: t('Framme', 'Arrival'),
        text: t(
          'Första månaden då tremånadersandelen ligger över 95:e percentilen av minst 12 tidigare månader.',
          'The first month whose three-month share is above the 95th percentile of at least 12 earlier months.',
        ),
      },
      {
        step: t('Pröva', 'Test'),
        text: t(
          '200 slumpade månader per fördröjning, redovisade utan sammanslagning.',
          '200 random months per lag, reported without pooling.',
        ),
      },
    ],
    tech: ['Python', 'dbt', 'DuckDB', 'placebo test', 'React'],
    limits: t(
      'Tidpunkt är inte orsak: AI-språket ökar också av skäl som inte har med lagen att göra. Ett fast ordförråd missar texter som handlar om förordningen utan att nämna den, och en fördröjning som vilar på fem träffar eller färre säger ingenting.',
      'Timing is not cause: AI talk also rises for reasons that have nothing to do with the law. A fixed dictionary misses texts that discuss the Act without naming it, and a lag resting on five matches or fewer says nothing.',
    ),
  },

  '#sweden': {
    question: t(
      'Vad mäter vi, vad värdesätter vi och vad förbiser vi? SWEDEN frågar vad den officiella statistiken lämnar utanför, med platsannonser, riksdagsanföranden, biblioteksstatistik och kommundata.',
      'What do we measure, what do we value, and what do we overlook? SWEDEN asks what official statistics leave out, using job ads, Riksdag speeches, library records and municipal statistics.',
    ),
    built: [
      {
        title: t('Sex forskningsfrågor', 'Six research questions'),
        text: t(
          'Mätandet, den ideala arbetstagaren, det osynliga Sverige, platser att höra till, framtiderna och välfärden, plus ett förregistrerat test av sambanden, var och en med egen sida och metodnoter.',
          'Measurement, the ideal worker, the invisible Sweden, places to belong, futures and welfare, plus a pre-registered test of how they connect, each with its own page and method notes.',
        ),
      },
      {
        title: t('Stora textmängder', 'Large text counts'),
        text: t(
          '8,7 miljoner unika annonstexter (2006–2026) och 429 114 riksdagsanföranden räknade med versionerade ordlistor; ett oförändrat arkiv räknas inte om.',
          '8.7 million distinct job-ad texts (2006–2026) and 429,114 Riksdag speeches counted with versioned dictionaries; an unchanged archive is not counted again.',
        ),
      },
      {
        title: t('Statistikkatalogen', 'The statistics catalogue'),
        text: t(
          '10 126 SCB-tabeller och Kolada-nyckeltal klassade efter område.',
          '10,126 SCB tables and Kolada key figures classified by domain.',
        ),
      },
      {
        title: t('Förregistrerade test', 'Pre-registered tests'),
        text: t(
          'Samband skrivs ned innan de räknas, med Holm-justerade p-värden och bootstrap per län; samband som inte klarar kontrollerna publiceras med skälet.',
          'Joins are written down before they are computed, with Holm-adjusted p-values and county-cluster bootstrap intervals; joins that fail the checks are published with the reason.',
        ),
      },
    ],
    shows: [
      {
        value: '208 / 280',
        text: t(
          'Kommuner vars mest lika kommun ligger i ett annat län: i median 180 km bort, mot 22 km till närmaste granne på kartan.',
          'Municipalities whose most similar municipality lies in another county: a median 180 km away, against 22 km to the nearest neighbour on the map.',
        ),
      },
      {
        value: '−19 %',
        text: t(
          'Fysiska biblioteksbesök föll från 50,0 till 40,4 miljoner mellan 2019 och 2025 i de 216 kommuner som rapporterat varje år.',
          'Physical library visits fell from 50.0 to 40.4 million between 2019 and 2025 in the 216 municipalities that reported every year.',
        ),
      },
      {
        value: '−84 %',
        text: t(
          'Bland framtidsinriktade riksdagsanföranden föll temat ”alternativa ekonomiska och sociala ordningar” från 2,9 % (1994–98) till 0,5 % (2021–25).',
          'Among future-oriented Riksdag speeches, the theme “alternative economic and social arrangements” fell from 2.9% (1994–98) to 0.5% (2021–25).',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          'SCB, Kolada, KB:s biblioteksstatistik, JobTechs arkiv, riksdagens anföranden och DiVA.',
          'SCB, Kolada, KB library statistics, JobTech archives, Riksdag speeches and DiVA.',
        ),
      },
      {
        step: t('Hoppa över', 'Skip unchanged'),
        text: t(
          'Varje arkiv hashas; ett oförändrat arkiv räknas inte igen.',
          'Each archive is hashed; an unchanged archive is not counted again.',
        ),
      },
      {
        step: t('Modellera', 'Model'),
        text: t(
          'dbt på DuckDB, från bronze-staging till gold-marts.',
          'dbt on DuckDB, from bronze staging to gold marts.',
        ),
      },
      {
        step: t('Analysera', 'Analyse'),
        text: t(
          'Python: ordlistor, standardisering, PCA och K-means, bootstrap- och permutationstest.',
          'Python: dictionaries, standardisation, PCA and K-means, bootstrap and permutation tests.',
        ),
      },
      {
        step: t('Visa', 'Render'),
        text: t(
          'Sidorna räknar fram varje fyndmening ur den publicerade JSON-filen när de laddas.',
          'The pages compute each finding sentence from the published JSON when they load.',
        ),
      },
    ],
    tech: [
      'Python',
      'dbt',
      'DuckDB',
      'GitHub Actions',
      'sentence-transformers',
      'scikit-learn',
      'React',
      'TypeScript',
      'Vite',
      'Cloudflare R2',
    ],
    limits: t(
      'Mätandets sida räknar katalogposter, inte datakvalitet eller hur måtten används. Kommungrupperna beskriver kommuner, inte invånare, och klarar inte den förregistrerade stabilitetskontrollen, så de är bara en beskrivande sammanfattning. Inkomstgradienten i sambandstestet valdes när datan redan fanns, och sidan säger det.',
      'The measurement page counts catalogue entries, not data quality or how measures are used. The municipal groups profile municipalities, not residents, and fail the pre-registered stability check, so they are a descriptive summary only. The income gradient in the connections test was chosen after the data were available, and the page says so.',
    ),
  },

  '#what-does-it-even-mean': {
    question: t(
      'Vad kan plattformens publicerade data faktiskt visa, och kan en läsare se var varje diagrams siffror kommer ifrån? Flödet är medvetet utan löptext: rubriker, en rad per ämne, diagram och en spårpanel.',
      'What can the platform’s published data actually show, and can a reader check where any chart’s numbers come from? The feed is deliberately prose-free: titles, one line per subject, charts and a trace panel.',
    ),
    built: [
      {
        title: t('Diagramflöde', 'Chart feed'),
        text: t(
          'Diagrammen ordnas i nio ämnen, från politik och jobb till symboler och plattformen, och varvas så att grannar kommer från olika filer.',
          'Charts grouped into nine subjects, from politics and jobs to symbols and the platform, interleaved so neighbours come from different files.',
        ),
      },
      {
        title: t('Urval efter granskning', 'Curated by review'),
        text: t(
          'En strykningslista tar bort diagram som föll i visuell granskning eller datagranskning, vart och ett med sitt skäl.',
          'A drop list removes charts cut after visual or data review, each with its reason.',
        ),
      },
      {
        title: t('Spårpanel', 'Trace panel'),
        text: t(
          'Ett öppnat diagram visar sina filer, utgivare, dbt-modellerna bakom med antal tester, råkällor och kvalitetskontroller; det som saknas sägs saknas.',
          'An opened chart lists its files, publisher, the dbt models behind them with test counts, raw sources and quality checks; anything unrecorded is said to be so.',
        ),
      },
      {
        title: t('Färskhet per ämne', 'Freshness per subject'),
        text: t(
          'Varje ämne jämförs med sin pipelines SLA utifrån den senaste körstatusen.',
          'Each subject is checked against its pipeline SLA from the latest run status.',
        ),
      },
    ],
    shows: [
      {
        value: '11 → 148',
        text: t(
          'Riksdagsanföranden som nämner AI: 11 av 12 651 år 2017 (0,09 %) och 148 av 13 286 år 2025 (1,11 %).',
          'Riksdag speeches mentioning AI: 11 of 12,651 in 2017 (0.09%) and 148 of 13,286 in 2025 (1.11%).',
        ),
      },
      {
        value: '0.63',
        text: t(
          'Riksdagens AI-stycken ligger i snitt på cosinus 0,63 mot närmaste stycke i AI-förordningen, mot 0,32 för slumpade par (95:e percentil 0,58).',
          'The Riksdag’s AI paragraphs sit at 0.63 cosine on average from their closest AI Act passage, against 0.32 for random pairs (95th percentile 0.58).',
        ),
      },
      {
        value: '81',
        text: t(
          'Datasökvägar som härkomstfilen knyter till 22 leveranser.',
          'Data paths the provenance file ties to 22 deliveries.',
        ),
      },
    ],
    how: [
      {
        step: t('Källor', 'Sources'),
        text: t(
          'Riksdagen, SCB, JobTech, EUR-Lex med flera, inlästa av plattformens ämnen.',
          'Riksdagen, SCB, JobTech, EUR-Lex and others, ingested by the platform’s subjects.',
        ),
      },
      {
        step: t('Modellera', 'Model'),
        text: t('Testade dbt-marts per ämne.', 'Tested dbt marts per subject.'),
      },
      {
        step: t('Exportera', 'Export'),
        text: t('En JSON-fil per diagram.', 'One JSON file per chart.'),
      },
      {
        step: t('Härkomst', 'Provenance'),
        text: t(
          'En härkomstbyggare registrerar filer, modeller och källor bakom varje diagram.',
          'A provenance builder records the files, models and sources behind each chart.',
        ),
      },
      {
        step: t('Flöde', 'Feed'),
        text: t(
          'Vite samlar varje inläggsfil, strykningslistan filtrerar och ämnena varvas.',
          'Vite globs every post file, the drop list filters and the subjects interleave.',
        ),
      },
    ],
    tech: [
      'React + TypeScript + Vite',
      'dbt',
      'DuckDB',
      'Python NLP',
      'paraphrase-multilingual-MiniLM-L12-v2',
      'GitHub Actions',
      'Cloudflare R2',
    ],
    limits: t(
      'Flödet visar vad datan bär, inte slutsatser. AI-omnämnanden är en ordräkning som missar diskussion utan de namngivna orden, och diagram på arbetsgivarnivå har medvetet dragits tillbaka.',
      'The feed shows what the data supports, not conclusions. AI mentions are a dictionary count that misses discussion without the named terms, and employer-level job charts were withdrawn on purpose.',
    ),
    code: 'https://github.com/korv9/anton-portfolio',
  },

  '#fraga-lagen': {
    question: t(
      'Kan en språkmodell svara på frågor om lagtext utan att hitta på citat, på en gratisplan, och sedan berätta svaret som en fabel med sensmoral? Ett påhittat lagcitat är värre än inget svar.',
      'Can a language model answer questions on legal text without inventing quotes, on a free plan, and then retell the answer as a fable with a moral? A made-up legal quote is worse than no answer.',
    ),
    built: [
      {
        title: t('Lagkorpusar', 'Legal corpora'),
        text: t(
          '9 970 paragrafer ur 40 utvalda svenska lagar via riksdagens API, och AI-förordningens 1 413 stycken på svenska och engelska från EUR-Lex.',
          '9,970 paragraphs from 40 selected Swedish statutes via the Riksdag API, and the AI Act’s 1,413 paragraphs in Swedish and English from EUR-Lex.',
        ),
      },
      {
        title: t('Sökning i webbläsaren', 'Search in the browser'),
        text: t(
          'bge-m3-vektorer byggda offline, komprimerade från 1 024 till 256 dimensioner med PCA och int8 och sökta i webbläsaren, utan vektordatabas.',
          'bge-m3 vectors built offline, compressed from 1,024 to 256 dimensions with PCA and int8, and searched in the browser with no vector database.',
        ),
      },
      {
        title: t('Kontrollerande Worker', 'Checking Worker'),
        text: t(
          'Workern bäddar in frågan, tar bara emot publicerad lagtext och håller inne varje svar vars citat inte finns ord för ord i sin paragraf.',
          'The Worker embeds the question, accepts only published legal text, and withholds any answer whose quotes are not found word for word in their paragraph.',
        ),
      },
      {
        title: t('Allegorin', 'The allegory'),
        text: t(
          'Ett andra anrop berättar det kontrollerade svaret som en kort fabel som slutar i en sensmoral, utan citat och utan regler svaret inte har.',
          'A second call retells the checked answer as a short fable ending in a moral, with no quotes and no rule the answer does not state.',
        ),
      },
      {
        title: t('Modellutvärdering', 'Model evaluation'),
        text: t(
          '20 fasta frågor körda genom samma väg som sidan för att välja svarsmodell.',
          '20 fixed questions run through the same path as the page to choose the answer model.',
        ),
      },
    ],
    shows: [
      {
        value: '15 / 20',
        text: t(
          'Gemma 4 26B utan tänkande gav svar där varje citat verifierades på 15 av 20 frågor (75 %), till 30,2 neuroner per svar.',
          'Gemma 4 26B with thinking off gave answers with every quote verified for 15 of 20 questions (75%), at 30.2 neurons per answer.',
        ),
      },
      {
        value: '17 / 20',
        text: t(
          'Frågor där sökningen hittade en väntad paragraf bland de 8 närmaste (recall@8 0,85).',
          'Questions where search found an expected paragraph among the 8 nearest (recall@8 0.85).',
        ),
      },
      {
        value: '94–97 %',
        text: t(
          'Andelen av de verkliga tio närmaste grannarna som behålls vid 256 dimensioner (recall@10 0,940 för lagarna, 0,961 och 0,969 för AI-förordningen på svenska och engelska).',
          'Share of the true ten nearest neighbours kept at 256 dimensions (recall@10 0.940 for the statutes, 0.961 and 0.969 for the AI Act in Swedish and English).',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          '40 lagar från riksdagens API, AI-förordningens konsoliderade text från EUR-Lex.',
          '40 statutes from the Riksdag API, the AI Act’s consolidated text from EUR-Lex.',
        ),
      },
      {
        step: t('Dela', 'Split'),
        text: t(
          'dbt delar lagarna i paragrafer.',
          'dbt splits the laws into paragraphs.',
        ),
      },
      {
        step: t('Bädda in', 'Embed'),
        text: t(
          'bge-m3 på Workers AI offline, komprimerad till 256 dimensioner och int8.',
          'bge-m3 on Workers AI offline, compressed to 256 dimensions and int8.',
        ),
      },
      {
        step: t('Sök', 'Search'),
        text: t(
          'Workern bäddar in frågan; webbläsaren hittar de 8 närmaste paragraferna.',
          'The Worker embeds the question; the browser finds the 8 nearest paragraphs.',
        ),
      },
      {
        step: t('Svara och kontrollera', 'Answer and check'),
        text: t(
          'Gemma svarar med citat; Workern håller inne svar med ett citat som inte stämmer.',
          'Gemma answers with quotes; the Worker withholds any answer with an unverified quote.',
        ),
      },
      {
        step: t('Berätta', 'Retell'),
        text: t(
          'Det kontrollerade svaret blir en fabel med sensmoral, visad ovanför svaret och dess källor.',
          'The checked answer becomes a fable with a moral, shown above the answer and its sources.',
        ),
      },
    ],
    tech: [
      'Cloudflare Workers AI',
      'Gemma 4',
      'bge-m3',
      'PCA + int8',
      'TypeScript',
      'React',
      'Python',
    ],
    limits: t(
      'Utvärderingen bygger på 20 handskrivna frågor, och demon söker i 40 utvalda lagar, inte hela författningssamlingen. Ett verifierat citat visar att orden finns i lagen, inte att svaret är juridiskt rätt, och fabeln är en bild av svaret, inte rådgivning. Utvärderingen gäller svaret, inte fabeln.',
      'The evaluation rests on 20 hand-written questions, and the demo searches 40 selected statutes, not the whole statute book. A verified quote proves the words are in the law, not that the answer is legally correct, and the fable is an image of the answer, not advice. The evaluation covers the answer, not the fable.',
    ),
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/workers-ai.md',
  },

  '#cluster-visuals': {
    question: t(
      'Kluster är lätta att rita och svåra att lita på. Sidan ställer sajtens klustringar sida vid sida, var och en ritad ur sin egen data och märkt med den metod körningen registrerade, så att läsaren kan bedöma grupperna själv.',
      'Clusters are easy to draw and hard to trust. The page puts the site’s clusterings side by side, each drawn from its own data and labelled with the method its run recorded, so readers can judge the groups themselves.',
    ),
    built: [
      {
        title: t('En spridningskomponent', 'One scatter component'),
        text: t(
          'ClusterScatter ritar varje karta: håll över en punkt för att läsa den, klicka för att lyfta fram dess grupp.',
          'ClusterScatter draws every map: hover a point to read it, click to pick out its group.',
        ),
      },
      {
        title: t('Placera din mening', 'Place your sentence'),
        text: t(
          'En Cloudflare Worker bäddar in besökarens mening med bge-m3, och webbläsaren placerar den bland dess 15 närmaste debattinlägg.',
          'A Cloudflare Worker embeds a visitor’s sentence with bge-m3, and the browser places it among its 15 nearest debate passages.',
        ),
      },
      {
        title: t('Laddas vid behov', 'Data on demand'),
        text: t(
          'En karta hämtar sin data först när den rullas nära skärmen.',
          'A map fetches its data only when it scrolls near the screen.',
        ),
      },
      {
        title: t('Metod per karta', 'Method per map'),
        text: t(
          'Varje karta bär sin körnings metodrad: modell, UMAP- och HDBSCAN-inställningar, frön och brus.',
          'Every map carries its run’s method line: model, UMAP and HDBSCAN settings, seeds and noise.',
        ),
      },
    ],
    shows: [
      {
        value: '33',
        text: t(
          'Partiledardebatter: 33 023 inlägg bildar 33 grupper. Jämna och udda frön stämmer överens till ARI 0,75, och 16,2 % passar ingen grupp efter omfördelning.',
          'Party-leader debates: 33,023 passages form 33 groups. Even and odd seeds agree at ARI 0.75, and 16.2% fit no group after reassignment.',
        ),
      },
      {
        value: '19',
        text: t(
          'Filosofi: 21 260 passager bildar 19 grupper, men 31,2 % passar ingen grupp ens efter omfördelning (57,5 % före).',
          'Philosophy: 21,260 passages form 19 groups, but 31.2% fit no group even after reassignment (57.5% before).',
        ),
      },
      {
        value: '10',
        text: t(
          'IT-jobbannonser 2022–2025: 35 861 annonser bildar 10 kluster, och 16,7 % hamnar utanför.',
          'IT job ads 2022–2025: 35,861 ads form 10 clusters, with 16.7% unassigned.',
        ),
      },
    ],
    how: [
      {
        step: t('Källa', 'Source'),
        text: t(
          'Riksdagsprotokoll, Project Gutenberg, JobTechs arkiv, Kolada och SCB.',
          'Riksdag protocols, Project Gutenberg, JobTech archives, Kolada and SCB.',
        ),
      },
      {
        step: t('Bädda in', 'Embed'),
        text: t(
          'sentence-bert-swedish-cased, paraphrase-multilingual-MiniLM och all-MiniLM-L6-v2.',
          'sentence-bert-swedish-cased, paraphrase-multilingual-MiniLM and all-MiniLM-L6-v2.',
        ),
      },
      {
        step: t('Reducera', 'Reduce'),
        text: t(
          'UMAP i 5 eller 10 dimensioner för klustringen, 2 för kartan.',
          'UMAP in 5 or 10 dimensions for clustering, 2 for the map.',
        ),
      },
      {
        step: t('Klustra', 'Cluster'),
        text: t(
          'HDBSCAN över 12 frön med ett konsensussteg; K-means på PCA för kommunerna.',
          'HDBSCAN over 12 seeds with a consensus step; K-means on PCA for municipalities.',
        ),
      },
      {
        step: t('Rita', 'Render'),
        text: t(
          'ClusterScatter läser varje publicerad JSON-fil, med ett urval på 3 000 punkter för forskningskartorna.',
          'ClusterScatter reads each published JSON file, sampled to 3,000 points for the research maps.',
        ),
      },
    ],
    tech: [
      'Python',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'scikit-learn',
      'DuckDB',
      'Cloudflare Workers AI (bge-m3)',
      'React',
      'TypeScript',
    ],
    limits: t(
      'Forskningskartorna visar ett urval på 3 000 punkter, och inlägg ur samma anförande eller debatt är inte oberoende. Gruppnamnen föreslogs av en språkmodell, inte granskade för hand. Kartorna per riksmöte bygger på en tidigare, ovaliderad modell och är utforskande.',
      'The research maps show a 3,000-point sample, and passages from the same speech or debate are not independent. Group names were proposed by a language model, not checked by hand. The per-session Riksdag maps come from an earlier, unvalidated model and are exploratory.',
    ),
  },

  '#projects-platform': {
    question: t(
      'Hur driver man många projekt på offentlig data utan att vart och ett blir sitt eget sköra skript? Svaret är ett register, ett kommando och en regel: inget släpps förrän varje kontroll i körningen gått igenom, och varje publicerad siffra går att spåra till en källfil med URL, hämtningstid och SHA-256.',
      'How do you run many public-data projects without each one becoming its own fragile script? The answer is one registry, one command and one rule: nothing is released until every check in the run passes, and every published number traces back to a source file with URL, fetch time and SHA-256.',
    ),
    built: [
      {
        title: t('Ett ämnesregister', 'One subject registry'),
        text: t(
          'Ett register definierar 26 ämnen med steg, dbt-selektorer, schema, SLA och leveransgrupp, och en körare kör dem likadant lokalt och i Actions.',
          'One registry defines 26 subjects with steps, dbt selectors, schedule, SLA and delivery group, and one runner runs them the same way locally and in Actions.',
        ),
      },
      {
        title: t('Medallion-dbt på DuckDB', 'Medallion dbt on DuckDB'),
        text: t(
          'Bronze-, silver- och gold-modeller med tvingande kontrakt och tester som spärrar varje export.',
          'Bronze, silver and gold models with enforced contracts and tests that gate every export.',
        ),
      },
      {
        title: t('Versionerade leveranser', 'Versioned delivery'),
        text: t(
          'Varje grupp släpps som en kontrollerad release till Cloudflare R2, med dbt-resultat och radantal i sitt manifest.',
          'Each group is published as a checked release to Cloudflare R2, with dbt results and row counts in its manifest.',
        ),
      },
      {
        title: t('En sajt som beskriver sig själv', 'A self-describing site'),
        text: t(
          'Härkomstgraf, ER-diagram, kvalitetskontroller och 30 dagars körhälsa ritas ur exporterade filer och GitHubs API.',
          'Lineage graph, ER diagrams, quality checks and 30 days of run health render from exported files and the GitHub API.',
        ),
      },
      {
        title: t('Samma mönster i Fabric', 'The same pattern on Fabric'),
        text: t(
          'DiVA-data går genom samma bronze-, silver- och gold-flöde i Microsoft Fabric.',
          'DiVA data runs through the same bronze, silver and gold flow on Microsoft Fabric.',
        ),
      },
    ],
    shows: [
      {
        value: '334',
        text: t(
          'dbt-modeller över 130 källtabeller, skyddade av 920 tester och med 23 681 601 rader (exporterat 2026-10-26).',
          'dbt models over 130 source tables, guarded by 920 tests and holding 23,681,601 rows (exported 2026-10-26).',
        ),
      },
      {
        value: '38 / 42',
        text: t(
          'Kvalitetskontroller som går igenom; 2 är inte tillämpliga och 2 mäts inte (utvärderat 2026-10-26).',
          'Quality checks that pass; 2 are not applicable and 2 are not measured (evaluated 2026-10-26).',
        ),
      },
      {
        value: '2',
        text: t(
          'Incidentrapporter från 2026-10-22: en borttagen worktree som tömde lagret, och tredjepartstext som hamnade i en publik bucket.',
          'Postmortems from 2026-10-22: a worktree removal that emptied the warehouse, and third-party text pushed to a public bucket.',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          'Python-hämtare på scheman i GitHub Actions; råfiler behåller URL, tid och hash.',
          'Python fetchers on GitHub Actions schedules; raw files keep URL, time and hash.',
        ),
      },
      {
        step: t('Modellera', 'Model'),
        text: t(
          'dbt bronze → silver → gold i DuckDB, med mål per ämne.',
          'dbt bronze → silver → gold in DuckDB, with targets per subject.',
        ),
      },
      {
        step: t('Testa', 'Test'),
        text: t(
          'Kontrakt och dbt-tester; export först när alla går igenom.',
          'Contracts and dbt tests; export only after all pass.',
        ),
      },
      {
        step: t('Publicera', 'Publish'),
        text: t(
          'Versionerad grupprelease till Cloudflare R2.',
          'Versioned group release to Cloudflare R2.',
        ),
      },
      {
        step: t('Sajt', 'Site'),
        text: t(
          'React-sidorna läser publicerade filer; en misslyckad körning öppnar ett GitHub-ärende.',
          'React pages read published files; a failed run opens a GitHub issue.',
        ),
      },
    ],
    tech: [
      'Python',
      'DuckDB',
      'dbt',
      'GitHub Actions',
      'Cloudflare R2',
      'Cloudflare Workers + Workers AI',
      'Terraform',
      'React + TypeScript + Vite',
      'pytest + Playwright',
      'Microsoft Fabric',
    ],
    limits: t(
      'Några politikbyggare körs fortfarande som äldre skript utanför registret, och GitHub startar schemalagda körningar sent eller hoppar över dem. Kvalitetsutvärderingen som visas är från 2026-10-26.',
      'Some politics builders still run as legacy scripts outside the registry, and GitHub starts scheduled runs late or drops them. The quality evaluation shown dates from 2026-10-26.',
    ),
    code: 'https://github.com/korv9/anton-portfolio',
  },

  '#philosophy-atlas': {
    question: t(
      'Hur organiserar återkommande moraliska och filosofiska spänningar texter över tänkare och traditioner? En idékarta måste visa idéer, inte vilken bok eller översättare en passage kommer från, så projektet mäter den dragningen först.',
      'How do recurring moral and philosophical tensions organise texts across thinkers and traditions? A map of ideas has to show ideas, not which book or translator a passage came from, so the project measures that pull first.',
    ),
    built: [
      {
        title: t('Ren korpus', 'Clean corpus'),
        text: t(
          'Tretton verk från Project Gutenberg med författare, år, tradition och översättare, skurna till filosofens egen text utan inledningar och noter.',
          'Thirteen Project Gutenberg works with author, year, tradition and translator, cut to the philosopher’s own text without introductions and notes.',
        ),
      },
      {
        title: t('Balanserat urval', 'Balanced sample'),
        text: t(
          '7 795 passager, högst 200 per verk på kartan, så att 2 600 passager väger lika.',
          '7,795 passages, at most 200 per work on the map, so 2,600 passages carry equal weight.',
        ),
      },
      {
        title: t('Två kartor', 'Two maps'),
        text: t(
          'Flerspråkiga MiniLM-inbäddningar, UMAP och HDBSCAN på en rå karta och en karta centrerad per verk.',
          'Multilingual MiniLM embeddings, UMAP and HDBSCAN on a raw map and a map centred per work.',
        ),
      },
      {
        title: t('Spänningslinser', 'Tension lenses'),
        text: t(
          'Elva polpar som frihet ↔ kontroll, varje pol en skriven mening; en passages läge är dess likhet med den ena polen minus den andra.',
          'Eleven pole pairs such as freedom ↔ control, each pole one written sentence; a passage’s position is its similarity to one pole minus the other.',
        ),
      },
    ],
    shows: [
      {
        value: '48 → 32 %',
        text: t(
          'Andel av en passages tio närmaste grannar från samma verk, rå karta mot centrerad per verk (slump 8 %).',
          'Share of a passage’s ten nearest neighbours from the same work, raw map against centred per work (chance 8%).',
        ),
      },
      {
        value: '58 → 44 %',
        text: t(
          'Översättarens stil syns: andel grannar med samma översättare, rått mot centrerat, mot 14 % av en slump.',
          'Translator style is measurable: share of neighbours with the same translator, raw against centred, against 14% by chance.',
        ),
      },
      {
        value: '6 → 21',
        text: t(
          'Grupper som blandar minst tre verk utan att något har mer än hälften, när kartan centreras; grupper som domineras av ett verk går från 2 till 0.',
          'Groups that mix at least three works with none above half, once the map is centred; groups dominated by one work fall from 2 to 0.',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          '13 Gutenberg-texter via rawstore.',
          '13 Gutenberg texts via rawstore.',
        ),
      },
      {
        step: t('Trimma', 'Trim'),
        text: t(
          'Bara filosofens egen text, med gemensam Gutenberg-rensning.',
          'The philosopher’s own text only, with shared Gutenberg cleaning.',
        ),
      },
      {
        step: t('Bädda in och kartlägg', 'Embed and map'),
        text: t(
          'paraphrase-multilingual-MiniLM-L12-v2, rått och centrerat per verk, UMAP och HDBSCAN.',
          'paraphrase-multilingual-MiniLM-L12-v2, raw and centred per work, UMAP and HDBSCAN.',
        ),
      },
      {
        step: t('Linser', 'Lenses'),
        text: t(
          'Elva spänningar räknade per passage.',
          'Eleven tensions scored per passage.',
        ),
      },
      {
        step: t('Publicera', 'Publish'),
        text: t(
          'dbt gold-marts till JSON; inga inbäddningar publiceras.',
          'dbt gold marts to JSON; no embeddings are published.',
        ),
      },
    ],
    tech: [
      'Python',
      'Sentence Transformers',
      'UMAP',
      'HDBSCAN',
      'dbt',
      'DuckDB',
      'React',
      'TypeScript',
    ],
    limits: t(
      'Tretton verk står inte för hela traditioner, de flesta är engelska översättningar och översättarens stil syns på kartan. Passagerna skärs mekaniskt, och spänningarnas poler är enskilda meningar som en annan formulering skulle flytta.',
      'Thirteen works do not stand for whole traditions, most are English translations, and translator style shows in the map. Passages are cut mechanically, and the tension poles are single sentences that another wording would move.',
    ),
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/philosophy-atlas.md',
  },

  '#symbolic-atlas': {
    question: t(
      'Kan symbolisk mening träda fram ur text utan att kategorierna bestäms först? Den första körningen visade att klustren följde böckerna mer än symbolerna, så frågan blev om symbolik går att skilja från stil och bokens identitet.',
      'Can symbolic meaning emerge from text without defining the categories first? The first run showed the clusters followed books more than symbols, so the question became whether symbolism can be separated from style and the identity of a book.',
    ),
    built: [
      {
        title: t('Korpusflöde', 'Corpus pipeline'),
        text: t(
          '101 böcker från Project Gutenberg inlästa med URL, tid och SHA-256 och rensade från standardtext och paratext i dbt, med varje borttagning loggad.',
          '101 Project Gutenberg books ingested with URL, time and SHA-256, cleaned of boilerplate and paratext in dbt, with every removal logged.',
        ),
      },
      {
        title: t('Inbäddning och klustring', 'Embedding and clustering'),
        text: t(
          'Varje förekomst av 20 symbolord bäddas in med sina omgivande meningar (all-MiniLM-L6-v2), projiceras med UMAP och klustras med HDBSCAN.',
          'Each occurrence of 20 symbol words is embedded with its surrounding sentences (all-MiniLM-L6-v2), projected with UMAP and clustered with HDBSCAN.',
        ),
      },
      {
        title: t('Experiment mot bokeffekten', 'Deconfounding experiments'),
        text: t(
          'Varianter med maskerat symbolord och bokcentrering på samma urval, plus en jämförelse av inbäddningsmodeller.',
          'Variants with the symbol word masked and with book-centring on the same sample, plus a comparison of embedding models.',
        ),
      },
      {
        title: t('Interaktiv atlas', 'Interactive atlas'),
        text: t(
          'En kanvaskarta med filter för symbol, tradition och kluster i adressen, och en forskningsberättelse steg för steg.',
          'A canvas map with symbol, tradition and cluster filters kept in the URL, plus a step-by-step research story.',
        ),
      },
    ],
    shows: [
      {
        value: '0.49 → 0.20',
        text: t(
          'Utan korrigering följer klustren boken (AMI 0,49) långt mer än symbolen (0,13); bokcentrering gör dem jämna på ungefär 0,20 vardera, men gör inte symbolen dominerande.',
          'Without correction the clusters follow the book (AMI 0.49) far more than the symbol (0.13); book-centring brings both to about 0.20, and does not make the symbol dominant.',
        ),
      },
      {
        value: '72 → 87',
        text: t(
          'Kluster som spänner över flera böcker, före och efter bokcentrering; deras andel av passagerna steg från 34 % till 44 %.',
          'Clusters spanning several books, before and after book-centring; their share of passages rose from 34% to 44%.',
        ),
      },
      {
        value: '58 → 36 %',
        text: t(
          'Att växa från 10 till 101 böcker sänkte den största bokens andel av ett kluster, men bruset steg till 52 % och silhuetten föll från 0,53 till 0,31.',
          'Growing the corpus from 10 to 101 books cut the largest book’s share of a cluster, but noise rose to 52% and silhouette fell from 0.53 to 0.31.',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          'Project Gutenberg-texter via rawstore med SHA-256.',
          'Project Gutenberg texts via rawstore with SHA-256.',
        ),
      },
      {
        step: t('Rensa', 'Clean'),
        text: t(
          'En dbt Python-modell i silver tar bort standardtext och paratext.',
          'A dbt Python model in silver strips boilerplate and paratext.',
        ),
      },
      {
        step: t('Plocka ut', 'Extract'),
        text: t(
          'Vart och ett av 20 symbolord med sitt sammanhang.',
          'Each of 20 symbol words with its context window.',
        ),
      },
      {
        step: t('Bädda in och klustra', 'Embed and cluster'),
        text: t(
          'MiniLM 384 dimensioner, UMAP 2-D och 10-D, HDBSCAN med minsta storlek 20.',
          'MiniLM 384 dimensions, UMAP 2-D and 10-D, HDBSCAN with minimum size 20.',
        ),
      },
      {
        step: t('Publicera', 'Publish'),
        text: t(
          'Gold-marts till JSON och Parquet på R2.',
          'Gold marts to JSON and Parquet on R2.',
        ),
      },
    ],
    tech: [
      'Python',
      'Sentence Transformers',
      'UMAP',
      'HDBSCAN',
      'dbt',
      'DuckDB',
      'Parquet',
      'Cloudflare R2',
      'React',
      'TypeScript',
    ],
    limits: t(
      'Symbolmatchningen bygger på en ordlista, så bokstavlig och symbolisk användning räknas lika, och ett sammanhangskluster är inte en symbolisk mening eller en arketyp. Korpusen är 101 engelska böcker ur ett arkiv, med 1800-talets översättare överrepresenterade.',
      'Symbol matching is lexicon-based, so literal and symbolic uses count the same, and a context cluster is not a symbolic meaning or an archetype. The corpus is 101 English books from one archive, over-representing 19th-century translators.',
    ),
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/symbolic-atlas.md',
  },

  '#concepts-profiles': {
    question: t(
      'Var dyker samma idéer upp när de rör sig från berättelser till filosofi, politik och lag? Att jämföra en folksaga med ett riksdagstal och en EU-förordning är bara rättvist om metoden visar vilka skillnader som kommer från texterna och vilka från ämnet.',
      'Where do the same ideas appear as they move from stories to philosophy, politics and law? Comparing a folk tale with a Riksdag speech and an EU regulation is only fair if the method shows which differences come from the texts and which from the subject.',
    ),
    built: [
      {
        title: t('Fyra balanserade korpusar', 'Four balanced corpora'),
        text: t(
          'Upp till 500 passager vardera ur Symbol Labs böcker, Philosophy Labs verk, riksdagsanföranden och AI-förordningen, med full härkomst.',
          'Up to 500 passages each from the Symbol Lab books, the Philosophy Lab works, Riksdag speeches and the AI Act, with full provenance.',
        ),
      },
      {
        title: t('Utvalda begrepp', 'Curated concepts'),
        text: t(
          '28 begrepp i familjer, vart och ett med en ankarmening på svenska och engelska, inbäddade med en flerspråkig modell.',
          '28 concepts in families, each with an anchor sentence in Swedish and English, embedded with one multilingual model.',
        ),
      },
      {
        title: t('Typade relationer', 'Typed relations'),
        text: t(
          'Varje linje mellan begrepp har en av fem uttalade typer och är märkt som härledd, tolkning eller källa.',
          'Every line between concepts has one of five stated types and is marked as derived, interpretation or source.',
        ),
      },
      {
        title: t('dbt gold-lager', 'dbt gold layer'),
        text: t(
          'Dimensioner, fakta och marts för profiler, passager, relationer och länkar.',
          'Dimensions, facts and marts for profiles, passages, relations and links.',
        ),
      },
    ],
    shows: [
      {
        value: '93 %',
        text: t(
          'Andel av passagernas närmaste grannar i samma korpus (slump 25 %, 80 % efter centrering), delvis en språkeffekt eftersom riksdagen är den enda svenska. Därför läggs passagerna aldrig på en gemensam karta.',
          'Share of passages’ nearest neighbours in the same corpus (chance 25%, 80% after centring), partly a language effect since the Riksdag is the only Swedish one. So passages are never placed on one shared map.',
        ),
      },
      {
        value: '10.7×',
        text: t(
          'Död är närmaste begrepp för 38 % av myternas passager, 10,7 gånger slumpen; omsorg för 24 % av riksdagens.',
          'Death is the closest concept for 38% of myth passages, 10.7 times chance; care for 24% of Riksdag passages.',
        ),
      },
      {
        value: '4.4×',
        text: t(
          'Säkerhet är närmaste begrepp för 16 % av AI-förordningens passager, 4,4 gånger slumpen, och transparens 3,5 gånger.',
          'Safety is the closest concept for 16% of AI Act passages, 4.4 times chance, and transparency 3.5 times.',
        ),
      },
    ],
    how: [
      {
        step: t('Källor', 'Sources'),
        text: t(
          'Återanvänder korpusarna från Symbol Lab, Philosophy Lab, riksdagen och AI-förordningen.',
          'Reuses the Symbol Lab, Philosophy Lab, Riksdag and AI Act corpora.',
        ),
      },
      {
        step: t('Urval', 'Sample'),
        text: t(
          'Upp till 500 passager per korpus, 40–220 ord.',
          'Up to 500 passages per corpus, 40–220 words.',
        ),
      },
      {
        step: t('Bädda in', 'Embed'),
        text: t(
          'paraphrase-multilingual-MiniLM-L12-v2 för passager och ankarmeningar.',
          'paraphrase-multilingual-MiniLM-L12-v2 for passages and anchors.',
        ),
      },
      {
        step: t('Jämför', 'Align'),
        text: t(
          'Varje passage rangordnas mot de 28 begreppen och jämförs med slumpen; par över korpusar behålls bara över 95:e percentilen.',
          'Each passage is ranked against the 28 concepts and compared with chance; cross-corpus pairs are kept only above the 95th percentile.',
        ),
      },
      {
        step: t('Publicera', 'Publish'),
        text: t('dbt gold-marts till JSON.', 'dbt gold marts to JSON.'),
      },
    ],
    tech: [
      'Python',
      'Sentence Transformers',
      'dbt',
      'DuckDB',
      'React',
      'TypeScript',
    ],
    limits: t(
      'Andra ankarmeningar skulle ge andra profiler, och liknande ordval är inte påverkan. Begreppen, ankarna och länkarna är redaktionella val, och de närmaste passagerna är modellens rangordning.',
      'Different anchor sentences would give different profiles, and similar wording is not influence. Concepts, anchors and links are editorial choices, and the closest passages are model rankings.',
    ),
    code: 'https://github.com/korv9/anton-portfolio/blob/main/docs/concept-constellation.md',
  },

  '#thesis': {
    question: t(
      'När en incident inträffar är målet att få folk att kunna jobba igen, så liknande ärenden hanteras ett i taget och återkommande fel förblir dolda. Kan NLP och oövervakad klustring koppla ihop dem till mönster värda att utreda, och hur begränsar datakvaliteten vad AI kan göra med verklig driftdata?',
      'When an incident happens the priority is getting people working again, so similar tickets are handled one by one and recurring faults stay hidden. Can NLP and unsupervised clustering connect them into patterns worth investigating, and how does data quality limit what AI can do with real operational data?',
    ),
    built: [
      {
        title: t('Datakvalitetsgranskning', 'Data quality audit'),
        text: t(
          'Fem dimensioner ur ISO/IEC 25012 bedömda på 21 633 incidentposter från Freshservice hos Fora AB, före all modellering.',
          'Five ISO/IEC 25012 dimensions assessed on 21,633 Freshservice incident records at Fora AB, before any modelling.',
        ),
      },
      {
        title: t('Maskering av personuppgifter', 'Privacy masking'),
        text: t(
          'Regex och Presidio med spaCy, svenska och engelska modeller, maskerar personuppgifter lokalt före analysen.',
          'Regex plus Presidio with spaCy, Swedish and English models, masks personal data locally before analysis.',
        ),
      },
      {
        title: t('Inbäddningsflöde', 'Embedding pipeline'),
        text: t(
          'Viktad ärendetext (ämne ×3, analys ×4, beskrivning ×1) inbäddad med paraphrase-multilingual-mpnet-base-v2 i 768 dimensioner.',
          'Weighted ticket text (subject ×3, analysis ×4, description ×1) embedded with paraphrase-multilingual-mpnet-base-v2 in 768 dimensions.',
        ),
      },
      {
        title: t('Klustring och spårning', 'Clustering and tracking'),
        text: t(
          'UMAP till 10 dimensioner, HDBSCAN mot K-means, och varje körning loggad i MLflow på Azure Databricks.',
          'UMAP to 10 dimensions, HDBSCAN against K-means, and every run logged in MLflow on Azure Databricks.',
        ),
      },
    ],
    shows: [
      {
        value: '121',
        text: t(
          'Kluster från HDBSCAN i den valda körningen på 16 811 ärenden; 72 av dem (5 605 ärenden) saknade koppling till ett registrerat problem. Granskningskandidater, inte bevisade rotorsaker.',
          'Clusters from HDBSCAN in the selected run on 16,811 tickets; 72 of them (5,605 tickets) had no link to a registered problem. Review candidates, not proven root causes.',
        ),
      },
      {
        value: '0.706',
        text: t(
          'Silhuett för HDBSCAN mot 0,534 för K-means (73 kluster), mätt i UMAP-rymden. HDBSCAN lämnar 27,7 % som brus och bedömer bara resten, så det är ingen likvärdig rangordning.',
          'Silhouette for HDBSCAN against 0.534 for K-means (73 clusters), measured in UMAP space. HDBSCAN leaves 27.7% as noise and scores only the rest, so this is not a like-for-like ranking.',
        ),
      },
      {
        value: '4.2 %',
        text: t(
          'Fältet för den underliggande orsaken var ifyllt i bara 4,2 % av posterna, och problemkopplingar fanns för 5,1 %. Dokumentationen, inte modellen, var den största begränsningen.',
          'The root-cause field was filled in only 4.2% of records, and problem links existed for 5.1%. Documentation, not the model, was the main limit.',
        ),
      },
    ],
    how: [
      {
        step: t('Läs in', 'Ingest'),
        text: t(
          'Freshservice REST API, inkrementellt, till bronze, silver och gold i Azure Databricks.',
          'Freshservice REST API, incremental, into bronze, silver and gold in Azure Databricks.',
        ),
      },
      {
        step: t('Bedöm', 'Assess'),
        text: t(
          'ISO/IEC 25012-dimensioner på 21 633 poster.',
          'ISO/IEC 25012 dimensions on 21,633 records.',
        ),
      },
      {
        step: t('Rensa', 'Clean'),
        text: t(
          'Larm, testärenden och dubbletter bort, personuppgifter maskerade: 19 847 unika incidenter.',
          'Alerts, tests and duplicates dropped, personal data masked: 19,847 unique incidents.',
        ),
      },
      {
        step: t('Bädda in och klustra', 'Embed and cluster'),
        text: t(
          'Vald körning på 16 811 ärenden; UMAP 10D och HDBSCAN med minsta klusterstorlek 30.',
          'Selected run on 16,811 tickets; UMAP 10D and HDBSCAN with a minimum cluster size of 30.',
        ),
      },
      {
        step: t('Matcha', 'Match'),
        text: t(
          'Klustren jämförs med befintliga problemposter.',
          'Clusters compared with existing problem records.',
        ),
      },
    ],
    tech: [
      'Python',
      'Azure Databricks',
      'Delta',
      'Presidio + spaCy',
      'sentence-transformers',
      'UMAP',
      'HDBSCAN',
      'K-means',
      'MLflow',
    ],
    limits: t(
      'Källärendena är privata: ingen ärendetext eller rådata publiceras, och sajten visar bara aggregat. Studien gäller en organisation, planerade intervjuer genomfördes inte, och problemkopplingarna är glesa, så kandidaterna behöver fortfarande valideras i driften.',
      'The source tickets are private: no incident text or raw data is published, and the site shows only aggregates. The study covers one organisation, the planned interviews were not carried out, and problem links are sparse, so the candidates still need operational validation.',
    ),
  },

  '#drugcomb': {
    question: t(
      'Två läkemedel är synergistiska när de tillsammans dödar fler cancerceller än deras separata effekter förutsäger. Att förutsäga ett par som modellen nästan sett är lätt; frågan är om det håller för par, läkemedel och cellinjer den aldrig sett.',
      'Two drugs are synergistic when together they kill more cancer cells than their separate effects predict. Predicting a pair the model has almost seen is easy; the question is whether it holds for pairs, drugs and cell lines it has never seen.',
    ),
    built: [
      {
        title: t('Entitetsmatchning', 'Entity resolution'),
        text: t(
          'Namn på läkemedel och cellinjer matchade mellan DrugCombDB, PubChem och DepMap.',
          'Drug and cell-line names matched across DrugCombDB, PubChem and DepMap.',
        ),
      },
      {
        title: t('DuckDB-lager', 'DuckDB warehouse'),
        text: t(
          'Stjärnschema med 10 datakvalitetstester som alla går igenom, och varje indatafil låst med SHA-256.',
          'Star schema with 10 data-quality tests, all passing, and every input file pinned by SHA-256.',
        ),
      },
      {
        title: t('Modeller som tål läckage', 'Leakage-aware models'),
        text: t(
          'LightGBM med stegvisa feature-tillägg mot baslinjer, utvärderad under fyra uppdelningar och med blandade etiketter som kontroll.',
          'LightGBM feature ablations against baselines, scored under four cross-validation splits with a shuffled-label check.',
        ),
      },
      {
        title: t('Interaktiv rapport', 'Interactive report'),
        text: t(
          'Flikar för modellen och cellinjerna, plus sidor om kvalitet, metod och data.',
          'Tabs for the model and the cell lines, plus quality, method and data pages.',
        ),
      },
    ],
    shows: [
      {
        value: '0.662',
        text: t(
          'Pearson för bästa LightGBM på slumpade rader; med minst ett nytt läkemedel faller den till 0,520–0,543. Det glappet är det ärliga resultatet.',
          'Pearson for the best LightGBM on random rows; with a new drug (one or both) it drops to 0.520–0.543. That gap is the honest result.',
        ),
      },
      {
        value: '0.453 → 0.571',
        text: t(
          'Monoterapisvar bär generaliseringen: på osedda cellinjer lyfter det Pearson från 0,453 till 0,571.',
          'Monotherapy response carries generalisation: on unseen cell lines it lifts Pearson from 0.453 to 0.571.',
        ),
      },
      {
        value: '13×',
        text: t(
          'Rangordningen fungerar: den bästa procenten av förutsägelserna på osedda par har 53,5 % synergistiska par mot basnivån 4,1 %.',
          'Ranking works: the top 1% of predictions on unseen pairs holds 53.5% synergistic pairs against a base rate of 4.1%.',
        ),
      },
    ],
    how: [
      {
        step: t('Hämta', 'Download'),
        text: t(
          'DrugCombDB-screeningar och DepMap 24Q4, med SHA-256 i ett datamanifest.',
          'DrugCombDB screens and DepMap 24Q4, with SHA-256 in a data manifest.',
        ),
      },
      {
        step: t('Rensa', 'Clean'),
        text: t(
          '498 865 råa rader till 396 498 unika kombinationer av par, cellinje och studie.',
          '498,865 raw rows to 396,498 unique combinations of pair, cell line and study.',
        ),
      },
      {
        step: t('Features', 'Features'),
        text: t(
          'RDKit-fingeravtryck, RNA-uttryck, mål, monoterapi och screeninghistorik.',
          'RDKit fingerprints, RNA expression, targets, monotherapy and screen history.',
        ),
      },
      {
        step: t('Träna', 'Train'),
        text: t(
          'LightGBM mot globalt medelvärde och screeninghistorik som baslinjer.',
          'LightGBM against the global mean and screen history as baselines.',
        ),
      },
      {
        step: t('Utvärdera', 'Evaluate'),
        text: t(
          'Slumpade rader, osedda par, nytt läkemedel (ett eller båda), osedd cellinje; plus blandade etiketter på en uppdelning, r = 0,002.',
          'Random rows, unseen pair, new drug (one or both), unseen cell line; plus shuffled labels on one split, r = 0.002.',
        ),
      },
    ],
    tech: [
      'Python',
      'DuckDB',
      'RDKit',
      'scikit-learn',
      'LightGBM',
      'DepMap',
      'DrugCombDB',
    ],
    limits: t(
      'Monoterapieffekterna kommer från samma screeningar, så modellen förutsätter att enskilda läkemedels resultat redan är kända. De publicerade siffrorna kommer från en låst körning som inte tränats om för sidan, och inget av det är kliniskt belägg.',
      'Monotherapy effects come from the same screens, so the model assumes single-drug results are already known. The published numbers come from a pinned run not retrained for the page, and none of it is clinical evidence.',
    ),
    code: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
  },
}
