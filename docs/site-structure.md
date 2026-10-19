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
| `#sweden-framtid` | E The Lost Futures | Pipeline pending |
| `#sweden-samband` | Connections | Pending |

The Wellbeing Observatory moved from `#sweden*` to `#wellbeing*`. Its old addresses
(`#sweden-health`, `#sweden-counties` and the others) redirect.

## Projects and navigation

The homepage holds the identity, profile, experience and project index. A shared header
replaces the old sidebar. Its project menu groups the twelve projects, and Cluster Visuals sits
beside them as a separate tool.

| Group         | Projects                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Observatories | Political Observatory, Labour Market Observatory, Compliance Intelligence, Wellbeing Observatory, EU AI Act Observatory, Swedish Statute Book |
| Labs | Symbol Lab, Philosophy Lab, Concept Lab, Ask the law, Drug Synergy Lab |
| Engineering | IT Incident Clustering, Homie API, DiVA Thesis Lakehouse |

Each project has an entry page. Political Observatory opens as five analytical areas, with shared party selection and
source readers behind them. The other observatories retain their report tabs, each with
an address of its own. Labs and engineering projects are continuous
reports with section addresses. Readers for one speech, debate, article or concept are separate
views. Previous and next links follow the menu's group order.

Two pages use Cloudflare Workers AI ([workers-ai.md](workers-ai.md)). Ask the law (`#fraga-lagen`)
answers questions over Swedish statutes or the EU AI Act; `?korpus=ai-act` picks the AI Act.
On `#cluster-visuals`, the card `#cv-place` places a reader's sentence on the party-leader debate
map.

## Where it is defined

| What                                                                  | File                                       |
| --------------------------------------------------------------------- | ------------------------------------------ |
| Project names, descriptions, addresses and menu grouping              | `frontend/src/projects/projectRegistry.ts` |
| Topic links under each project                                        | `frontend/src/projects/topics.ts`          |
| Hash routing, report tabs, deep dives and redirects for old addresses | `frontend/src/router.ts`                   |
| Shared report frame                                                   | `frontend/src/report/ReportShell.tsx`      |

Routes are `#path` with optional query parameters, so a chosen view can be shared as a link.

## Layout and copy

Observatory charts use bounded analytical panels. Labs and engineering keep wide figures
and open comparisons; filters and technical detail may have a bounded area. A
chart heading names the measure; its caption keeps source, unit, period and comparison basis.
Technical methods use native disclosures. Analytical pages have a warm-grey canvas, and the
decorative debate background stays on the homepage. Large map projections keep their reading
key.

The Wellbeing county reference is a mean of the counties weighted by total population, and is
labelled that way. Each source keeps its own population definition.

## Retired views

The platform pages (quality, data model and ER, architecture, catalogue, Idea Lineage), the RAG
assistant, the industrial pump project, DiVA topic clustering and Allegoria are off the
website. Their addresses lead to the project index (`REDIRECTS` in `router.ts`). The pipelines,
schema access, quality checks and trace data that the remaining projects use are still in the
repository, and so are their documents: [quality-and-validity.md](quality-and-validity.md),
[data-constellation.md](data-constellation.md) and [idea-lineage.md](idea-lineage.md).

Retired project ids are still accepted by the append-only idea journal, so old records stay
readable.

## Visual workspace ownership

The project groups also determine `data-workspace` on the app shell: `observatories`,
`labs` or `engineering`. Standalone views use `tool`. `ReportShell`, `Stage`, `ProjectHero`,
`Feature` and the existing dashboard kit provide the four patterns documented in
[design-system.md](design-system.md). This classification changes presentation only.
The homepage keeps its own token scope and composition; shared project styling is scoped
to `.project-shell`.

## Political Observatory v2

The five routes are `#politik`, `#politik-val`, `#politik-riksdag`, `#politik-budget` and
`#politik-tal`. The scoped workspace lives in `frontend/src/politik/workspace/`. Existing
research views and old aliases remain available. See [Political Observatory v2](political-observatory-v2.md)
for filter semantics, evidence relationships, retained routes and coverage. The homepage and
shared site header were not changed by this migration.
