# Site structure and design

The site has two parts: the portfolio (the start page and one page per project) and the
politics product, *Svensk politik i siffror*. Swedish is the default language; English is one
click away and remembered.

## Start page

One page in two columns, built so a recruiter has the picture in ten seconds:

- **Left, fixed:** name, role, one sentence on what Anton does, availability, a table of
  contents (01 Översikt … 07 Kontakt) that marks the section being read, the three CVs (Data
  Engineer, Data Scientist / Applied AI, Python / AI Platform, in `public/cv/`) and links.
- **Right, read top to bottom:** Översikt (four facts from the CVs and "which role are you
  hiring for?" with the matching CV), Om mig, Erfarenhet (Avtalat, Fora, Delicato), Projekt (the
  politics product first, then every other project; nothing hidden), Kompetenser (six groups,
  all visible), Utbildning, Kontakt.
- On a phone the left column dissolves into the page and the contents become a sticky bar.

The words live in `frontend/src/home/content.ts`; every fact comes from the CVs.

A short name intro plays once per session when the start page is opened directly (never on a
deep link). Click, Enter or Escape skips it; with reduced motion it is a short fade.
`frontend/src/site/Intro.tsx`.

## The politics product

One navigation with seven themes (a sidebar, a horizontal menu on small screens):

| Theme | Address | Main chart |
|---|---|---|
| Läget just nu | `#politik` | A one-screen dashboard (below) |
| Vad väljarna tycker | `#politik-valjarna` | Support in SCB's PSU (or election results) over time |
| Hur partierna röstar | `#politik-roster` | How often a party votes like each other party, per session |
| Vad partierna vill lägga pengar på | `#politik-budget` | A party's budget compared with the government's, per expenditure area |
| Vad politikerna pratar om | `#politik-tal` | Share of each party's issue words about one area, per session |
| Utforska själv | `#politik-utforska` | Every detailed view, grouped |
| Källor och metod | `#politik-kallor` | Sources, update dates, definitions, method, limitations, raw tables |

### The dashboard

`#politik` is a dashboard that fits one desktop screen: six key figures, three lines on what to
keep an eye on, and six cards (seats, polls, who a party votes like, its budget compared with the
government's, what it talks about most, the news). The parties are listed at the side of every
politics page; choosing one focuses every card on it, and the choice is kept in the address
(`#politik?parti=SD`). Figures count up, bars grow, lines draw and cards rise in one after
another; a new party glides into place. With reduced motion nothing moves.
`frontend/src/politik/dash/`.

Every other theme follows one template (`frontend/src/politik/ThemeLayout.tsx`): a question, why it
matters, at most three key figures, one chart, the main result in a sentence, "Vad betyder det
här?", the Graf / Tabell / Källor switch, and Fördjupa links. Themes whose data allows it have
"Bygg egen vy": a panel from the right offering only valid combinations (period, parties, issue
area, measure, normalisation, comparison); the choices are kept in the address, e.g.
`#politik-budget?parti=V&matt=procent`, so a view can be shared.

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
