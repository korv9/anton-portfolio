# Site structure and design

The site has two parts: the portfolio (the start page and one page per project) and the
politics product, *Svensk politik i siffror*. Swedish is the default language; English is one
click away and remembered.

## Navigation

Every page has the same header with four global destinations, and the name links home:

| Destination | What it is |
|---|---|
| **Projects ▾** | A menu: the six selected projects with number and one-line descriptor, then "View all projects" (`#alla-projekt`) |
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
| 02 | EU AI Act Observatory | `#ai-act` and its views `#ai-act-*` ([ai-act.md](ai-act.md)) |
| 03 | Job market in numbers | `#jobb` (the earlier `#job-market*` views belong to it) |
| 04 | Symbolic Atlas | `#symbolic-atlas` |
| 05 | How is Sweden doing? | `#sweden` (and `#analysis`) |
| 06 | Degree project | `#thesis` |

Supporting technical page: Quality & Validity (`#quality`, [quality-and-validity.md](quality-and-validity.md)), linked from the footer (Under the hood), Data Constellation and each product's *Quality & validity* section.

Experimental, not featured: Philosophy Atlas (`#philosophy-atlas`, [philosophy-atlas.md](philosophy-atlas.md)) and Concept Constellation (`#concept-constellation`, concept pages `#concept-<id>`, [concept-constellation.md](concept-constellation.md)).

Everything else (DrugComb, taLLMan, Allegoria, DiVA, Homie, RAG, MIMII, IN1) is other work.

### Project pages

- **Breadcrumb** at the top: "Projects / <project>"; the supporting pages (architecture, data model, ER diagram, pipeline status, design system) read "Projects / Technical / <page>".
- **Previous / next** at the bottom of a selected project's page, in registry order; the first has no previous and the last no next. Other work has no pager.
- **Project sub-navigation** inside a project, under the header. The Symbolic Atlas has Atlas / Findings / Experiments / Method as anchors (`#symbolic-atlas`, `#symbolic-findings`, `#symbolic-experiments`, `#symbolic-method`); the EU AI Act Observatory has Overview / Today / Timeline / Who does it apply to? / Risk classes / Obligations / Startup navigator / In the Riksdag / Changes / Sources as pages (`#ai-act`, `#ai-act-today`, …), plus an article reader at `#ai-act-article?a=<number>`; the politics and job-market products keep their own side menus. `frontend/src/projects/ProjectNav.tsx`.
- **Footer** on every page: Projects (the selected projects and All projects), Profile (Experience, About, CV, LinkedIn, GitHub) and Under the hood (architecture, data model, ER diagram).

### Route types

- **Global destinations:** `#start`, `#projekt`, `#erfarenhet`, `#kompetenser`, `#om-mig`, `#alla-projekt`.
- **Platform map:** `#data-constellation` (Data Constellation, [data-constellation.md](data-constellation.md)), linked from the Projects menu, the start page's Under the hood section and the footer; its breadcrumb reads "Projects / Technical / Data Constellation".
- **Project destinations:** each registry entry's address.
- **Deep dives:** the views inside a project (`#politik-*`, `#jobb-*`, `#now-*`, `#symbolic-*`, `#ai-act-*`, …).
- **Legacy redirects** (`frontend/src/router.ts`): `#about`, `#contact`, `#kontakt` go to `#om-mig`; `#experience` and `#utbildning` to `#erfarenhet`; `#projects` to `#projekt`. Every earlier project address still opens its page.

## Start page

Simple first, depth on demand. The start page is a recruiter-facing summary; the project pages
carry the depth, and the technical pages (Data Constellation, Quality & Validity) the platform
detail. The start page is deliberately plainer than the project pages.

In the order a recruiter reads it (`frontend/src/home/HomePage.tsx`): what has been built
comes first.

1. **Hero** (`#start`): the role (Data Engineer · Analytics Engineer · Applied AI), one
   sentence on what I build, then *Selected work*, *Download CV (PDF)*, GitHub and LinkedIn.
   No tool list here; the core stack sits further down.
2. **Selected work** (`#projekt`): the five projects in `HOME_PROJECTS` (registry entries with
   a `home` field), numbered 01–05. Each row leads with the project's question and its finding
   in a sentence; the tech is a quiet line under them. Each row's live chart is a faded
   backdrop that loads only when the row comes into view (`LazyPreview`), and never at 760 px
   or below.
3. **Experience** (`#erfarenhet`) beside **Education** (`#utbildning`) and the **Core stack**
   (`#kompetenser`): impact visible, the details and the full stack behind a click.
4. **About** (`#om-mig`): two sentences and contact.
5. **Under the hood** (`#under-huven`): Data Constellation, Quality & Validity and All projects.

The header and its navigation stay on screen on every page (`position: sticky`); once the page
scrolls the header folds to one slim row with the name beside the navigation, and its height is
published as `--header-h` so sticky elements below it (a product's sidebar) sit under it.
Links carry no arrows.

On a phone (and below 900 px) the profile columns stack: experience, then education and the core stack.
The words live in `frontend/src/home/content.ts`, `orbitContent.ts` and the `home` lines in
`projects/projectRegistry.ts`; every fact comes from the CVs.

A short name intro (about two seconds) plays once per session when the start page is opened
directly, never on a deep link. Click, Enter or Escape skips it; with reduced motion it is
skipped. `frontend/src/site/Intro.tsx`.

## Projects page

`#alla-projekt` (`frontend/src/projects/ProjectsPage.tsx`) has three tiers:

- **Selected work:** the selected projects as a numbered list, each with its question, what was
  built, the result and the tech.
- **Other work:** the remaining projects as tiles, filterable by All / AI / Data.
- **Research & experiments:** exploratory work (registry entries with `research: true`:
  Philosophy Atlas, Concept Constellation, Allegoria), kept off the start page.

## The politics product

One navigation with seven themes (a sidebar, a horizontal menu on small screens):

| Theme | Address | Main chart |
|---|---|---|
| Översikt | `#politik` | The overview: a question, its answer, one chart (below) |
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

### The overview

`#politik` reads first and explores second (`frontend/src/politik/story/Story.tsx`):

1. **The question** *What separates the parties in practice?*, answered in one sentence from
   the roll calls (the most divided policy area, the most and least alike pair), with its
   source line.
2. **What is the political situation right now?** The government, the seats against the
   majority line, the latest election, roll call and party-leader debate, and the change in
   seats since the election before.
3. **Where do the parties differ most?** One chart: polarisation per policy area, with a
   finding, its source and *What this means / What it does not mean*. Who votes with whom
   (the similarity matrix, a pair to compare, the most divided roll calls) is under
   *Explore: who votes with whom*.
4. **What should you explore next?** Editorial links to How the parties vote, What they talk
   about, Budget, The parties and What voters think.
5. **More analyses** (folded): decisions and cohesion, one party's fingerprint, the
   party-leader debates, the members and the voting map. A choice in the address
   (`?parti=`, `?debatt=`, `?ledamot=`) opens it.
6. **Sources, method and data quality** (folded): the diagnostics (seats, roll calls,
   cohesion), the pipeline, definitions and the quality profile; then *How it was built*.

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
| Läget just nu | `#jobb` | A demand story: *How is demand for labour changing?* answered by the change against the same months a year earlier, ads per month as the one main chart with its interpretation, which roles are growing, where the clustering fits, then the treemap, counties and terms under Explore |
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

Tokens, type, colour, plates, buttons and states are described in
[design-system.md](design-system.md); `frontend/src/tokens.css` defines them. Colour carries
meaning only: in the politics product it means a party; navigation, buttons, issue areas and
budget areas stay neutral.

Every page names itself in the browser tab ("<page> · Anton Ernstsson"), and the breadcrumb
always ends at the page. `frontend/tests/routes.spec.ts` opens every internal link the site
shows and fails if one falls back to the homepage, has no title or stops the breadcrumb at
"Projects".

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

## Data storytelling

Every flagship follows one hierarchy: question → answer → one main visual → interpretation →
explore → method. The first four are the reading experience; filters, tables, diagnostics
and sources sit below them or in folds. The shared pieces are in `frontend/src/ui/Story.tsx`
(`DataQuestion`, `FindingHero`, `ChartSection`, `Interpretation`, `SourceCaption`,
`ExploreSection`, `StoryNext`, `MethodSummary`); [data-storytelling.md](data-storytelling.md)
has the audit of each flagship and the rules.
