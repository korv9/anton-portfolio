import { swedishReports } from './sv-extra'

export type Locale = 'en' | 'sv'

const storageKey = 'anton-portfolio-language'

export function initialLocale(): Locale {
  try {
    return localStorage.getItem(storageKey) === 'sv' ? 'sv' : 'en'
  } catch {
    return 'en'
  }
}

let locale: Locale = initialLocale()

export function setLocale(next: Locale) {
  locale = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(storageKey, next)
  } catch {
    /* Private browsing can block storage. */
  }
}

export function currentLocale() {
  return locale
}
export function l(en: string, sv: string) {
  return locale === 'sv' ? sv : en
}

// English is the source copy. The dictionary keeps translations next to the
// original wording, while source quotations and dataset identifiers stay intact.
const swedish: Record<string, string> = {
  'Skip to content': 'Hoppa till innehåll',
  'Anton Ernstsson, home': 'Anton Ernstsson, startsida',
  'Main navigation': 'Huvudnavigering',
  About: 'Om mig',
  Projects: 'Projekt',
  Politics: 'Politik',
  'Job market': 'Arbetsmarknad',
  'Download CV': 'Ladda ned CV',
  Experience: 'Erfarenhet',
  'Tech stack': 'Teknik',
  Data: 'Data',
  Platform: 'Plattform',
  'Applied AI': 'Tillämpad AI',
  Delivery: 'Utveckling',
  'Data Engineer': 'Dataingenjör',
  'Analytics Engineer': 'Analytics Engineer',
  '& Analytics Engineer.': 'och Analytics Engineer.',
  "Hi, I'm Anton. I enjoy making complex information easier to understand — from building reliable data pipelines to exploring questions through reports and applied AI. I'm a junior data professional with experience from Fora and Avtalat, and this is a collection of what I've worked on and what I'm curious about.":
    'Hej, jag heter Anton. Jag tycker om att göra komplex information lättare att förstå – från att bygga tillförlitliga dataflöden till att utforska frågor genom rapporter och tillämpad AI. Jag är i början av min karriär inom data, med erfarenhet från Fora och Avtalat. Här samlar jag sådant jag har arbetat med och är nyfiken på.',
  'View projects': 'Se projekten',
  'Email me': 'Mejla mig',
  'Analytics Engineer · LIA internship': 'Analytics Engineer · LIA-praktik',
  'Data Engineer · LIA internship': 'Data Engineer · LIA-praktik',
  'AI Developer programme': 'Utbildning till AI-utvecklare',
  'Open to junior data roles': 'Öppen för juniora roller inom data',
  'A little more about me': 'Lite mer om mig',
  'I like understanding how the pieces fit together.':
    'Jag gillar att förstå hur delarna hänger ihop.',
  "I'm Anton, a junior Data Engineer / Analytics Engineer based in Stockholm. I enjoy bringing structure to complicated information: finding out where it comes from, making it reliable and turning it into something people can use.":
    'Jag heter Anton och är junior Data Engineer / Analytics Engineer i Stockholm. Jag gillar att skapa struktur i komplex information: förstå var den kommer ifrån, göra den tillförlitlig och förvandla den till något människor kan använda.',
  'My AI Developer studies at JENSEN led into data engineering and analytics internships at Fora and Avtalat. Working with both pipelines and reporting has made me interested in the whole journey, from a source system to the questions someone wants to answer.':
    'Min utbildning till AI-utvecklare på JENSEN ledde till praktik inom data engineering och analytics hos Fora och Avtalat. Arbetet med både dataflöden och rapportering har gjort mig intresserad av hela kedjan, från källsystem till de frågor någon vill besvara.',
  'Experience / learning by building': 'Erfarenhet / att lära genom att bygga',
  'From source systems to useful reports.':
    'Från källsystem till användbara rapporter.',
  'Avtalat · Analytics Engineer': 'Avtalat · Analytics Engineer',
  'Jan–Jun 2026 · LIA internship': 'Jan–jun 2026 · LIA-praktik',
  'Extended Freshservice ETL in Azure Databricks using PySpark and Spark SQL. Built Power BI reports and semantic models with DirectQuery and DAX, and worked on reproducible incident analysis with attention to data quality and anonymisation.':
    'Vidareutvecklade ETL för Freshservice i Azure Databricks med PySpark och Spark SQL. Byggde Power BI-rapporter och semantiska modeller med DirectQuery och DAX samt arbetade med reproducerbar incidentanalys med fokus på datakvalitet och anonymisering.',
  'Fora · Data Engineer': 'Fora · Data Engineer',
  'Nov 2025–Jan 2026 · LIA internship': 'Nov 2025–jan 2026 · LIA-praktik',
  'Built API ingestion and incremental Bronze, Silver and Gold pipelines. The work included validation, error handling and a Gold-layer star schema for IT service reporting.':
    'Byggde API-inläsning och inkrementella dataflöden i Bronze, Silver och Gold. Arbetet omfattade validering, felhantering och ett stjärnschema i Gold-lagret för rapportering om IT-tjänster.',
  'Delicato · Machine Operator': 'Delicato · Maskinoperatör',
  'Worked with production, quality control and technical troubleshooting. Also served as vice-chair of the local union club.':
    'Arbetade med produktion, kvalitetskontroll och teknisk felsökning. Var också vice ordförande i den lokala fackklubben.',
  Education: 'Utbildning',
  'AI Developer · JENSEN': 'AI-utvecklare · JENSEN',
  '2024–2026 · Higher Vocational Education, 400 YH credits. Graduated June 2026.':
    '2024–2026 · Yrkeshögskola, 400 YH-poäng. Examen i juni 2026.',
  'My professional experience is in data and analytics. My frontend skills come from studies and personal projects, including making these reports accessible in the browser.':
    'Min yrkeserfarenhet finns inom data och analys. Mina frontendkunskaper kommer från studier och egna projekt, bland annat arbetet med att göra de här rapporterna tillgängliga i webbläsaren.',
  'Outside the job description': 'Utanför arbetsbeskrivningen',
  "Projects start with something I'm curious about.":
    'Mina projekt börjar med något jag är nyfiken på.',
  'I built the political observatory because I find it difficult to connect what politicians say with budgets and formal decisions. I want people to be able to read the evidence themselves.':
    'Jag byggde politikrapporten för att det är svårt att koppla det politiker säger till budgetar och formella beslut. Jag vill att människor själva ska kunna läsa underlaget.',
  'The other projects follow different questions: how the job market changes, how requirements change meaning, and whether a predictive model still works on unfamiliar data. This site is a place to explore those questions as well as see how I work.':
    'De andra projekten undersöker andra frågor: hur arbetsmarknaden förändras, hur krav ändrar innebörd och om en prediktionsmodell fungerar på okända data. Här kan man utforska frågorna och samtidigt se hur jag arbetar.',
  "What I'm looking for": 'Det jag söker',
  'A junior role in data engineering or analytics engineering where I can contribute with Python, SQL and data modelling, keep learning, and work with the people who use the results.':
    'En junior roll inom data engineering eller analytics engineering där jag kan bidra med Python, SQL och datamodellering, fortsätta lära mig och arbeta nära dem som använder resultaten.',
  'Stockholm · Swedish and English': 'Stockholm · svenska och engelska',
  "Let's talk ↗": 'Hör av dig ↗',
  'My toolkit / across work, studies and projects':
    'Min verktygslåda / från arbete, studier och projekt',
  'Build & model': 'Bygga och modellera',
  'Analyse & explain': 'Analysera och förklara',
  'Explore & evaluate': 'Utforska och utvärdera',
  'Test & share': 'Testa och dela',
  'More from my studies & experiments': 'Mer från studier och experiment',
  "Other questions I've explored.": 'Andra frågor jag har utforskat.',
  'Earlier projects documented in my previous portfolio. These are short project summaries; interactive results and source datasets are not included here.':
    'Tidigare projekt beskrivs i min förra portfolio. Här finns korta sammanfattningar; interaktiva resultat och källdata ingår inte.',
  'A course-material assistant exploring document ingestion, retrieval, chat and quiz generation.':
    'En assistent för kursmaterial som utforskar dokumentinläsning, sökning, chatt och generering av quiz.',
  'An audio-classification study using Mel spectrograms and a convolutional neural network to distinguish normal and anomalous pump sounds.':
    'En studie i ljudklassificering med Mel-spektrogram och ett konvolutionellt neuralt nätverk för att skilja normala från avvikande pumpljud.',
  'An experiment with multiple language models, modular API routing, authentication and prompt tracking.':
    'Ett experiment med flera språkmodeller, modulär API-routning, autentisering och spårning av promptar.',
  'Earlier portfolio & project descriptions ↗':
    'Tidigare portfolio och projektbeskrivningar ↗',
  'Projects / questions / evidence': 'Projekt / frågor / underlag',
  'A collection of things I wanted to understand.':
    'En samling saker jag ville förstå.',
  'My professional experience is in data and applied AI. These projects show how I organise data, test ideas and make the results accessible. Each has its own purpose and level of maturity.':
    'Min yrkeserfarenhet finns inom data och tillämpad AI. Projekten visar hur jag organiserar data, prövar idéer och gör resultaten tillgängliga. Varje projekt har sitt eget syfte och sin egen mognadsgrad.',
  'The project directory could not be loaded.':
    'Projektöversikten kunde inte läsas in.',
  'Open project →': 'Öppna projektet →',
  'Source code ↗': 'Källkod ↗',
  'Back to all projects': 'Till alla projekt',
  'Explore the projects ·': 'Utforska projekten ·',
  Source: 'Källa',
  Period: 'Period',
  Unit: 'Mått',
  'Personal research · Swedish politics': 'Egen analys · svensk politik',
  'Swedish politics, in the records.': 'Svensk politik, i källorna.',
  'Speeches, proposed spending and formal decisions in one place. I built this to make it easier to follow what politicians actually do and check the original sources.':
    'Tal, föreslagna utgifter och formella beslut på ett ställe. Jag byggde sidan för att göra det lättare att följa vad politiker faktiskt gör och kontrollera originalkällorna.',
  Decisions: 'Beslut',
  Speeches: 'Tal',
  Budgets: 'Budgetar',
  'Language map': 'Språkkarta',
  'Data & methods': 'Data och metod',
  'Language & politics': 'Språk och politik',
  'What do party leaders talk about?': 'Vad talar partiledarna om?',
  'A map of language used in Swedish party leader debates. Nearby dots use similar words; the map does not show political positions.':
    'En karta över språket i svenska partiledardebatter. Punkter nära varandra använder liknande ord; kartan visar inte politiska ståndpunkter.',
  'Swedish Parliament open data': 'Riksdagens öppna data',
  'Text segments': 'Textsegment',
  'Explore debate × budget charts ↓': 'Utforska debatt och budget i diagram ↓',
  'speeches analysed': 'analyserade tal',
  'text segments': 'textsegment',
  'topic clusters': 'ämneskluster',
  'words ungrouped': 'ord utan kluster',
  'Parliamentary session': 'Riksmöte',
  Party: 'Parti',
  All: 'Alla',
  'How to read the map': 'Så läser du kartan',
  'Each dot is one sampled speech segment. Distance shows approximate language similarity, not agreement or a political position. Cluster names are provisional machine labels; I plan to retrain this model.':
    'Varje punkt är ett utvalt talsegment. Avståndet visar ungefärlig språklig likhet, inte samstämmighet eller politisk position. Klusternamnen är preliminära maskinetiketter; jag planerar att träna om modellen.',
  Shown: 'Visade',
  'Sample assigned a cluster': 'Andel i kluster',
  'Full session': 'Hela riksmötet',
  'Other topics': 'Övriga ämnen',
  Ungrouped: 'Utan kluster',
  'Read a sampled segment': 'Läs ett utvalt segment',
  'Choose a segment': 'Välj ett segment',
  'The coloured groups come from an exploratory NLP model. Percentages below describe words in the full analysed corpus; the map contains at most 400 sampled segments per session.':
    'De färgade grupperna kommer från en utforskande NLP-modell. Procenttalen nedan gäller ord i hela den analyserade korpusen; kartan visar högst 400 utvalda segment per riksmöte.',
  'Loading report data…': 'Läser in rapportdata…',
  'Selected segment': 'Valt segment',
  'Original Swedish excerpt': 'Utdrag på originalspråket svenska',
  'Open parliamentary source ↗': 'Öppna källan hos riksdagen ↗',
  'Select a dot on the map.': 'Välj en punkt på kartan.',
  'Main observation': 'Viktig observation',
  'Method & limitations': 'Metod och begränsningar',
  'Language map of debate segments': 'Språkkarta över debattsegment',
  'Each dot is a text segment. Nearby dots use similar language. Colour shows a machine-discovered topic.':
    'Varje punkt är ett textsegment. Närliggande punkter har liknande språk. Färgen visar ett maskinidentifierat ämne.',
  'Select a dot to read the source excerpt.':
    'Välj en punkt för att läsa källutdraget.',
  'Swedish job market.': 'Svensk arbetsmarknad.',
  'Historical job-ad data, with clear definitions and a view of how software and data roles changed.':
    'Historiska platsannonser med tydliga definitioner och en bild av hur roller inom mjukvara och data har förändrats.',
  'Labour market & technology': 'Arbetsmarknad och teknik',
  'What is happening to tech jobs?': 'Vad händer med teknikjobben?',
  'A compact view of ad volume, junior openings and technologies mentioned in Swedish job ads.':
    'En kort överblick över annonsvolym, juniora tjänster och teknik som nämns i svenska platsannonser.',
  'Unique ad IDs': 'Unika annons-ID:n',
  'ads in the sample': 'annonser i urvalet',
  'unique employers': 'unika arbetsgivare',
  'developer ads': 'utvecklarannonser',
  'Junior openings compared with total volume.':
    'Juniora annonser jämfört med den totala volymen.',
  'junior share': 'andel juniora',
  'Role family': 'Rollgrupp',
  'New ads per month': 'Nya annonser per månad',
  'Junior openings fell faster than total volume.':
    'Juniora tjänster minskade snabbare än den totala volymen.',
  'Most mentioned in data ads': 'Vanligast nämnda i dataannonser',
  'Definitions & limitations': 'Definitioner och begränsningar',
  'Documented text rules define role families and detect technology mentions. A mention may be optional or negated.':
    'Dokumenterade textregler definierar rollgrupper och hittar teknikomnämnanden. Ett omnämnande kan vara valfritt eller negerat.',
  'An ad is not a hire. The archive may not cover every Swedish vacancy, and title-based seniority is an approximation.':
    'En annons är inte en anställning. Arkivet täcker kanske inte alla svenska lediga tjänster, och senioritet utifrån jobbtiteln är en uppskattning.',
  'Code and methodology on GitHub ↗': 'Kod och metod på GitHub ↗',
  'Experimental results from cleaned measurements through evaluation on unfamiliar pairs, drugs and cell lines.':
    'Experimentella resultat från rensade mätningar till utvärdering på tidigare okända par, läkemedel och cellinjer.',
  'Allegoria · work in progress': 'Allegoria · pågående projekt',
  'A compact experiment with real requirement profiles and a clearly labelled synthetic direction example.':
    'Ett kort experiment med verkliga kravprofiler och ett tydligt märkt syntetiskt riktnings exempel.',
  'Degree project · Fora': 'Examensarbete · Fora',
  'Finding useful review candidates in incident data.':
    'Hitta användbara granskningskandidater i incidentdata.',
  'My principal case study in data quality, privacy-aware NLP and clustering. Internal source records are not published.':
    'Min främsta fallstudie om datakvalitet, integritetsmedveten NLP och klustring. Interna källdata publiceras inte.',
  'Degree project · Fora · 2026': 'Examensarbete · Fora · 2026',
  'Primary case study': 'Främsta fallstudien',
  'Finding review candidates in incident data':
    'Hitta granskningskandidater i incidentdata',
  'Built a privacy-aware Azure Databricks workflow for data quality assessment and NLP clustering. The goal was to surface groups of similar incidents for manual review, without presenting clusters as proven root causes.':
    'Byggde ett integritetsmedvetet flöde i Azure Databricks för bedömning av datakvalitet och NLP-klustring. Målet var att hitta grupper av liknande incidenter för manuell granskning, utan att framställa kluster som bevisade grundorsaker.',
  'anonymised incidents': 'anonymiserade incidenter',
  'clusters found': 'hittade kluster',
  'without an existing problem link': 'utan befintlig problemkoppling',
  'best reported silhouette': 'bästa rapporterade siluettvärde',
  'Data quality shaped the pipeline.': 'Datakvaliteten formade dataflödet.',
  'Selected ISO/IEC 25012 dimensions were assessed before the modelling stage.':
    'Utvalda dimensioner ur ISO/IEC 25012 bedömdes före modelleringen.',
  'HDBSCAN produced the stronger internal separation.':
    'HDBSCAN gav tydligare intern separering.',
  'The reported silhouette was 0.706, compared with 0.534 for KMeans.':
    'Det rapporterade siluettvärdet var 0,706 jämfört med 0,534 för KMeans.',
  '72 clusters became review candidates.':
    '72 kluster blev granskningskandidater.',
  'They lacked an existing problem link, but require domain validation before any root-cause claim.':
    'De saknade en befintlig problemkoppling men kräver verksamhetsgranskning innan man kan hävda en grundorsak.',
  'Pipeline & limitations': 'Dataflöde och begränsningar',
  'Presidio for PII, multilingual sentence embeddings, UMAP to 10 dimensions, HDBSCAN and MLflow. Internal clustering metrics do not replace business validation, and no internal incident text or employer raw data is published here.':
    'Presidio för personuppgifter, flerspråkiga meningsembeddings, UMAP till 10 dimensioner, HDBSCAN och MLflow. Interna klustringsmått ersätter inte verksamhetsvalidering. Inga interna incidenttexter eller rådata från arbetsgivaren publiceras här.',
  'Homie API · work in progress': 'Homie API · pågående projekt',
  'From household events to understandable analytics.':
    'Från hushållshändelser till begriplig analys.',
  'The API contract and data design are here for inspection. Several endpoints remain documented stubs.':
    'API-kontraktet och datamodellen går att granska här. Flera endpoints är fortfarande dokumenterade stubbar.',
}

export function t(original: string): string {
  if (locale === 'en') return original
  const key = original.replace(/\s+/g, ' ').trim()
  const translated = swedish[key] ?? swedishReports[key]
  if (!translated) return original
  return `${/^\s/.test(original) ? ' ' : ''}${translated}${/\s$/.test(original) ? ' ' : ''}`
}
