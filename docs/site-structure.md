# Site structure and design

The site has two parts: the portfolio (the start page and one page per project) and the
politics product, *Svensk politik i siffror*. Swedish is the default language; English is one
click away and remembered.

## Navigation

Every page has the same header with four global destinations, and the name links home:

| Destination | What it is |
|---|---|
| **Projects ▾** | A menu: the five selected projects with number and one-line descriptor, then "View all projects" (`#alla-projekt`) |
| **Experience** | `#erfarenhet`, the experience section on the start page |
| **About** | `#om-mig`, about, education and contact on the start page |
| **CV ▾** | A menu with the three role-specific CVs in `public/cv/` (download) |

- **Every page:** the header looks the same, the name large across the top and the navigation under it. On the start page the name is the page's `h1`. The header scrolls away with the page; the politics side menu and slicer stick to the top of the screen.
- **Active state:** `aria-current` marks Projects on every project page and on `#alla-projekt`, Experience and About on their sections. A project's own views (politics themes, job-market themes, atlas sections) never become global destinations.
- **Menus:** disclosure buttons (`aria-expanded`, `aria-controls`); Escape closes and returns focus, as do a click outside and tabbing out.
- **Phone (below 860 px):** the global links are replaced by one Menu button that opens the same content in one panel: selected projects, all projects, Experience, About, the CVs. A new address closes it.

`frontend/src/site/Header.tsx`.

### One project registry

`frontend/src/projects/projectRegistry.ts` is the one list of projects. Each entry has an id,
title, descriptor, summary, question / built / result, tech, address, category (AI or data),
status, whether it is featured, and the routes that belong to it. Everything that lists projects
reads from it: the header menu, the start page's selected projects, the projects page, the
breadcrumb, previous / next and the footer. The tech-stack radar takes its evidence from it too.

Selected projects, in this order:

| # | Project | Address |
|---|---|---|
| 01 | Swedish politics in numbers | `#politik` |
| 02 | Job market in numbers | `#jobb` (the earlier `#job-market*` views belong to it) |
| 03 | Symbolic Atlas | `#symbolic-atlas` |
| 04 | How is Sweden doing? | `#sweden` (and `#analysis`) |
| 05 | Degree project | `#thesis` |

Everything else (DrugComb, taLLMan, Allegoria, DiVA, Homie, RAG, MIMII, IN1) is other work.

### Project pages

- **Breadcrumb** at the top: "Projects / <project>"; the supporting pages (architecture, data model, ER diagram, pipeline status, design system) read "Projects / Technical / <page>".
- **Previous / next** at the bottom of a selected project's page, in registry order; the first has no previous and the last no next. Other work has no pager.
- **Project sub-navigation** inside a project, under the header. The Symbolic Atlas has Atlas / Findings / Experiments / Method as anchors (`#symbolic-atlas`, `#symbolic-findings`, `#symbolic-experiments`, `#symbolic-method`); the politics and job-market products keep their own side menus. `frontend/src/projects/ProjectNav.tsx`.
- **Footer** on every page: Projects (the selected projects and All projects), Profile (Experience, About, CV, LinkedIn, GitHub) and Under the hood (architecture, data model, ER diagram).

### Route types

- **Global destinations:** `#start`, `#projekt`, `#erfarenhet`, `#kompetenser`, `#om-mig`, `#alla-projekt`.
- **Project destinations:** each registry entry's address.
- **Deep dives:** the views inside a project (`#politik-*`, `#jobb-*`, `#now-*`, `#symbolic-*`, …).
- **Legacy redirects** (`frontend/src/router.ts`): `#about`, `#contact`, `#kontakt` and `#utbildning` go to `#om-mig`; `#experience` to `#erfarenhet`; `#projects` to `#projekt`. Every earlier project address still opens its page.

## Start page

In the order a recruiter reads it (`frontend/src/home/HomePage.tsx`):

1. **Hero** (`#start`): one slim row with role, one sentence, and links to the projects, the CV, GitHub, LinkedIn and email.
2. **First screen, two columns:**
   - **left, Selected projects** (`#projekt`): one card per selected project with number, descriptor, summary and four tech tags, over its own live chart as a faded backdrop (stronger on hover), then a link to all projects;
   - **right, Experience** (`#erfarenhet`): one row per job, where a click opens what was done and with what, and the **education** under it.
3. **Tech stack** (`#kompetenser`): the eclipse radar as the picture (hover shows which projects use a tool) beside the tool groups.
4. **About** (`#om-mig`): about and contact.

Everything is on the page; nothing hides behind the radar. On a phone (and below 900 px) the two columns stack: projects, then experience and education.
The words live in `frontend/src/home/content.ts` and `orbitContent.ts`; every fact comes from the CVs.

A short name intro plays once per session when the start page is opened directly (never on a
deep link): organic clusters grown as branching filaments, with thin veins from each point to
its cluster's core, travel into the name, whose points are then stitched together by veins of
their own. Click, Enter or Escape skips it; with reduced motion it is a short fade.
`frontend/src/site/Intro.tsx`.

## Projects page

`#alla-projekt` (`frontend/src/projects/ProjectsPage.tsx`) has two tiers:

- **Selected work:** the five selected projects as a numbered list, each with its question, what was built, the result and the tech.
- **Other work:** the remaining projects as tiles, filterable by All / AI / Data.

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

The subject menu that sat above every analysis page ("Grafer & analyser") is gone: politics has
its own navigation, and every project page has the breadcrumb back to the projects.

## The job-market product

*Jobbmarknaden i siffror* is built like the politics product, from `jobs/market.json`: every ad in Arbetsförmedlingen's historical archives since 2020, by month, occupation field, occupation group (SSYK 4) and county. `frontend/src/jobb/`.

- **Navigation:** eight themes in the side menu.

| Theme | Address | Main chart |
|---|---|---|
| Läget just nu | `#jobb` | A one-screen dashboard: key figures, ads per month (the large card), fields and occupations that grow, counties, terms |
| Hur utvecklas annonserna? | `#jobb-trender` | New ads per month as columns, or one small chart per field |
| Vilka yrken växer? | `#jobb-yrken` | Occupations growing or falling the most, or with the most ads |
| Var finns jobben? | `#jobb-lan` | Share of ads per county, with a county × year heat table |
| Vilka villkor? | `#jobb-villkor` | Employment type, working hours and experience required |
| Vilka grupper bildar annonserna? | `#jobb-kluster` | The semantic clustering of IT ads (embeddings, UMAP, HDBSCAN) compared with job titles; also at `#job-market-clusters`. The field bar does not apply |
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

## taLLMan

`#tallman`: a source-critical chat about the Riksdag. It answers in claims that Allegoria checks against their sources. The code is in `frontend/src/tallman/` and the Worker in `worker/`; setup is in [tallman.md](tallman.md).

## Politics: the sidebar

The politics sidebar is in groups:

- **Översikt** (`#politik`).
- **Budget** (`#politik-budget`). The detailed builder view is at `#politik-budget-detalj`.
- **Partier** (`#politik-partier`): a card per party. Choosing one (a card, or the party bar) opens its dashboard:
  - key figures;
  - party leader and ministers;
  - Riksdag elections since 1973 and the latest surveys;
  - the municipal councils: gained, kept or lost seats per municipality, seats per county, where the party is strongest;
  - the Riksdag group: age, gender, constituencies, every member;
  - how it votes and with whom;
  - its budget motions;
  - its part in the party-leader debates and their topics.

  Members and councils come from `platform/publish/export_party_profiles.py` (`npm run politics:parties`), written to `politics/parties/`:
  - the Riksdag's list of people;
  - Valmyndigheten's municipal council results per municipality. The latest election may be partly preliminary; the page says how many municipalities are.
- **Debatter:**
  - **Sakdebatter** (`#politik-sakdebatter`);
  - **Partiledardebatter** (`#politik-partiledardebatter`);
  - **Vad de pratar om** (`#politik-tal`).
- **Mer:** voters, votes, explore, sources.

Budget and the two debate pages are scrolling dashboards in `frontend/src/politik/board/`: key figures, column charts (`Columns.tsx`, grouped, stacked or one small chart per party) and bars.

One debate opens at `#politik-debatt?typ=sak|partiledare&riksmote=…&id=…`. It shows:
- the order of speaking as a strip;
- speeches and replies per party;
- every exchange replik för replik, with who answers whom;
- what the debate was about.

**How debates are linked to issues** (`platform/publish/export_debates.py`, written to `politics/parliament/debate-stats/`):
- An issue debate whose title matches a Riksdag decision gets the committee report, each party's position on every decision point, and the committee's issue area. The decision files cover 2024/25 and later.
- Other debates, and each speech, get issue areas from word matches against the expenditure-area lexicon. These are marked with a dashed border.
