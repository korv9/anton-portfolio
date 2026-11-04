# Site structure

How the site is organised and which file decides what. The visual direction is in
[design-system.md](design-system.md); how a page orders its content is in
[data-storytelling.md](data-storytelling.md).

## SWEDEN research platform

SWEDEN (`#sweden`) is the featured research platform. It has five research products and a
Connections page, and its design is described in [sweden-design.md](sweden-design.md).

| Route | Product | Status |
|---|---|---|
| `#sweden-matning` | A Politics of Measurement | Findings (SCB and Kolada catalogues) |
| `#sweden-arbete` | B The Ideal Human | Findings for counted archive years; the full backfill runs weekly |
| `#sweden-likhet` | C The Invisible Sweden | Findings (the 2024 clustering of 280 municipalities) |
| `#sweden-tillhorighet` | D The Infrastructure of Belonging | Findings (KB library statistics, 2014 onward) |
| `#sweden-framtid` | E The Lost Futures | Findings (Riksdag speeches 1993/94–2025/26; DiVA not yet counted) |
| `#sweden-samband` | Connections | Three relationships computed, two joins rejected |

The Wellbeing Observatory's old addresses (`#sweden-health`, `#sweden-counties` and the
others) and `#wellbeing*` redirect to `#what-does-it-even-mean`.

## Projects and navigation

The homepage holds the identity with links to the projects, CV, GitHub and LinkedIn, then
About, Selected work, experience and education, and a link to the projects beside the job-ads
map. The shared header (`frontend/src/site/SiteHeader.tsx`) links to About and GitHub.

The rail on every project page (`GROUPS` in `frontend/src/site/ProjectRail.tsx`) has Overview
on top and three groups. `PROJECT_GROUPS` in `projectRegistry.ts` holds the same groups by
project id:

| Group                   | Projects                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Research on public data | Replik, SWEDEN, When does a law arrive?                                                                                     |
| Engineering             | IT Incident Clustering, Arbetsförmedla                                                                                      |
| Experiments             | Allegora, Philosophy Lab, Symbol Lab, Concept Lab, Drug Synergy Lab, Cluster Visuals, What does it even mean? (chart feed) |

Homie API is not listed, but `#homie` still opens its page. Overview (`#projects`, also
`#projekt`) tells the platform case study as prose with a flow diagram and ends with the project
index: every project on one line, with "experimental" after each experiment. The "Written up"
links to the case study and the two postmortems were removed on 2026-11-04.

Each project has an entry page. Projects are continuous reports with section addresses.
Readers for one speech, debate, article or concept are separate views. Previous and next links
follow the group order.

Two pages use Cloudflare Workers AI ([workers-ai.md](workers-ai.md)). Ask the law (`#fraga-lagen`)
answers questions over Swedish statutes or the EU AI Act; `?korpus=ai-act` picks the AI Act.
Ask the platform's page was removed on 2026-11-01, and `#ask-platform` now leads to `#projects`.
The demo that places a reader's sentence on the party-leader debate map is on `#replik`;
`#cv-place` leads there.

## Where it is defined

| What                                                                  | File                                       |
| --------------------------------------------------------------------- | ------------------------------------------ |
| Project names, descriptions, addresses and menu grouping              | `frontend/src/projects/projectRegistry.ts` |
| Hash routing, report tabs, deep dives and redirects for old addresses | `frontend/src/router.ts`                   |
| Shared report frame                                                   | `frontend/src/report/ReportShell.tsx`      |

Routes are `#path` with optional query parameters, so a chosen view can be shared as a link.

## Layout and copy

Labs and engineering keep wide figures and open comparisons; filters and technical detail may
have a bounded area. A chart heading names the measure; its caption keeps source, unit, period and comparison basis.
Technical methods use native disclosures. Analytical pages have a warm-grey canvas, and the
decorative debate background stays on the homepage. Large map projections keep their reading
key.

## Retired views

The platform pages (quality, data model and ER, architecture, catalogue, Idea Lineage), the RAG
assistant, the industrial pump project, DiVA topic clustering and Allegoria are off the
website. Their addresses lead to the project index (`REDIRECTS` in `router.ts`). The pipelines,
schema access, quality checks and trace data that the remaining projects use are still in the
repository, and so are their documents: [quality-and-validity.md](quality-and-validity.md),
[data-constellation.md](data-constellation.md) and [idea-lineage.md](idea-lineage.md).

The observatories (politics, the labour market, Job Intelligence and Compliance Intelligence,
wellbeing, the EU AI Act, taxes and budget, the Swedish Statute Book) were withdrawn on
2026-10-21. Their addresses, and `/companies/*`, lead to `#what-does-it-even-mean`
(`PREFIX_REDIRECTS` in `router.ts`). `frontend/src/{compliance,companies,job-intelligence}` stay
unrouted because the build checks read them.

Retired project ids are still accepted by the append-only idea journal, so old records stay
readable.

## Visual workspace ownership

`PROJECT_WORKSPACE` in `projectRegistry.ts`, not the rail groups, sets `data-workspace` on the
app shell (`App.tsx`): `labs` or `engineering`, `sweden` for the SWEDEN pages and the chart feed, and `tool` for everything else.
`ReportShell`, `Stage`, `ProjectHero`, `Feature` and the dashboard kit provide the patterns
documented in [design-system.md](design-system.md). This classification changes presentation
only. The homepage keeps its own token scope and composition; shared project styling is scoped
to `.project-shell`.
