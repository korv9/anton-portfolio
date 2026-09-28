# Site structure and design

The site has two parts: the portfolio (the start page and one page per project) and the
politics product, *Svensk politik i siffror*. Swedish is the default language; English is one
click away and remembered.

## Start page

In reading order: a short presentation, about me, experience (Avtalat, Fora), technical skills
(five groups, the most important first, the rest under "Visa fler"), selected projects (the
politics product first and largest, then three more, with further projects under "Fler
projekt") and contact. The words live in `frontend/src/home/content.ts`; facts come from the CV
and the project catalogue.

A short name intro plays once per session when the start page is opened directly (never on a
deep link): the name drawn as an outline, filled, then moved into the header's wordmark. Click,
Enter or Escape skips it; with reduced motion it is a short fade. `frontend/src/site/Intro.tsx`.

## The politics product

One navigation with seven themes (a sidebar, a horizontal menu on small screens):

| Theme | Address | Main chart |
|---|---|---|
| Läget just nu | `#politik` | Seats in the Riksdag, the governing side and the 175 majority line |
| Vad väljarna tycker | `#politik-valjarna` | Support in SCB's PSU (or election results) over time |
| Hur partierna röstar | `#politik-roster` | How often a party votes like each other party, per session |
| Vad partierna vill lägga pengar på | `#politik-budget` | A party's budget compared with the government's, per expenditure area |
| Vad politikerna pratar om | `#politik-tal` | Share of each party's issue words about one area, per session |
| Utforska själv | `#politik-utforska` | Every detailed view, grouped |
| Källor och metod | `#politik-kallor` | Sources, update dates, definitions, method, limitations, raw tables |

Every theme follows one template (`frontend/src/politik/ThemeLayout.tsx`): a question, why it
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

`frontend/src/design-system.css`, loaded last: Helvetica (`"Helvetica Neue", Helvetica, Arial,
sans-serif`) with tabular figures everywhere, near-black on warm white, thin grey rules, square
corners, no shadows, gradients or blur. Colour carries meaning only: in the politics product it
means a party; navigation, buttons, issue areas and budget areas stay neutral.

### Parties

`frontend/src/parties/identity.tsx` (`partyMeta`) is the one place a party's look is set:
colour, line colour, text colour, logo, marker and line style. Colour is never the only cue:
line charts write the party's letters at the end of each line, and the parties that share a hue
differ in marker and line style (S/V red, M/KD/L blue, C/MP green); SD's yellow line has a dark
casing. Logos appear in pickers, table headers and summaries, never on data points. The logos
are the parties' current marks as Riksdagen publishes them, stored locally as WebP.
