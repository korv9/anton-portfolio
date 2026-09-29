# Site structure and design

The site has two parts: the portfolio (the start page and one page per project) and the
politics product, *Svensk politik i siffror*. Swedish is the default language; English is one
click away and remembered.

## Start page

Only what a recruiter needs, in two columns:

- **Left, fixed:** name, role, at most three sentences on who Anton is and what he is looking
  for, a table of contents (01 Projekt, 02 Erfarenhet, 03 Tech stack) that marks the section
  being read, the three CVs (Data Engineer, Data Scientist / Applied AI, Python / AI Platform, in
  `public/cv/`) and contact links.
- **Right, read top to bottom:** Projekt (the politics product first, then every other project),
  Erfarenhet (Avtalat, Fora, Delicato) and Tech stack (five groups, each with one line on what it
  is used for, then the tools).
- On a phone the left column dissolves into the page and the contents become a sticky bar.
  Older addresses (`#om-mig`, `#kontakt`, `#kompetenser`) lead to the start or the stack.

The words live in `frontend/src/home/content.ts`; every fact comes from the CVs.

A short name intro plays once per session when the start page is opened directly (never on a
deep link). Click, Enter or Escape skips it; with reduced motion it is a short fade.
`frontend/src/site/Intro.tsx`.

## The politics product

One navigation with seven themes (a sidebar, a horizontal menu on small screens):

| Theme | Address | Main chart |
|---|---|---|
| Läget just nu | `#politik` | A one-screen dashboard (below) |
| Vad väljarna tycker | `#politik-valjarna` | Support in SCB's latest PSU (or election) as bars; over time as lines on request |
| Hur partierna röstar | `#politik-roster` | How often a party votes like each other party, per session |
| Vad partierna vill lägga pengar på | `#politik-budget` | The chosen parties' budgets compared with the government's, per expenditure area (grouped bars) |
| Vad politikerna pratar om | `#politik-tal` | Share of each party's issue words about one area, latest session as bars; over time as lines |
| Utforska själv | `#politik-utforska` | Every detailed view, grouped |
| Källor och metod | `#politik-kallor` | Sources, update dates, definitions, method, limitations, raw tables |

### The party bar

One row of party buttons sits above every politics page, like a slicer. Any number of parties
can be chosen; every chart then shows those parties side by side, and none chosen means all
parties. The choice is kept in the address (`#politik-budget?partier=S,V`) and in the session,
so it follows the reader from page to page, and "Visa alla" clears it.
`frontend/src/politik/partySelection.ts`.

### The dashboard

`#politik` fits one desktop screen. The budget comes first and largest: what the parties want
to spend compared with the government, as grouped bars per expenditure area, one bar per party.
Slicers above the cards choose the budget year, how many areas (top 5, 8, 12 or all), the order
(largest difference, most added, area number), the measure (SEK m or per cent of the
government's proposal) and what the latest survey is compared with (the previous survey or the
election); they are kept in the address like the parties. Around the budget: key figures (for
several parties, one comparison tile each), the latest survey as bars with a tick for the
comparison, who votes alike as a heat table (bars for one party), what the parties talk about as
a heat table, and the seats, where a click chooses a party. Figures count up, bars grow and cards
rise in one after another; with reduced motion nothing moves. `frontend/src/politik/dash/`.

Every other theme follows one template (`frontend/src/politik/ThemeLayout.tsx`): a question, why it
matters, at most three key figures, one chart, the main result in a sentence, "Vad betyder det
här?", the Graf / Tabell / Källor switch, and Fördjupa links. Themes whose data allows it have
"Bygg egen vy": a panel from the right offering only valid combinations (period, parties, issue
area, measure, normalisation, comparison, chart type); the choices are kept in the address,
e.g. `#politik-budget?partier=V&matt=procent`, so a view can be shared. Parties are chosen in
the party bar, not per theme.

### Where the earlier views went

The earlier views are unchanged and open as deep dives inside the product, under the theme they
belong to (`frontend/src/politik/nav.ts`):

| Earlier address | Now |
|---|---|
| `#now`, `#now-election` | Redirect to `#politik`; the seat calculator is the deep dive `#now-seats` |
| `#now-government`, `#now-news`, `#now-decisions`, `#now-issues`, `#issue-*`, `#now-laws`, `#now-studies` | Deep dives under Läget just nu |
| `#now-history` | Deep dive under Vad väljarna tycker |
| `#now-votes`, `#politics`, `#politics-votes`, `#politics-laws` | Deep dives under Hur partierna röstar |
| `#budget-comparison`, `#budget-proposals`, `#budget-explore`, `#budget-outturn`, `#taxes*` | Deep dives under Vad partierna vill lägga pengar på |
| `#debates` (language map), `#data-explorer` (speech archive) | Deep dives under Vad politikerna pratar om |
| `#parties`, `#parties-<code>`, `#now-depth` | Utforska själv |
| `#raw-data` | Källor och metod |
| `#about`, `#projects` | Redirect to `#om-mig`, `#projekt` |

The subject menu that sat above every analysis page ("Grafer & analyser") is gone: politics has
its own navigation, and the other projects (job market, welfare, DrugComb, …) have a link back to
the projects.

## The job-market product

*Jobbmarknaden i siffror* is built like the politics product, from `jobs/market.json`: every ad in Arbetsförmedlingen's historical archives since 2020, by month, occupation field, occupation group (SSYK 4) and county. `frontend/src/jobb/`.

- **Navigation:** seven themes in the side menu.

| Theme | Address | Main chart |
|---|---|---|
| Läget just nu | `#jobb` | A one-screen dashboard: key figures, ads per month (the large card), fields and occupations that grow, counties, terms |
| Hur utvecklas annonserna? | `#jobb-trender` | New ads per month as columns, or one small chart per field |
| Vilka yrken växer? | `#jobb-yrken` | Occupations growing or falling the most, or with the most ads |
| Var finns jobben? | `#jobb-lan` | Share of ads per county, with a county × year heat table |
| Vilka villkor? | `#jobb-villkor` | Employment type, working hours and experience required |
| Utforska själv | `#jobb-utforska` | The earlier views (`#job-market`, `#job-market-occupations`, …), which keep their addresses |
| Källor och metod | `#jobb-kallor` | The archives counted, with their SHA-256, and the method |

- **Field bar:** the occupation fields sit above every page, like the party bar. Any number can be chosen; every chart then answers for them, and none chosen means the whole market. The choice is kept in the address (`?omraden=id,id`) and in the session.
- **Comparisons:** the latest year is partial, so changes always compare the same months of the year before.
- **Growth list:** growth is only ranked for occupations that had at least the chosen number of ads a year earlier (25, 100 or 500), so a small occupation cannot top the list on a few ads.

## Design system

`frontend/src/design-system.css`, loaded last, with tokens in `styles.css`: Geist for text and
Geist Mono for figures and labels (self-hosted), five type sizes (`--fs-xs` … `--fs-xl`), tabular
figures everywhere, near-black on warm white, thin grey rules, square
corners, no shadows, gradients or blur. Colour carries meaning only: in the politics product it
means a party; navigation, buttons, issue areas and budget areas stay neutral.

### Parties

`frontend/src/parties/identity.tsx` (`partyMeta`) is the one place a party's look is set:
colour, line colour, text colour, logo, marker and line style. Colour is never the only cue:
line charts write the party's letters at the end of each line, and the parties that share a hue
differ in marker and line style (S/V red, M/KD/L blue, C/MP green); SD's yellow line has a dark
casing. Logos appear in pickers, table headers and summaries, never on data points. The logos
are the parties' current marks as Riksdagen publishes them, stored locally as WebP.
