# Project structure

The project pages use the homepage's Manrope typography and ivory background. A shared header replaces the sidebar. Its project menu groups the eleven retained projects into Observatories, Labs and Engineering. Cluster Visuals remains a separate tool in the menu.

## Projects and navigation

| Group         | Projects                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Observatories | Political Observatory, Labour Market Observatory, Wellbeing Observatory, EU AI Act Observatory |
| Labs          | Symbol Lab, Philosophy Lab, Concept Lab, Drug Synergy Lab                                      |
| Engineering   | IT Incident Clustering, Homie API, DiVA Thesis Lakehouse                                       |

Observatory overview pages are topic indexes. Topic pages contain the charts and their controls. Labs use section links where the material belongs in a continuous report. Detail readers for speeches, debates, articles and individual concepts remain separate views.

Project topics are defined in `frontend/src/projects/topics.ts`. Project names, descriptions and menu grouping come from `projectRegistry.ts`. The header, homepage and previous/next project links use this registry.

## Layout and copy

Charts sit on open page surfaces. Filters and technical detail may have a bounded area. Chart headings describe the measure; captions retain source, unit, period and comparison basis. Repeated inventory KPI rows were removed from AI Act, the atlas pages and wellbeing. Theme pages no longer add a separate KPI row and repeat its values as a takeaway.

The decorative debate background remains on the homepage. Analytical pages have a quiet ivory canvas. Large map projections retain their reading key. Optional data and settings are grouped beneath the figure. Technical methods use native disclosures, with only available schema views offered.

The degree project now separates its incident-to-candidate workflow, silhouette comparison, preparation, clustering and review limits. Drug Synergy Lab opens with model performance by test split, followed by its biological context and exploratory views. No new model run or invented result was added.

Wellbeing has work, sick leave, mental health/quality of life and regional comparison views. Its county reference is labelled as a total-population-weighted county mean. Each source retains its own population definition.

## Removed views

The platform pages (quality, data model/ER, architecture, catalogue and Idea Lineage), RAG assistant, industrial pump project, DiVA topic clustering and Allegoria are removed from the website. Their old addresses lead to the project index. Shared schema access, quality components, trace data and backend pipelines needed by retained projects remain.

Unused page components and their CSS were removed. The older job-market page was replaced by topic pages; its shared types and labels live in `jobs/market.ts`. Obsolete page tests were removed or replaced with tests of the new navigation. Retired project ids remain accepted by the append-only idea journal so historical records remain readable.
