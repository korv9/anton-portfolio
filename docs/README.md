# Documentation

One document per topic. Each one describes the system as it is. Finished plans, audits and
run logs are removed once their content is in the document that owns the topic; Git history
keeps them. Documents are in English or Swedish, whichever they were written in (marked sv).

The repository overview is in the [root README](../README.md). Folder guides:
[platform](../platform/README.md), [ml](../ml/README.md), [frontend](../frontend/README.md),
[configs](../configs/README.md), [scripts](../scripts/README.md), [infra](../infra/README.md).

## Start here

1. [Platform case study](case-studies/platform.md): the problem, the decisions, what failed
2. [Pipeline](pipeline.md): how a subject gets from source to release
3. [Job assistant](job-assistant.md): the second flagship, end to end
4. [Quality and validity](quality-and-validity.md): what the checks prove and what they do not
5. [Development workflow](development.md): verification levels and workspaces

## Platform

| Document | Covers |
|---|---|
| [pipeline.md](pipeline.md) | `platform/pipeline.py`, the subject registry, schedules, workflows, secrets |
| [gold-semantic-model.md](gold-semantic-model.md) | The politics gold layer: tables, grains, keys, joins and measures |
| [data-dictionary.md](data-dictionary.md) | Historical: delivered tables and columns as of 2026-10-22; its generator, `platform/legacy/generate_data_dictionary.py`, no longer runs (sv) |
| [quality-and-validity.md](quality-and-validity.md) | Data quality checks and construct validity analyses, kept apart |
| [data-constellation.md](data-constellation.md) | The provenance graph built by `platform/architecture/` and the feed's Trace data |
| [parliament-data-model.md](parliament-data-model.md) | Elections, governments, roll calls, bills and studies |
| [budget-provenance.md](budget-provenance.md) | Budget years and whose proposal each column is |
| [welfare-data-model.md](welfare-data-model.md) | Five welfare sources in one star schema (sv) |
| [analysis-guide.md](analysis-guide.md) | Which welfare table to use, and how each measure aggregates |
| [taxes.md](taxes.md) | OECD and Skatteverket tax data and their checks |
| [news.md](news.md) | Political news feeds, tagging and export |
| [job-market.md](job-market.md) | Every JobTech ad since 2020: archives and the daily stream |

## Delivery

| Document | Covers |
|---|---|
| [storage-and-serving.md](storage-and-serving.md) | Where data is stored, the catalogue, how the site resolves a data path |
| [r2-delivery-contract.md](r2-delivery-contract.md) | Versioned R2 releases: groups, specs, activation, rollback, retention (sv) |
| [delivery-validation.md](delivery-validation.md) | Content checks on the jobs, news and DiVA deliveries before release (sv) |

## Products

| Document | Covers |
|---|---|
| [job-assistant.md](job-assistant.md) | The job assistant: CV profile, hourly matching, evidence model, delivery |
| [job-ads-airflow.md](job-ads-airflow.md) | Job ads every ten minutes with Airflow: stages, lock, the cluster model register, measurements; not the production scheduler |
| [job-assistant-evaluation.md](job-assistant-evaluation.md) | Manual evaluation of the matches, 2026-10-27 |
| [job-intelligence.md](job-intelligence.md) | Job Intelligence: company resolution and ranking; not routed |
| [compliance-intelligence/](compliance-intelligence/README.md) | Compliance research workflow, cohort, gates and risks; not routed |
| [sweden-design.md](sweden-design.md) | The SWEDEN research pages: routes, template, lineage, statistical conventions |
| [sweden-atlas.md](sweden-atlas.md) | The SWEDEN 3D atlas and its data slots |
| [symbolic-atlas.md](symbolic-atlas.md) | Symbol Lab: symbol words in a public-domain corpus |
| [philosophy-atlas.md](philosophy-atlas.md) | Philosophy Lab: thirteen works mapped by meaning |
| [concept-layer.md](concept-layer.md) | The shared concept layer across four text corpora |
| [concept-constellation.md](concept-constellation.md) | Concept Lab's exploring view |
| [concept-journey.md](concept-journey.md) | Concept Lab's reading view |
| [ai-act.md](ai-act.md) | EU AI Act data: articles, actors, obligations and dates |
| [ai-politics.md](ai-politics.md) | AI in Riksdag speeches and similarity to the Act's text |
| [ai-jobs.md](ai-jobs.md) | AI governance terms in job ads |
| [ai-governance-timeline.md](ai-governance-timeline.md) | The Act, the Riksdag and job ads on one time axis |
| [workers-ai.md](workers-ai.md) | Ask the law and the sentence placer on Workers AI; the corpus and eval of the removed Ask the platform (sv) |
| [site-structure.md](site-structure.md) | Pages, navigation, routing and retired addresses |
| [design-system.md](design-system.md) | The live visual direction, tokens and chart forms |
| [data-storytelling.md](data-storytelling.md) | The order a page presents question, answer, visual and method |
| [site-goals.md](site-goals.md) | The site's finish line, as checkable goals |
| [product-inventory.md](product-inventory.md) | Historical: product reviews and task tables of 2026-10-25; paths as of that date |
| [mockups/SPEC.md](mockups/SPEC.md) | The remaining dashboard mockups (sv) |

DrugComb and the Homie API are documented beside their pinned sources in
[platform/products/](../platform/products/README.md).

## Research

| Document | Covers |
|---|---|
| [ml-feature-engineering.md](ml-feature-engineering.md) | Engineered features against the plain baseline |
| [ml-gate-amendments.md](ml-gate-amendments.md) | Dated changes to how a model or champion is judged, and their outcomes |
| [cluster-batches.md](cluster-batches.md) | Clustering batches, their statuses and what may be posted |
| [cluster-atlas.md](cluster-atlas.md) | Six corpora in one space: versions 1 and 2, links, the dimension-reduction benchmark |
| [cluster-experiments.md](cluster-experiments.md) | The shared protocol for clustering experiments |
| [cluster-experiments-debates.md](cluster-experiments-debates.md) | Results for Replik |
| [cluster-experiments-jobs.md](cluster-experiments-jobs.md) | Results and MLOps for job ads |
| [cluster-experiments-philosophy.md](cluster-experiments-philosophy.md) | Results for Philosophy Lab |
| [cluster-experiments-symbolic.md](cluster-experiments-symbolic.md) | Results for Symbol Lab |
| [cluster-visuals-experiments.md](cluster-visuals-experiments.md) | The experiments view on Cluster Visuals |
| [job-market-clustering.md](job-market-clustering.md) | Semantic structure of tech job ads: method and limits |
| [job-clustering-sweep.md](job-clustering-sweep.md) | The parameter sweep of 4 October 2026 (`job-clustering-sweep.csv`) |
| [job-clustering-ensemble.md](job-clustering-ensemble.md) | The feature and ensemble experiment (`job-clustering-features.csv`) |
| [public-clustering-experiments.md](public-clustering-experiments.md) | Party-leader debates and regional profiles: results (sv) |
| [public-clustering-method.md](public-clustering-method.md) | The same experiments: data, parameters, rerun commands (sv) |
| [sweden-data-source-strategy.md](sweden-data-source-strategy.md) | Candidate sources for SWEDEN and what each would answer |
| [sweden-statistical-research-plan.md](sweden-statistical-research-plan.md) | Historical: the 2026-10-21 statistical audit, implemented; kept because a pre-registration cites it |

Pre-registrations are dated commitments and are never edited after the fact:
[AI Act diffusion](ai-act-diffusion-preregistration.md),
[Old Bailey extraction](oldbailey-extraction-preregistration.md),
[moral foundations](philosophy-moral-preregistration.md),
[SWEDEN connections](sweden-connections-preregistration.md),
[futures topics](sweden-futures-topics-preregistration.md),
[three spaces](sweden-three-spaces-preregistration.md).

## Operations

| Document | Covers |
|---|---|
| [development.md](development.md) | Verification levels, logs and the workspace lifecycle |
| [deploy.md](deploy.md) | Cloudflare hosting, previews, one-time setup, secrets, limits |
| [security.md](security.md) | Security checks, locks and headers |
| [roadmap.md](roadmap.md) | The work queue of the build loop; statuses checked on 2026-10-23 |
| [idea-lineage.md](idea-lineage.md) | The idea journal and the `ideas:*` commands |
| [package.md](package.md) | The platform as an installable Python package |
| [code-inventory.md](code-inventory.md) | Historical: used and unused code on 2026-10-23; not kept current |
| [case-studies/platform.md](case-studies/platform.md) | The platform: problem, decisions, failures, measured size |
| [incidents/](incidents/) | Postmortems; open findings are listed in the document that owns the topic |

## Checking a document

```sh
python .claude/skills/de-ai-writing/scripts/check_ai_signs.py docs/<file>.md
```
