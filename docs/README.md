# Documentation

One document per topic. Each one describes the system as it is. Finished plans, audits and
run logs are removed once their content is in the document that owns the topic; Git history
keeps them. Task lists, inventories and plans for unbuilt work are not kept here. Documents are in English or Swedish, whichever they were written in (marked sv).

The repository overview is in the [root README](../README.md). Folder guides:
[platform](../platform/README.md), [ml](../ml/README.md), [frontend](../frontend/README.md),
[configs](../configs/README.md), [scripts](../scripts/README.md), [infra](../infra/README.md).

## Start here

1. [Platform case study](case-studies/platform.md): the problem, the decisions, what failed
2. [Pipeline](platform/pipeline.md): how a subject gets from source to release
3. [Job assistant](products/jobs/job-assistant.md): the second flagship, end to end
4. [Quality and validity](platform/quality-and-validity.md): what the checks prove and what they do not
5. [Development workflow](platform/development.md): verification levels and workspaces

## Platform (`platform/`)

| Document | Covers |
|---|---|
| [pipeline.md](platform/pipeline.md) | `platform/pipeline.py`, the subject registry, schedules, workflows, secrets |
| [gold-semantic-model.md](platform/gold-semantic-model.md) | The politics gold layer: tables, grains, keys, joins and measures |
| [quality-and-validity.md](platform/quality-and-validity.md) | Data quality checks and construct validity analyses, kept apart |
| [data-constellation.md](platform/data-constellation.md) | The provenance graph built by `platform/architecture/` and the feed's Trace data |
| [parliament-data-model.md](platform/parliament-data-model.md) | Elections, governments, roll calls, bills and studies |
| [budget-provenance.md](platform/budget-provenance.md) | Budget years and whose proposal each column is |
| [welfare-data-model.md](platform/welfare-data-model.md) | Five welfare sources in one star schema (sv) |
| [analysis-guide.md](platform/analysis-guide.md) | Which welfare table to use, and how each measure aggregates |
| [taxes.md](platform/taxes.md) | OECD and Skatteverket tax data and their checks |
| [news.md](platform/news.md) | Political news feeds, tagging and export |
| [storage-and-serving.md](platform/storage-and-serving.md) | Where data is stored, the catalogue, how the site resolves a data path |
| [r2-delivery-contract.md](platform/r2-delivery-contract.md) | Versioned R2 releases: groups, specs, activation, rollback, retention (sv) |
| [delivery-validation.md](platform/delivery-validation.md) | Content checks on the jobs, news and DiVA deliveries before release (sv) |
| [development.md](platform/development.md) | Verification levels, logs and the workspace lifecycle |
| [deploy.md](platform/deploy.md) | Cloudflare hosting, previews, one-time setup, secrets, limits |
| [security.md](platform/security.md) | Security checks, locks and headers |
| [package.md](platform/package.md) | The platform as an installable Python package |
| [idea-lineage.md](platform/idea-lineage.md) | The idea journal, the `ideas:*` commands and the Stop hook |

## Products (`products/`)

| Document | Covers |
|---|---|
| [jobs/job-assistant.md](products/jobs/job-assistant.md) | The job assistant: CV profile, hourly matching, evidence model, delivery |
| [jobs/job-market.md](products/jobs/job-market.md) | Every JobTech ad since 2020: archives and the daily stream |
| [jobs/job-ads-airflow.md](products/jobs/job-ads-airflow.md) | Job ads every ten minutes with Airflow; not the production scheduler |
| [jobs/job-assistant-evaluation.md](products/jobs/job-assistant-evaluation.md) | Manual evaluation of the matches, 2026-10-27 |
| [jobs/job-intelligence.md](products/jobs/job-intelligence.md) | Job Intelligence: company resolution and ranking; not routed |
| [ai-act/ai-act.md](products/ai-act/ai-act.md) | EU AI Act data: articles, actors, obligations and dates |
| [ai-act/ai-politics.md](products/ai-act/ai-politics.md) | AI in Riksdag speeches and similarity to the Act's text |
| [ai-act/ai-jobs.md](products/ai-act/ai-jobs.md) | AI governance terms in job ads |
| [ai-act/ai-governance-timeline.md](products/ai-act/ai-governance-timeline.md) | The Act, the Riksdag and job ads on one time axis |
| [allegora/workers-ai.md](products/allegora/workers-ai.md) | Ask the law and the sentence placer on Workers AI (sv) |
| [allegora/allegora-gcp.md](products/allegora/allegora-gcp.md) | Allegora (`#fraga-lagen`): search over every law in force on Google Cloud, answers in the Worker (sv) |
| [labs/symbolic-atlas.md](products/labs/symbolic-atlas.md) | Symbol Lab: symbol words in a public-domain corpus |
| [labs/philosophy-atlas.md](products/labs/philosophy-atlas.md) | Philosophy Lab: thirteen works mapped by meaning |
| [labs/concept-layer.md](products/labs/concept-layer.md) | The shared concept layer across four text corpora |
| [labs/concept-constellation.md](products/labs/concept-constellation.md) | Concept Lab's exploring view |
| [labs/concept-journey.md](products/labs/concept-journey.md) | Concept Lab's reading view |
| [compliance-intelligence/](products/compliance-intelligence/README.md) | Compliance research workflow, cohort, gates and risks; not routed |

DrugComb and the Homie API are documented beside their pinned sources in
[platform/products/](../platform/products/README.md).

## Site (`site/`)

| Document | Covers |
|---|---|
| [site-structure.md](site/site-structure.md) | Pages, navigation, routing and retired addresses |
| [design-system.md](site/design-system.md) | The live visual direction, tokens, chart forms and the site-wide checks |
| [data-storytelling.md](site/data-storytelling.md) | The order a page presents question, answer, visual and method |

## SWEDEN (`sweden/`)

| Document | Covers |
|---|---|
| [design.md](sweden/design.md) | The SWEDEN research pages: routes, template, lineage, statistical conventions |
| [atlas.md](sweden/atlas.md) | The SWEDEN 3D atlas and its data slots |
| [data-source-strategy.md](sweden/data-source-strategy.md) | Candidate sources for SWEDEN and what each would answer |

## Research (`research/`)

| Document | Covers |
|---|---|
| [ml-feature-engineering.md](research/ml-feature-engineering.md) | Engineered features against the plain baseline |
| [ml-gate-amendments.md](research/ml-gate-amendments.md) | Dated changes to how a model or champion is judged, and their outcomes |
| [clustering/method.md](research/clustering/method.md) | The shared protocol, the runner measurements, the Cluster Visuals experiments view and the public-research method (sv) |
| [clustering/philosophy.md](research/clustering/philosophy.md) | Results for Philosophy Lab |
| [clustering/symbolic.md](research/clustering/symbolic.md) | Results for Symbol Lab |
| [clustering/jobs.md](research/clustering/jobs.md) | Job ads: the MLOps pipeline, and the 2022–2025 research corpus with its sweep and ensemble |
| [clustering/debates.md](research/clustering/debates.md) | Replik and the party-leader debates |
| [clustering/regions.md](research/clustering/regions.md) | Municipalities and counties (sv) |
| [clustering/atlas.md](research/clustering/atlas.md) | Six corpora in one space: versions 1 and 2, links, the dimension-reduction benchmark |
| [clustering/batches.md](research/clustering/batches.md) | Clustering batches, their statuses and what may be posted |

Pre-registrations (`research/preregistrations/`) are dated commitments and are never edited after the fact:
[AI Act diffusion](research/preregistrations/ai-act-diffusion-preregistration.md),
[Old Bailey extraction](research/preregistrations/oldbailey-extraction-preregistration.md),
[moral foundations](research/preregistrations/philosophy-moral-preregistration.md),
[SWEDEN connections](research/preregistrations/sweden-connections-preregistration.md),
[futures topics](research/preregistrations/sweden-futures-topics-preregistration.md),
[three spaces](research/preregistrations/sweden-three-spaces-preregistration.md).
The [2026-10-21 statistical research plan](research/preregistrations/sweden-statistical-research-plan.md)
is kept beside them because the SWEDEN connections pre-registration cites it.

## History

| Document | Covers |
|---|---|
| [case-studies/platform.md](case-studies/platform.md) | The platform: problem, decisions, failures, measured size |
| [incidents/](incidents/) | Postmortems; open findings are listed in the document that owns the topic |
| [decisions/DECISIONS.md](decisions/DECISIONS.md) | Decisions in force, generated from the Idea Lineage journal |
| [decisions/DATA_DECISIONS.md](decisions/DATA_DECISIONS.md) | The data decisions among them |
| [idea-lineage/](idea-lineage/README.md) | The same history per project, generated |

## Checking a document

```sh
python .claude/skills/de-ai-writing/scripts/check_ai_signs.py docs/<folder>/<file>.md
```
