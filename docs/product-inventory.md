# Product inventory, 2026-10-25

Every product reviewed by its own agent against one rule: each product must carry real value and never look unfinished. Full reviews (findings, copy corrections, project-page content, screenshots) are in the session scratchpad `reviews/<id>.md`; this file collects the verdicts and every task.

P1 = blocks looking finished · P2 = clear improvement · P3 = nice to have. Effort S/M/L.

| Product | P1 | P2 | P3 |
|---|---|---|---|
| [Replik (Riksdag debates, new)](#politics) | 8 | 4 | 4 |
| [SWEDEN (A–E, X)](#sweden) | 7 | 12 | 3 |
| [Arbetsförmedla](#jobs) | 7 | 3 | 2 |
| [The data platform](#platform) | 7 | 5 | 2 |
| [Allegora (+ Ask the platform)](#allegora) | 4 | 8 | 2 |
| [What does it even mean?](#meaning) | 7 | 5 | 2 |
| [Cluster Visuals](#cluster-visuals) | 7 | 6 | 2 |
| [Symbol Lab](#symbolic) | 6 | 5 | 3 |
| [Philosophy Lab](#philosophy) | 5 | 2 | 2 |
| [Concept Lab](#concepts) | 7 | 4 | 1 |
| [IT Incident Clustering](#thesis) | 5 | 4 | 1 |
| [Drug Synergy Lab](#drugcomb) | 4 | 4 | 4 |
| [Homie API](#homie) | 4 | 4 | 2 |
| **Total** | **78** | **66** | **30** |

## What runs through every product

1. **"Not done" signals on the page.** "0 reviewed", "Not reviewed" badges, "Cluster N" / bare "1" labels, "years counted so far", "rise not yet explained", "not published yet", empty owner-only sections. Hide or reframe as a method choice (symbolic, philosophy, concepts, cluster-visuals, sweden B/E, allegora, jobs).
2. **Claims the data does not back.** DrugComb "TensorFlow / deep learning"; Philosophy "human-reviewed concepts"; SWEDEN C "validated" groups; Arbetsförmedla "every hour"; Concept Lab "93 %" without the language caveat; Cluster Visuals "named after reading" (an LLM named them); thesis 121 clusters vs 21,633 records; the polarization headline.
3. **Weakest result first.** SWEDEN's template leads with the contrary finding; DrugComb opens on random rows; Concept Lab on "risk"; Symbol Lab on Baseline; C on the wrong question.
4. **Numbers that disagree or are stale.** Six dbt model counts on one page; graph/er/quality/models files 2–4 weeks old; `debates/summary.json` stale; `eval.json` undated and measured with an older quote checker.
5. **Broken loading.** About 35 unsigned GitHub calls per hub view hit the rate limit (403s); Allegora sits inert 5–23 s on 12 MB; Cluster Visuals loads 13.6 MB.
6. **Naming risk.** "Arbetsförmedla" reads like the state agency Arbetsförmedlingen: add a not-affiliated line at least, or rename.
7. **Small human-review jobs that make claims true.** Philosophy: 19 cross-work groups, about 1–2 h. Politics: name groups 1 and 6. Symbol Lab: top cross-book clusters.

## Suggested order

- **Wave 1, copy and hide (S each, no data jobs):** every claim correction in point 2, the "not done" signals in point 1, reorder to lead with the strongest result (point 3), Arbetsförmedla disclaimer, remove the 3D Atlas link and the duplicate Riksdag map. Roughly two days of work, mostly P1.
- **Wave 2, UI repair:** loading states (Allegora, jobs), legends and colours in Cluster Visuals, broken feed thumbnails and the ~10 posts to drop, SWEDEN X header, Concept Lab heatmap as the lead view, DrugComb default split, Homie data-model figure.
- **Wave 3, data and pipeline:** `status/runs.json` instead of GitHub calls, refresh stale exports and one source for the model count, re-score the Allegora eval with the current checker, field-code fix and per-session topic shares for politics, D1 and profile for Arbetsförmedla.
- **Wave 4, new and bigger:** Replik (#replik) as the flagship politics product, the visual thesis case study (port the mockup, restore the bilingual copy), the 12 project pages from the canvas sketches, the rest of the site to charcoal (meaning, SWEDEN, labs).

## Per product

## Replik (Riksdag debates, new)
<a id="politics"></a>

The site already has the data for one of its strongest products: 33 years of Riksdag debate and roll-call data, a validated party-separability model, and a stable topic clustering. All of it is scattered across about 29 feed cards and one Cluster Visuals block. The biggest problem is that there is no page, and the cards that come closest to one read stale or misleading files (`debates/summary.json`, `all_parties_auc`).

| ID | Task | Type | Effort | Priority | Needs | Files |
|---|---|---|---|---|---|---|
| politics-1 | Pass `ARTIFACTS` stems into `tfidf_terms(exclude=…)`, rerun `politics_story.py` | pipeline | S code / M run | P1 | **R2** (debate full text) | `platform/publish/politics_story.py:229`, `story.json` |
| politics-1b | Interim, no R2: drop field-code keyword rows from `story.json` in a one-off filter (leaves fewer than N words in 23 debates) | data | S | P1 (if -1 slips) | none | `story.json` |
| politics-2 | Name or explicitly label groups 1 and 6 of `debate-topics` (read 20 passages each) | model | S | P1 | **R2**/Worker corpus for text | `cluster-research/debate-topics.json`, `clusters/debate-topics.json` |
| politics-3 | Extend `debate_topics.py` with per-riksmöte all-party and per-party shares (same bootstrap) | pipeline | M | P1 for §3 | **pipeline rerun** on `warehouse/cluster_lab` runs (local warehouse, not in repo) | `platform/publish/clusters/debate_topics.py`, `clusters/debate-topics.json` |
| politics-4 | Delete `debates/summary.json`, `debates/overview.json`, `debates/sessions/*`; drop `pol-topic-tree` | data/UI | S | P1 | none | `pol-docs-c.tsx`, `debates/` |
| politics-5 | Re-title `pol-polarization` to within-debate; reorder `AUC` so within-debate is focal | copy | S | P1 | none | `pol-docs-b.tsx:148-152, 242-249` |
| politics-6 | Remove the legacy Cluster Visuals block and the "Political Observatory" label; then drop `politics/parliament/sessions/*/umap.json` (35 MB) | UI/data | S | P1 | none | `ClusterVisualsPage.tsx:357-378`, `clusters/debateData.ts` |
| politics-7 | Build `#replik` page from existing components (6 sections), redirect old routes there | UI | L | P1 | none | new `frontend/src/replik/`, `router.ts:110-126` |
| politics-8 | Spot-check 2025/26 roll calls (last vote 2026-08-13; SD abstentions 0.4%) | data | S | P2 | **R2** `politics/decisions/2025-26` | `parliament/sessions.json` |
| politics-9 | Refresh `parliament/now.json` after government formation | pipeline | S | P2 | rerun `export_parliament.py` | `now.json` |
| politics-10 | Restrict `pol-ai-party-dots` to 2023+ | copy | S | P2 | none | `pol-ai-a.tsx:196-205` |
| politics-11 | Rebuild eras on `debate-topics` per-session shares (after -3) so one topic model serves the page | model | M | P3 | after politics-3 | `clusters/riksdag-eras.json` |
| politics-12 | Run KB-BERT for separability (GPU) and add model macro-F1 to `models.json` | model | M | P3 | GPU, pipeline rerun | `ml/cards/polarization.md` |
| politics-13 | Mask leader/minister names in separability, rerun | model | M | P3 | pipeline rerun | `ml/` polarization task |
| politics-14 | Remove dead `DROPPED` ids; fix raw path in hub caption | copy | S | P3 | none | `Feed.tsx:78-99`, `cardsPlatform.tsx:250` |
| politics-15 | Mark the 2003/04 topic-debate method break on any volume chart | copy | S | P2 | none | `sakdebatter.json` consumers |

## SWEDEN (A–E, X)
<a id="sweden"></a>

This is the strongest research engineering on the site: hash-checked, scheduled counts over 8.7 M job ads and 429 k speeches, plus pre-registered tests. But a template rule (`template.tsx:345`) puts the "against the expectation" finding first on every page. As a result, C opens with "The groups are a weak structure" on groups that its own pre-registered check rejected, and the six pages read as hedged rather than impressive.

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| sweden-H-1 | Remove the Atlas menu link and the `#sweden-atlas*` routes | UI | S | P1 | Header.tsx:135, router.ts:151-157, SwedenPage.tsx:18,39 |
| sweden-H-2 | Put the strongest finding first; contrary finding last | UI | S | P1 | template.tsx:345 |
| sweden-H-3 | Hub: one headline figure per product, replacing the stamps; "five … and Connections" | UI/copy | M | P2 | Hub.tsx:78-98 |
| sweden-H-4 | Phone sub-nav: scroll the current item into view | UI | S | P2 | Header.tsx |
| sweden-H-5 | Fill `run_id` / `code_sha` in published provenance | pipeline | S | P3 | platform/publish/sweden/export_connections.py, export_similarity.py |
| sweden-A-1 | Default the 3D bar field to 2D; fix the clipped decade axis and the bottom row under the panel | UI | M | P2 | Measurement.tsx, BarField.tsx |
| sweden-B-1 | Remove the "counted so far" wording; mark 2026 as partial | copy | S | P1 | Language.tsx:323-324, 597 |
| sweden-B-2 | Passion = mostly "engage*": rename the label or show the subterms | copy/data | S | P2 | Language.tsx:222, language/trends.json |
| sweden-B-3 | One ad-length baseline (2006 or 2008) across findings | copy | S | P2 | Language.tsx:192, 250-255 |
| sweden-B-4 | Default to 2D; collapse the explore sections (17k / 33k px page) | UI | M | P2 | Language.tsx, LanguageExplore.tsx |
| sweden-C-1 | Reframe the k = 4 groups as a descriptive summary; state the failed pre-registered check; drop the "21 of 21 counties" finding | copy | S | P1 | Similarity.tsx:3, 228-279 |
| sweden-C-2 | Lead with 208/280 in another county, 180 km vs 22 km | copy | S | P1 | Similarity.tsx:207 |
| sweden-C-3 | Add a Three Swedens Mantel panel | UI/data | M | P2 | Similarity.tsx, clusters/three-swedens.json |
| sweden-C-4 | Hub and C map: colour by a stable split, or caption it as descriptive | UI | S | P2 | Hub.tsx:52, Similarity.tsx:314 |
| sweden-D-1 | Translate the SKR group labels in English mode | UI | S | P2 | Belonging.tsx:949-960 |
| sweden-D-2 | Non-breaking space before "%" | copy | S | P3 | Belonging.tsx (finding 02) |
| sweden-E-1 | Say "−84 %, 2.9 → 0.5 %"; add crisis +81 % | copy | S | P2 | Futures.tsx:129-224 |
| sweden-E-2 | Remove "rise not yet explained" from the chart and note | copy | S | P1 | FuturesExplore.tsx:263, 293-294 |
| sweden-E-3 | Fix the overlapping theme labels in 3D or default to 2D | UI | S | P3 | Futures.tsx, BarField.tsx |
| sweden-X-1 | Fix the invisible header (title and question) and the missing gutter | UI | S | P1 | Connections.tsx:87, sweden.css |
| sweden-X-2 | Add a summary line of all three verdicts | copy | S | P2 | Connections.tsx:96-104 |
| sweden-X-3 | Remove the "being harvested again" reason text | pipeline/copy | S | P2 | export_connections.py:187 |

## Arbetsförmedla
<a id="jobs"></a>

The engineering underneath is strong, but a visitor today sees a CV matcher with no matches. The first thing on the page is "the route answered 403", next to "Strong matches 0", an Applications tab that errors and an empty demand table.

| ID | Task | Type | Effort | Prio | Files |
|---|---|---|---|---|---|
| jobs-1 | Let Actions reach `/api/jobs/*` (WAF/bot skip rule for that path) **and** finish D1 setup + approve a profile | pipeline | M | P1 | Cloudflare WAF, `setup-job-assistant.yml`, `wrangler.toml` |
| jobs-2 | Public unmatched note: no HTTP code, calm "paused" wording | copy | S | P1 | `model.ts:220-245`, `Unmatched.tsx:108` |
| jobs-3 | Hide Strong/Applications stats without profile/token; show counts/duplicates/removed instead | UI | S | P1 | `Stats.tsx` |
| jobs-4 | Hide Applications tab and Owner tools for visitors | UI | S | P1 | `JobAssistantPage.tsx:37-41`, `Pipeline.tsx:18`, `Sections.tsx:217` |
| jobs-5 | Hide empty demand table and the 0-of-50 label line | UI | S | P1 | `Sections.tsx:82-182` |
| jobs-6 | Name: subtitle + "not affiliated with Arbetsförmedlingen"; decide on rename | copy | S | P1 | `JobAssistantPage.tsx:140`, `Header.tsx:24`, `hubProjects.ts:83`, `Sections.tsx:73` |
| jobs-7 | "hourly/every hour" → "several times a day" | copy | S | P1 | `JobAssistantPage.tsx:143`, `Sections.tsx:54`, `hubProjects.ts:85` |
| jobs-8 | Hub freshness → `job_assistant`, 8 h | UI | S | P2 | `freshness.ts:16`, `hubProjects.ts:91` |
| jobs-9 | Raw file names out of prose | copy | S | P2 | `Sections.tsx:77`, `JobsPulse.tsx:47` |
| jobs-10 | Occupation on unmatched cards + facet | UI | M | P2 | `Unmatched.tsx` |
| jobs-11 | Runs sparkline instead of table | UI | S | P3 | `Sections.tsx:184-215` |
| jobs-12 | 50 owner labels, then publish counts/precision | data | M | P3 | D1 `label`, `model.ts:172` |

## The data platform
<a id="platform"></a>

Real, hireable data engineering (26-subject registry, gated dbt, versioned R2 releases, postmortems). The biggest problem: the page shows six different model counts and three GitHub-fed sections that turn into "could not be read" errors. A data-engineering reviewer will spot both within a minute.

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| platform-1 | Write GitHub runs/issues/incidents to `status/runs.json` in R2; RunHealth reads it, GitHub API is only a fallback | pipeline | M | P1 | `.github/workflows/data-heartbeat.yml`, `RunHealth.tsx`, `github.ts` |
| platform-2 | Remove duplicate `Runs` block; dedupe in-flight `loadWorkflows` (cache the promise) | UI | S | P1 | `Machinery.tsx`, `WorkflowRuns.tsx` |
| platform-3 | Fabric: static numbers from a committed snapshot, no live API | data | S | P1 | `FabricLakehouse.tsx` |
| platform-4 | Regenerate graph/er/models/quality/summary in one weekly run with `generated_at` | pipeline | M | P1 | `platform/publish/export_schema.py`, `export_er.py`, build-warehouse.yml |
| platform-5 | Reconcile model/ML/export counts; one source per figure | copy | S | P1 | `flowSteps.ts`, `PipelineTour.tsx` |
| platform-6 | Count n/a as excluded in quality bars | UI | S | P1 | `WarehouseTables.tsx:29` |
| platform-7 | Fix Symbol Lab UMAP cards stuck loading | UI | S | P1 | `UmapGallery.tsx` |
| platform-8 | Hide/link "failed: ai act"; investigate ai_act ingest | pipeline | S | P2 | `flowSteps.ts:447`, ai_act subject |
| platform-9 | Update case-study numbers and date | copy | S | P2 | `docs/case-studies/platform.md` |
| platform-10 | Hide non-remote delivery line; point `delivery.json` at data.antonernstsson.com | data | S | P2 | `Machinery.tsx:251-266`, `frontend/public/data/delivery.json` |
| platform-11 | Rename "Arbetsförmedla" picker label | copy | S | P2 | `hubProjects.ts:83` |
| platform-12 | Tables list: hide 1-column unbuilt models, fix plural | UI | S | P3 | `WarehouseTables.tsx` |
| platform-13 | Translate Machinery copy | copy | S | P3 | `Machinery.tsx` |
| platform-14 | Add a subject YAML card next to the flow | UI | S | P2 | `PlatformSections.tsx`, `platform/pipeline.yml` |

## Allegora (+ Ask the platform)
<a id="allegora"></a>

Allegora is a real, well-engineered RAG product with a hard anti-hallucination guardrail. The biggest problem is the first impression: the Swedish-law page stays inert for 5–23 s while a 6.8 MB uncompressed `sfs/meta.json` loads from R2, with no loading state. The English AI Act tab has no examples and says "not published yet".

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| allegora-1 | Loading state plus faster corpus (compress or split SFS meta, binary PCA) | UI / data | M | P1 | `AskTheLaw.tsx`, `workersAi/corpus.ts`, R2 `workers-ai/sfs/meta.json`, `pca.json` |
| allegora-2 | Open on precomputed verified example (as `ready` in Ask the platform) | UI | S | P1 | `AskTheLaw.tsx` |
| allegora-3 | Fill English AI Act examples (180-neuron job, or reuse sv examples) and drop "not published yet" | data | S | P1 | `workers-ai/ai-act-en/examples.json`, `AskTheLaw.tsx:308-315` |
| allegora-4 | Add run date and Worker version to `eval.json`, show the date on the page | data / copy | S | P1 | `eval.json`, export script, `AskTheLaw.tsx:432` |
| allegora-5 | Re-score stored eval text with current `checkQuotes`, publish both scores | test | S | P2 | `platform/publish/workers_ai/eval_answer.ts`, `eval.json`, docs |
| allegora-6 | Collapse passages, shorten the phone page | UI | S | P2 | `AskTheLaw.tsx:368-378`, `lawqa.css` |
| allegora-7 | Replace the recital-based AI Act example with an Article 113 answer | data | S | P2 | `ai-act-sv/examples.json` |
| allegora-8 | Footnote the gpt-oss partial runs (quota ran out) | copy | S | P2 | `AskTheLaw.tsx:451-503` |
| allegora-9 | Extend eval past n = 20, add English AI Act questions | model | M | P2 | `configs/workers_ai/eval_questions.yaml` |
| allegora-10 | Prompt: no duplicate prose before quotes | model | S | P3 | `worker/index.ts:142-147` |
| allegora-11 | Copy fixes: "checked word for word", tech list, docs stale lines | copy | S | P3 | `AskTheLaw.tsx:106`, `projectRegistry.ts:209`, `docs/workers-ai.md:4,158,284` |
| allegora-12 | Platform: replace placeholder "How is the junior share tested?" (eval Q1, which fails) | copy | S | P2 | `ask/AskThePlatform.tsx:197` |
| allegora-13 | Platform: show file labels, not raw ids (`graph:ingest:elections`), before the corpus loads | UI | S | P2 | `ask/AskThePlatform.tsx:46-69`, `platform/examples.json` |
| allegora-14 | Platform: live re-run with the current Worker, reported against the 75 % target | model | S | P2 | `eval_questions_platform.yaml`, `docs/workers-ai.md:290-323` |

## What does it even mean?
<a id="meaning"></a>

A strong, traceable feed of about 116 charts, roughly 85 of them good, but about 25 weak or broken thumbnails (clipped labels, overlapping text, conflicting numbers, internal diagnostics) and one misleading ML headline make it look unfinished.

| ID | Task | Type | Effort | Pri | Files |
|---|---|---|---|---|---|
| meaning-1 | Retitle the polarization post to seven-party/within-debate AUC; drop all-party line | copy/UI | S | P1 | posts/pol-docs-b.tsx |
| meaning-2 | Fix clipped KPI tile labels | UI | S | P1 | posts/job-clusters-fit.tsx |
| meaning-3 | Fix daily bars: label collisions, weekend dip, stale series | UI/data | S | P1 | posts/job-market-pulse.tsx |
| meaning-4 | Make the hours title and end labels use the same year | copy | S | P1 | posts/job-market-terms.tsx |
| meaning-5 | Label-collision helper for end labels and x labels | UI | M | P1 | axes.tsx, kit.tsx |
| meaning-6 | Fix overlaps: agree-matrix, scatters, AI Act timeline, tension axis, cluster-map label, sick-stream | UI | M | P1 | pol-votes-b, wel-panel-a/b, txt-act-a3, txt-ml-a2, job-clusters, wel-labour-a |
| meaning-7 | Shorten data titles so numbers never truncate | copy | S | P1 | wel-sweden-b, txt-ml-a3, txt-ml-b2, txt-ml-b4 |
| meaning-8 | Drop 9 weak/diagnostic posts | UI | S | P2 | Feed.tsx |
| meaning-9 | Charcoal palette: remove `.mean-light`, map tokens to hub | UI | M | P2 | meaning.css, MeaningPage.tsx |
| meaning-10 | Clustering caveat notes (jobs, municipalities) | copy | S | P2 | job-clusters.tsx, wel-sweden-a.tsx |
| meaning-11 | Lede line with trace coverage and click hint | UI | S | P2 | MeaningPage.tsx |
| meaning-12 | Rewrite jargon titles (diffusion, lang break, foundations, framing) | copy | S | P2 | txt-act-diffusion, job-language, txt-ml-moral, pol-ai-b |
| meaning-13 | Prune dead DROPPED ids; fix stale comments/brief | copy | S | P3 | Feed.tsx, briefs/meaning.md |
| meaning-14 | Test: title value equals rendered label for the same year | test | S | P3 | job-market-terms.tsx |

## Cluster Visuals
<a id="cluster-visuals"></a>

A strong engineering showcase (seven maps, one canvas component, a live bge-m3 "place your sentence" demo), but it reads like an unedited dump: the top legend entry is a bare "1", 118 Symbol Lab groups and all 23 Philosophy Lab groups are "Cluster N", and the last map is 61 % grey with Swedish keyword labels.

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| cluster-visuals-1 | Never render a bare cluster number; show named fallbacks | UI | S | P1 | ClusterVisualsPage.tsx:189-191, ClusterScatter.tsx:155 |
| cluster-visuals-2 | Remove the Riksdag session map | UI | S | P1 | ClusterVisualsPage.tsx:356-375 |
| cluster-visuals-3 | Drop the duplicate debate-topic section | UI | S | P1 | ClusterVisualsPage.tsx:199-219,500 |
| cluster-visuals-4 | Correct naming copy: LLM-named, intrusion scores, not human-reviewed | copy | S | P1 | ClusterVisualsPage.tsx:209,229; projectRegistry.ts:135 |
| cluster-visuals-5 | Expand the palette to ≥12 colours and make "+ N more" expandable | UI | M | P1 | clusterGeometry.ts:1-8, ClusterScatter.tsx:202-219, clusters.css |
| cluster-visuals-6 | Move specs/hashes into a Method `<details>`; add a 3-figure row | UI | S | P1 | ClusterVisualsPage.tsx:402-435 |
| cluster-visuals-7 | Symbol Lab: label clusters by dominant symbol·book, or show symbol colour | data/UI | M | P1 | ClusterVisualsPage.tsx:260-314, symbolic/atlasData |
| cluster-visuals-8 | Philosophy Lab 13-works map: collapse as "early version" | UI | S | P2 | ClusterVisualsPage.tsx:315-339 |
| cluster-visuals-9 | Municipalities: add the failed preregistered-check sentence | copy | S | P2 | ClusterVisualsPage.tsx:249, cluster-research/municipalities.json |
| cluster-visuals-10 | Disambiguate duplicate jobs labels (Vue / React ×2) | pipeline | S | P2 | jobs label step → jobs/cluster-summary.json |
| cluster-visuals-11 | Downsample jobs export to about 5k points | pipeline | S | P2 | jobs/clusters/efd2e318dc1621b2/* |
| cluster-visuals-12 | Hub card text lists the right maps + demo | copy | S | P2 | hub/hubProjects.ts:147-148 |
| cluster-visuals-13 | Find and fix the three 404s on page load | test | S | P2 | — |
| cluster-visuals-14 | Human review of 48 group names; then reword to "reviewed" | model | M | P3 | cluster-research/*.json, docs/public-clustering-experiments.md |
| cluster-visuals-15 | Trust chip per map from existing ARI/trustworthiness/null fields | UI | M | P3 | ClusterVisualsPage.tsx |

## Symbol Lab
<a id="symbolic"></a>

A strong, honest piece of unsupervised NLP (a measured book confounder, controlled experiments that cut it, and audit-ranked clusters), but the page leads with an empty "Reviewed" view and a "No reviewed semantic clusters yet" line, so it reads as unfinished instead of rigorous.

| ID | Task | Type | Effort | Prio | Files |
|---|---|---|---|---|---|
| symbolic-1 | Hide Reviewed view, empty-state text and key item when no reviewed clusters | UI | S | P1 | `frontend/src/symbolic/SymbolicAtlasPage.tsx:65-89,451-463` |
| symbolic-2 | Drop "Not reviewed" badge; show status only if reviewed/rejected | UI | S | P1 | `frontend/src/symbolic/ClusterPanel.tsx:20-24,70-72` |
| symbolic-3 | Rewrite "Result" step as a by-design gate, no count | copy | S | P1 | `frontend/src/symbolic/ResearchStory.tsx:141-156` |
| symbolic-4 | Relabel silhouette as UMAP-space geometry (EN+SV), incl. "model/cluster quality" notes | copy | S | P1 | `ResearchStory.tsx:392-393,444-445`; `SymbolicAtlasPage.tsx:683-684` |
| symbolic-5 | Split the lesson table into v1→v4 and baseline→centred so the column headers are correct | UI/copy | S | P1 | `ResearchStory.tsx:344-449` |
| symbolic-6 | Default map view to Cross-book | UI | S | P1 | `SymbolicAtlasPage.tsx:101` |
| symbolic-7 | Fix "no cluster reads as paratext" | copy | S | P2 | `ResearchStory.tsx:106-107` |
| symbolic-8 | Registry summary: contexts, not "symbolic meaning" | copy | S | P2 | `frontend/src/projects/projectRegistry.ts:47-50` |
| symbolic-9 | "Contexts that cross traditions" strip from top-6 ranked clusters with passages | UI | M | P2 | `SymbolicAtlasPage.tsx`, `ClusterPanel.tsx`, `cross-book-clusters.json` |
| symbolic-10 | Update stale remaining-risk text; rename product to Symbol Lab in quality data | data | S | P2 | `platform/quality/validity_registry.yml:48,342`; `frontend/public/data/quality/summary.json` |
| symbolic-11 | AMI baseline→centred dumbbell as lead finding visual | UI | M | P2 | `ResearchStory.tsx`, `research-history.json` |
| symbolic-12 | Read and label top 10 clusters, then re-enable Reviewed | data | M | P3 | `platform/nlp/symbolic/reviewed_clusters.json`, `export_symbolic.py` |
| symbolic-13 | Test: no Reviewed UI when review file is empty | test | S | P3 | `frontend/src/symbolic/` |
| symbolic-14 | Align hub card with page (it headlines masked+centred 81 %; page uses book-centred 76 %) | copy | S | P3 | `frontend/src/hub/mini/cardsLabs.tsx:97-104` |

## Philosophy Lab
<a id="philosophy"></a>

A rare embedding project that measures its own bias and fixes it (same-work neighbours 48 % → 32 %, cross-work groups 6 → 19), but the page opens by saying "none has been [reviewed] yet" and stamps "not reviewed" on all 23 groups, so the first thing a visitor reads is that the job is unfinished.

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| philosophy-1 | Rewrite registry summary/result (drop "human-reviewed", add 48 → 32 %) | copy | S | P1 | `frontend/src/projects/projectRegistry.ts:122-135` |
| philosophy-2 | Remove "none has been yet" from intro, both languages | copy | S | P1 | `PhilosophyAtlasPage.tsx:349-350` |
| philosophy-3 | Hide "not reviewed" per row; show status only when reviewed | UI | S | P1 | `PhilosophyAtlasPage.tsx:495-498` |
| philosophy-4 | Replace "Group N" with top clean terms or size rank | UI | S | P1 | `PhilosophyAtlasPage.tsx:482-484` |
| philosophy-5 | Stoplist roman numerals, "prop", archaic/function words in c-TF-IDF; re-export | pipeline | S | P1 | `platform/nlp/philosophy/pipeline.py`, `philosophy/clusters.json` |
| philosophy-6 | Hand-review the 19 cross-work centred groups into `reviewed_clusters.json`; rerun, verify fingerprints | data | M | P2 | `platform/nlp/philosophy/reviewed_clusters.json`, `summary.json`, `clusters.json` |
| philosophy-7 | Hero: raw vs centred maps side by side + 3-number strip | UI | M | P2 | `PhilosophyAtlasPage.tsx` (`AtlasMap`, `Evaluation`) |
| philosophy-8 | Seed stability check (5 seeds, ARI, spread of cross-work count) | model | M | P3 | `pipeline.py`, `summary.json`, `docs/philosophy-atlas.md` |
| philosophy-9 | After philosophy-6, update copy to "named by hand" claims | copy | S | P3 | registry, `PhilosophyAtlasPage.tsx:349` |

## Concept Lab
<a id="concepts"></a>

The data work is solid, and the concept × corpus table is a real finding (death 38 % of myth passages, 10.6× chance). The product hides it behind three routes, though, and it opens on its weakest example: "risk", which shows 0.0× and 0.1× on two of its four stars, gets myth passages that are not about risk, and comes with a "0 reviewed clusters" note.

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| concepts-1 | Default concept risk → death or care; update JOURNEY_CONCEPTS | UI | S | P1 | `Journey.tsx:63`, `logic.ts:115` |
| concepts-2 | Remove the "0 reviewed clusters" note from the journey | copy | S | P1 | `Journey.tsx:178-184` |
| concepts-3 | Hide the per-domain empty-state lines | UI | S | P1 | `Journey.tsx:423-440` |
| concepts-4 | Make Compare (sorted lift heatmap) the first tab or the hero; annotate the 4 leaders | UI | M | P1 | `ConceptConstellationPage.tsx:~675-733`, `:79-103` |
| concepts-5 | Demote Relations from a tab to a deep link, or fix the layout and phone size | UI | M | P1 | `ConceptConstellationPage.tsx:79-103`, `:343-525` |
| concepts-6 | Fix the legend: drop temporal overlap, correct the shared_concept text | copy | S | P1 | `ConceptConstellationPage.tsx:491`, `summary.json` relation_types |
| concepts-7 | Add the language caveat to the 93 % claim | copy | S | P1 | `projectRegistry.ts:170`, `Journey.tsx:309`, `docs/concept-constellation.md:51` |
| concepts-8 | Show passages only at rank 1, show one strongest pair, drop weak pairs | UI | M | P2 | `Journey.tsx:157`, `:243-276` |
| concepts-9 | Make the documented-reference arc a note, not part of every map | UI | S | P2 | `Journey.tsx:578-583` |
| concepts-10 | Fix the politics corpus `domain` and "every speech" wording | data | S | P2 | `seeds/concepts/corpora.csv`, `summary.json` |
| concepts-11 | Measure same-corpus neighbours within English only | pipeline | S | P2 | `platform/nlp/concepts/build.py` |
| concepts-12 | Shorten the journey page (cap at 1 passage per domain on phone) | UI | S | P3 | `Journey.tsx:157` |

## IT Incident Clustering
<a id="thesis"></a>

This is a strong, honestly scoped NLP case study on real production data, but `#thesis` shows it as four plain text blocks with no figures and no visuals. The best material is in a mockup and in a richer bilingual page that a later commit deleted.

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| thesis-1 | Add hero stat row (21,633 / 121 / 72) | UI | S | P1 | CaseStudies.tsx |
| thesis-2 | Build 121-dot cluster grid + funnel (port the mockup, fix the denominators) | UI | M | P1 | CaseStudies.tsx, new ThesisClusterGrid.tsx, mlviz.css |
| thesis-3 | Build ISO data-quality bar strip incl. 82.2 vs 3.8 pair | UI | M | P1 | CaseStudies.tsx, new component |
| thesis-4 | Restore bilingual l()/t() copy from dc888ad6 and remove hardcoded lang="en" | copy | M | P1 | CaseStudies.tsx |
| thesis-5 | Fix denominator copy (21,633 vs 16,811) | copy | S | P1 | orbitContent.ts:113, CaseStudies.tsx:60 |
| thesis-6 | Replace the unsupported "helped distinguish" sentence | copy | S | P2 | CaseStudies.tsx:83 |
| thesis-7 | HDBSCAN vs K-means table with noise/coverage footnote | UI | S | P2 | CaseStudies.tsx |
| thesis-8 | Add ProjectTech + ProjectDepth pipeline with parameters | UI | S | P2 | CaseStudies.tsx, projectRegistry.ts (tech add Presidio, K-means) |
| thesis-9 | Fix mockup: Avtalat→Fora AB, 21 000+→16,811, drop ▲ | copy | S | P3 | docs/mockups/DashThesis.dc.html |
| thesis-10 | Update tests (Swedish render, no PDF links, grid has 121 items, 72 highlighted) | test | S | P2 | frontend/tests/portfolio.spec.ts, accessibility.spec.ts |

## Drug Synergy Lab
<a id="drugcomb"></a>

This is the strongest supervised-ML project on the site, with a real leakage-aware evaluation. The biggest problem is that the page opens on the flattering random-row score (0.66) while the registry card claims "deep learning / TensorFlow" that does not exist.

| ID | Task | Type | Effort | Prio | Files |
|---|---|---|---|---|---|
| drugcomb-1 | Remove TensorFlow/deep learning; rewrite result and tech | copy | S | P1 | projectRegistry.ts:233-238 |
| drugcomb-2 | Default split to cold_pair so the hero answers its own question | UI | S | P1 | DrugCombReport.tsx:254 |
| drugcomb-3 | Fix the 399,603 vs 396,498 conflict: label the tree as a separate model, or retrain it on the clean fact | data/copy | S/M | P1 | DrugCombReport.tsx:636-661, platform/publish/drugcomb_ml.py |
| drugcomb-4 | Monotherapy caveat (same block, ZIP reference) plus the 0.550 vs 0.564 callout | copy/UI | S | P1 | DrugCombReport.tsx:951, metrics.json |
| drugcomb-5 | Rename baseline legend | copy | S | P2 | DrugCombReport.tsx:145 |
| drugcomb-6 | Show ± fold SD in the hero | UI | S | P2 | DrugCombReport.tsx, report.json |
| drugcomb-7 | Phone x-axis labels (wrap or abbreviate) | UI | S | P2 | Columns chart component |
| drugcomb-8 | Draw the body map immediately (or show a skeleton) | UI | S | P2 | BodyMap.tsx |
| drugcomb-9 | Stray space in cluster legend | UI | S | P3 | DrugConstellation.tsx:242 |
| drugcomb-10 | Scramble: say it is one fold; optionally run on all 4 splits × several seeds | copy/model | S/M | P3 | DrugCombReport.tsx:705, PL diagnostics.py |
| drugcomb-11 | Out-of-fold target encoding for the tree's training features | model | S | P3 | drugcomb_ml.py:89-104 |
| drugcomb-12 | "At least one drug unseen" wording for cold_drug | copy | S | P3 | Method page in DrugCombReport.tsx |

## Homie API
<a id="homie"></a>

Keep it, but **shrink and reframe it**: it is a clean, CI-verified, contract-first backend scaffold (16-operation OpenAPI contract, append-only events, SQL analytics layer, green PostgreSQL 16 CI). The biggest problem is that the page leads with "work in progress" and a 3-of-7 progress dial, so a visitor reads "unfinished" before "well engineered".

| ID | Task | Type | Effort | Priority | Files |
|---|---|---|---|---|---|
| homie-1 | Reframe kicker, lead and descriptor away from "work in progress" | copy | S | P1 | CaseStudies.tsx:120-128, projectRegistry.ts:286 |
| homie-2 | Replace the 3/4 Status block with 16 / 4 / CI-passing facts | copy/UI | S | P1 | CaseStudies.tsx:155-166 |
| homie-3 | Redraw HomieFlow as a data-model figure: 5 views, no "Password hashing" route, visible rings | UI | M | P1 | HomieFlow.tsx |
| homie-4 | Fix phone label clipping in the figure (padding in the viewBox or a stacked legend) | UI | S | P1 | HomieFlow.tsx:9, 79-97 |
| homie-5 | Add a CI evidence link and line (run 34777312347) | copy | S | P2 | HomieProject.tsx:48-63 |
| homie-6 | Merge the "Still stubbed" panel into one sentence; add the fairness formula block | copy/UI | S | P2 | HomieProject.tsx:30-47 |
| homie-7 | Persist households, tasks and completions, and refresh views after insert | pipeline | L | P2 | homie-api repo: app/api/routers/* |
| homie-8 | Update the homie-api README verification section to cite CI; re-pin the commit | copy | S | P2 | homie-api README.md, HomieProject.tsx:50,57 |
| homie-9 | Add a Docker image build step to CI (Compose and the image are untested anywhere) | test | S | P3 | homie-api .github/workflows/ci.yml |
| homie-10 | Synthetic demo fairness chart from the seeded `mv_fairness_week`, clearly labelled | data | M | P3 | new public/data/homie/*.json |
