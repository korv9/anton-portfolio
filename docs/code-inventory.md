# Code inventory

Snapshot of `origin/loop` at `38343334` on 2026-10-23. Nothing was deleted. Each row gives
the search that backs its status. "check" means the evidence is incomplete or a deletion
would change a contract, so a person decides.

Method: `git ls-files` (5,925 tracked files), then string searches over every tracked text
file outside `platform/sources/` (and outside `frontend/public/` except where a section
says otherwise). A name counts as used if it appears as an import, a `ref()`, an
`import.meta.glob` match, an `importlib` spec, a command in `pipeline.yml`, a workflow,
a `package.json` script or a docs command, or as a plain string in YAML or JSON. The
Graphify graph (`graphify-out/graph.json`) does not exist in this checkout or the primary
one (it is ignored by `.gitignore`), so all lookups were targeted searches.
No ts-prune or knip is installed; no dependency was added.

## Cleanup status, 2026-10-23

Each item was searched again before deletion (names as strings, `import.meta.glob`, `_headers`,
catalog, YAML and tests).

| Item | Status | Note |
| --- | --- | --- |
| `previews/politics.webp`, `welfare.webp` | deleted | no reference found |
| Manrope font files and `Manrope-OFL.txt` | deleted | the only `@font-face` rules are in `sweden/sweden.css` and load `fonts/sweden/` |
| `loadJobPreview`, `loadSymbolicPreview`, `backdropShade` | not done | the files are under `frontend/src/home/`, which this cleanup was not allowed to edit |
| Dead CSS: `.builder-*`, `.budget-ledger*`, `.party-card*`, `.q-case*`, `.boxplot*` in `longread.css` | deleted | mixed selector lists keep their live selector; `.boxplot*` in `charts/charts.css` is also unused and is left for a later pass |
| `research_domains` seed config | moved under `sweden:` | `dbt parse` shows `column_types: {sort_order: integer}`; dbt inferred `integer` before, so the type does not change |
| Political Observatory v2 models | deleted with their YAML and two singular tests | no export, exposure or frontend reads them; the seeds stay, `ingest/riksdagen/formation_ingest.py` reads them |
| `refresh-job-analysis.yml`, `refresh-welfare.yml` | kept | `data-subject.yml` has no schedule of its own, and no caller passes `jobs_analysis` or `welfare parliament taxes` |
| `terraform.yml` | kept, cause found | `vars.TF_WORKER_DOMAIN_IDS` is not set, so `TF_VAR_worker_domain_ids` is empty and `terraform init` fails to parse it as `map(string)` in the cloudflare plan |

## Summary

| Section | Checked | unused | test-only | duplicate | oversized | stale | check |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. dbt seeds | 57 | 0 | 0 | 1 | 0 | 1 config | 4 lineage gaps |
| 2. dbt models | 325 | 0 | 5 | 0 | 0 | 0 | 51 without YAML, 34 gold without contract |
| 3. Python modules | 276 | 1 | 11 | 0 | 0 | 0 | 3 |
| 4. Frontend | 287 src files, 1,864 public files | 3 functions, 5 assets, 5 CSS families | 9 exports | 0 | 0 | 0 | 2 components, ~60 file-local exports, 34 public files, `setLocale` |
| 5. Workflows | 13 | 0 | 0 | 2 | 0 | 0 | 2 |
| 6. Dependencies | 14 npm, all Python requirement files | 0 | 0 | 6 version drifts | 0 | 0 | 0 |
| 7. Size and duplication | 1,138 code files | 0 | 0 | 6 groups | 74 | 0 | 0 |
| 8. Docs | 107 Markdown files | 0 | 0 | 0 | 0 | 13 files, ~40 references | 2 |

### Safest deletions first

| # | Item | Evidence | Risk |
| ---: | --- | --- | --- |
| 1 | `frontend/public/previews/politics.webp`, `welfare.webp` | `previews/`, `politics.webp` and `welfare.webp` match nothing in any tracked file, including `frontend/public`, `index.html`, `_headers` and the catalog | none found |
| 2 | `frontend/public/fonts/manrope-latin.woff2`, `manrope-variable.woff2`, `Manrope-OFL.txt` | case-insensitive `manrope` matches only the OFL file itself; no `@font-face` names it; `--font` in `frontend/src/tokens.css:7` is Helvetica Neue | none found |
| 3 | `loadJobPreview`, `loadSymbolicPreview` in `frontend/src/home/umapIntroData.ts:26,53` | each name occurs once in the repository (its declaration); `ClusterPreview.tsx` imports only the `*Detail` loaders | none found |
| 4 | `backdropShade` in `frontend/src/home/backdropGeometry.ts:14` | one occurrence (its declaration); both importers take only `BACKDROP_COLOURS, groupBackdropPoints` | none found |
| 5 | `.builder-*` rules in `frontend/src/report/theme.css` (19 lines) | `builder` occurs in no `.ts`/`.tsx` file under `frontend/src` | low (class names could be built at runtime; none found) |
| 6 | `.budget-ledger*` rules in `frontend/src/pages.css` (22 lines) | `budget-ledger` occurs in no `.ts`/`.tsx` file | low |
| 7 | `.party-card*` rules in `frontend/src/parties/parties.css` (11 lines) | `party-card` occurs in no `.ts`/`.tsx` file | low |
| 8 | `.q-case*` in `frontend/src/quality/quality.css`, `.boxplot*` in `frontend/src/report/longread.css` | `q-case` and `boxplot` occur in no `.ts`/`.tsx` file | low |
| 9 | `platform/seeds/role_classification_patterns.csv`, after merging into `role_patterns.csv` | same four role families and title regexes as `role_patterns.csv`; one `ref()` in `models/silver/jobs/int_job_ads_enriched.sql` | medium: the Analytics Engineer regex differs |
| 10 | `frontend/src/compliance/ComplianceExplorer.tsx` (1,333 lines), `frontend/src/job-intelligence/JobIntelligence.tsx` (253 lines) | no import, `import()` or route in `frontend/src` or `worker/`; named only in the presentation hash lists `scripts/check_compliance_release.mjs:19` and `platform/compliance_intelligence/explorer.py:28` | high: removing them changes `presentation_sha256`, so both lists change and the compliance release is staged and reviewed again |

## 1. dbt seeds

Seed paths: `seed-paths: [seeds]` in `platform/dbt_project.yml`. 57 CSV files plus
`seeds/shared/schema.yml`. Search per seed: `ref\(\s*['"]<seed>['"]\s*\)` across the repo,
then `seeds\.<seed>\b|\b<seed>\.csv\b` for readers outside dbt.

Every seed has a reader. None is unused or test-only. Four are read by Python with raw
`seeds.<name>` SQL, so dbt lineage, `docs/` exports and the architecture graph cannot see
those edges. No seed is better as a Python constant: each small one is a dimension joined
in SQL, and `role_patterns` is shared by SQL and Python. None is better as a source table,
because every one is hand-curated, versioned with the code and has no upstream system.
`ai_act_term_precision` holds measured results, which makes it the nearest candidate for a
source; it stays a seed because the sample is labelled by hand.

| Seed | Rows | Status | dbt `ref()` (models) | Tests | Other readers (`seeds.<name>` or `<name>.csv`) | Action |
| --- | ---: | --- | --- | --- | --- | --- |
| `ai_politics/ai_politics_concepts.csv` | 17 | used | `gold/ai_politics/mart_ai_politics_concepts.sql`, `gold/ai_politics/mart_ai_politics_examples.sql`, `silver/ai_politics/int_ai_speech_concepts.sql`, `silver/ai_politics/int_ai_speech_paragraphs.py` | `tests/concepts/assert_concept_link_targets_exist.sql`, `tests/ai_politics/test_concepts.py` | `nlp/text/concepts.py`, `publish/ai_politics/export_ai_politics.py`, `publish/concepts/export_concepts.py` | Keep: referenced by a model. |
| `ai_politics/ai_politics_framing_pairs.csv` | 3 | used | `gold/ai_politics/mart_ai_politics_framing.sql` | `tests/ai_politics/test_concepts.py` | `publish/ai_politics/export_ai_politics.py` | Keep as seed (3 rows, joined in SQL). |
| `concepts/cluster_concept_reviews.csv` | 0 | used | `gold/concepts/bridge_cluster_concept.sql` | none | none | Keep as seed: human review ledger, header only today (0 rows); `bridge_cluster_concept` is empty until a review lands. |
| `concepts/concept_links.csv` | 31 | used | `gold/concepts/mart_concept_links.sql` | none | none | Keep: referenced by a model. |
| `concepts/concept_tensions.csv` | 8 | used | `gold/concepts/mart_concept_relations.sql` | none | none | Keep: referenced by a model. |
| `concepts/concepts.csv` | 28 | used | `gold/concepts/dim_concept.sql` | `frontend/tests/unit/concepts.test.ts` | `nlp/concepts/build.py` | Keep: referenced by a model. |
| `concepts/corpora.csv` | 4 | used | `gold/concepts/dim_corpus.sql` | none | none | Keep: referenced by a model. |
| `cross_domain/ai_act_term_precision.csv` | 11 | used | none | `tests/python/test_ai_act_diffusion.py` | `publish/cross_domain/export_ai_act_diffusion.py` | Keep as seed (hand-labelled precision sample) but read it through a model or declare an exposure: today the exporter reads `seeds.ai_act_term_precision` directly, so dbt lineage cannot see it. |
| `cross_domain/ai_act_terms.csv` | 60 | used | `gold/cross_domain/mart_ai_act_term_diffusion.sql` | `tests/python/test_ai_act_diffusion.py` | `ml/ai_act/diffusion.py`, `nlp/ai_act_terms.py`, `publish/cross_domain/export_ai_act_diffusion.py` | Keep: referenced by a model. |
| `cross_domain/ai_governance_series.csv` | 5 | used | `gold/cross_domain/mart_ai_governance_timeline.sql` | none | `publish/cross_domain/export_ai_governance_timeline.py` | Keep: referenced by a model. |
| `eu_ai_act/ai_act_actors.csv` | 11 | used | `gold/eu_ai_act/dim_ai_act_actor.sql`, `silver/eu_ai_act/int_ai_act_article_actors.py` | none | `gold/eu_ai_act/schema.yml` | Keep: referenced by a model. |
| `eu_ai_act/ai_act_application_rules.csv` | 14 | used | `gold/eu_ai_act/dim_ai_act_article.sql` | `tests/eu_ai_act/assert_ai_act_quotes_in_current_text.sql` | `gold/eu_ai_act/schema.yml` | Keep: referenced by a model. |
| `eu_ai_act/ai_act_milestones.csv` | 12 | used | `gold/eu_ai_act/mart_ai_act_timeline.sql` | `tests/eu_ai_act/assert_ai_act_quotes_in_current_text.sql` | none | Keep: referenced by a model. |
| `eu_ai_act/ai_act_obligations.csv` | 51 | used | `gold/eu_ai_act/mart_ai_act_obligations.sql` | `tests/eu_ai_act/assert_ai_act_quotes_in_current_text.sql` | `gold/eu_ai_act/schema.yml`, `publish/eu_ai_act/navigator.json`, `quality/validity_registry.yml` | Keep: referenced by a model. |
| `eu_ai_act/ai_act_risk_classes.csv` | 6 | used | `gold/eu_ai_act/dim_ai_act_risk_class.sql` | `tests/eu_ai_act/assert_ai_act_quotes_in_current_text.sql` | `gold/eu_ai_act/schema.yml` | Keep: referenced by a model. |
| `job_ai_governance/job_ai_governance_terms.csv` | 13 | used | `gold/job_ai_governance/mart_job_ai_governance_terms.sql` | `tests/concepts/assert_concept_link_targets_exist.sql` | `ingest/jobtech/ingest_governance_terms.py`, `publish/concepts/export_concepts.py`, `publish/job_ai_governance/export_job_ai_governance.py` | Keep: referenced by a model. |
| `news/news_party_terms.csv` | 34 | used | `gold/news/fct_news_item_party.sql` | none | none | Keep: referenced by a model. |
| `news/news_topics.csv` | 16 | used | `gold/news/fct_news_item_topic.sql` | `tests/python/test_summarize_news.py` | `publish/export_news.py` | Keep: referenced by a model. |
| `parliament/committees.csv` | 25 | used | `gold/parliament/dim_committee.sql`, `gold/parliament/dim_issue.sql`, `silver/parliament/int_parliament_roll_calls.sql` | none | none | Keep: referenced by a model. |
| `parliament/governments.csv` | 9 | used | `gold/parliament/dim_government.sql` | none | `gold/parliament/schema.yml`, `gold/shared/schema.yml` | Keep: referenced by a model. |
| `parliament/issues.csv` | 15 | used | `gold/parliament/dim_committee.sql`, `gold/parliament/dim_issue.sql` | none | `gold/parliament/schema.yml` | Keep: referenced by a model. |
| `parliament/prime_minister_ballots.csv` | 10 | used | `gold/parliament/fct_prime_minister_ballot.sql` | none | `ingest/riksdagen/formation_ingest.py` | Keep: referenced by a model. |
| `parliament/prime_minister_party_votes.csv` | 83 | used | `gold/parliament/fct_prime_minister_party_vote.sql` | none | `ingest/riksdagen/formation_ingest.py` | Keep: referenced by a model. |
| `philosophy/tensions.csv` | 11 | used | `gold/philosophy/dim_tension.sql` | none | `nlp/philosophy/pipeline.py` | Keep: referenced by a model. |
| `politics/budget_governance.csv` | 12 | used | `gold/politics/mart_budget_context.sql` | none | none | Keep: referenced by a model. |
| `role_classification_patterns.csv` | 4 | used | `silver/jobs/int_job_ads_enriched.sql` | none | none | Duplicate of `role_patterns.csv` (same 4 role families and title regexes; only the Analytics Engineer regex differs, `engineers?` vs `engineer(s|ing)?`, and it lacks `taxonomy_pattern`). Merge into `role_patterns` after checking the regex change on `int_job_ads_enriched`. |
| `role_patterns.csv` | 4 | used | `gold/jobs/mart_job_trends_monthly.sql` | `tests/architecture/test_graph.py` | `ingest/jobtech/ingest_history.py`, `ingest/jobtech/role_scope.py` | Keep: one source of truth for SQL (`mart_job_trends_monthly`) and Python (`ingest/jobtech/role_scope.py`, `ingest_history.py`) readers. A Python constant would split it. |
| `shared/municipality_codes.csv` | 112 | used | `gold/shared/dim_municipality.sql` | none | none | Keep: referenced by a model. |
| `shared/parties.csv` | 11 | used | `gold/shared/dim_party.sql` | none | none | Keep: referenced by a model. |
| `sweden/domain_keywords.csv` | 12 | used | none | `tests/python/test_sweden_measurement_export.py` | `frontend/src/sweden/Measurement.tsx`, `publish/sweden/export_measurement.py` | Keep as seed; read with raw SQL `seeds.domain_keywords` in the exporter, outside dbt lineage. Add an exposure for `export_measurement.py`. |
| `sweden/kolada_area_domains.csv` | 22 | used | `gold/sweden/mart_sweden_measurement_items.sql` | `tests/python/test_sweden_measurement_seeds.py` | `publish/sweden/export_measurement.py` | Keep: referenced by a model. |
| `sweden/other_agencies.csv` | 6 | used | none | `tests/python/test_sweden_measurement_export.py` | `frontend/src/sweden/Measurement.tsx`, `publish/sweden/export_measurement.py` | Keep as seed; same lineage gap as `domain_keywords`. |
| `sweden/research_domains.csv` | 13 | used | none | `tests/python/test_sweden_measurement_export.py` | `publish/sweden/export_measurement.py` | Keep as seed; same lineage gap. Its `column_types` in `dbt_project.yml` sit under `sweden_language:` but the file is in `seeds/sweden/`, so the config does not apply (see section 8). |
| `sweden/scb_subject_domains.csv` | 35 | used | `gold/sweden/mart_sweden_measurement_items.sql` | `tests/python/test_sweden_measurement_seeds.py` | `publish/sweden/export_measurement.py` | Keep: referenced by a model. |
| `sweden_futures/future_subterms.csv` | 10 | used | `gold/sweden_futures/mart_sweden_future_subterms.sql` | none | `ingest/riksdagen/futures_language.py`, `publish/sweden/export_futures.py` | Keep: referenced by a model. |
| `sweden_futures/future_terms.csv` | 10 | used | `gold/sweden_futures/mart_sweden_future_themes.sql`, `gold/sweden_futures/mart_sweden_future_theses.sql` | none | `ml/feature_study/futures.py`, `ingest/diva/futures_theses.py`, `ingest/diva/futures_theses_detail.py`, `ingest/riksdagen/futures_language.py`, `publish/sweden/export_futures.py` | Keep: referenced by a model. |
| `sweden_language/ad_language_subterms.csv` | 4 | used | `gold/sweden_language/mart_sweden_job_language_bands.sql` | none | `ingest/jobtech/ad_language.py`, `publish/sweden/export_language.py` | Keep: referenced by a model. |
| `sweden_language/ad_language_terms.csv` | 9 | used | `gold/sweden_language/mart_sweden_job_language.sql`, `gold/sweden_language/mart_sweden_job_language_bands.sql` | none | `ingest/jobtech/ad_language.py`, `publish/sweden/export_connections.py`, `publish/sweden/export_language.py` | Keep: referenced by a model. |
| `sweden_language/occupation_field_crosswalk.csv` | 8 | used | `gold/clusters/mart_job_ad_municipality_field.sql`, `gold/clusters/mart_job_ad_occupation_month.sql`, `gold/sweden_language/mart_sweden_job_language.sql`, `gold/sweden_language/mart_sweden_job_language_bands.sql`, `gold/sweden_language/mart_sweden_job_language_totals.sql` | `tests/sweden_language/assert_field_labels_harmonised.sql` | none | Keep: referenced by a model. |
| `symbolic/symbol_aliases.csv` | 45 | used | `silver/symbolic/int_symbol_occurrences.py` | none | `ml/cluster_lab/datasets.py`, `silver/symbolic/schema.yml`, `quality/measures.py`, `quality/quality_registry.yml` | Keep: referenced by a model. |
| `symbolic/symbols.csv` | 20 | used | `gold/symbolic/dim_symbol.sql` | `tests/architecture/test_graph.py` | `quality/measures.py`, `quality/quality_registry.yml` | Keep: referenced by a model. |
| `taxes/household_types.csv` | 4 | used | `gold/taxes/fct_household_vat.sql` | none | none | Keep as seed (4 rows, joined in SQL). |
| `taxes/tax_countries.csv` | 40 | used | `gold/taxes/dim_tax_country.sql` | none | none | Keep: referenced by a model. |
| `taxes/tax_decisions.csv` | 62 | used | `gold/taxes/dim_tax_decision.sql` | `tests/ingest/verify_tax_dependencies_dbt.py` | none | Keep: referenced by a model. |
| `taxes/tax_types.csv` | 23 | used | `gold/taxes/dim_tax_type.sql` | none | none | Keep: referenced by a model. |
| `taxes/vat_spending_groups.csv` | 12 | used | `gold/taxes/fct_household_vat.sql` | none | none | Keep: referenced by a model. |
| `technology_patterns.csv` | 32 | used | `gold/jobs/bridge_job_skills.sql`, `gold/jobs/mart_skill_trends_monthly.sql` | none | `ml/feature_study/job_ads.py` | Keep: referenced by a model. |
| `welfare/ess_countries.csv` | 39 | used | `gold/shared/dim_country.sql` | none | none | Keep: referenced by a model. |
| `welfare/ess_rounds.csv` | 11 | used | `gold/shared/dim_period.sql` | none | none | Keep: referenced by a model. |
| `welfare/ess_variables.csv` | 21 | used | `gold/shared/dim_indicator.sql`, `silver/welfare/int_welfare_ess_answers.sql` | `macros/welfare_ess.sql` | `ingest/ess/ess_ingest.py` | Keep: referenced by a model. |
| `welfare/fohm_measures.csv` | 35 | used | `gold/shared/dim_indicator.sql` | none | none | Keep: referenced by a model. |
| `welfare/indicator_aggregation.csv` | 24 | used | `gold/shared/dim_indicator.sql` | none | none | Keep: referenced by a model. |
| `welfare/indicators.csv` | 11 | used | `gold/shared/dim_indicator.sql` | none | none | Keep: referenced by a model. |
| `welfare/kolada_kpis.csv` | 13 | used | `gold/shared/dim_indicator.sql`, `silver/welfare/int_welfare_kolada.sql` | none | `ingest/kolada/kolada_ingest.py` | Keep: referenced by a model. |
| `welfare/region_nuts.csv` | 21 | used | `gold/shared/dim_region.sql` | none | none | Keep: referenced by a model. |
| `welfare/sexes.csv` | 3 | used | `gold/shared/dim_sex.sql` | none | none | Keep as seed. Three rows, but dimension rows joined in SQL; a Python constant would move a dimension out of the warehouse. |
| `welfare/sources.csv` | 5 | used | `gold/shared/dim_source.sql` | none | none | Keep: referenced by a model. |

## 2. dbt models

325 models (113 bronze, 29 silver, 183 gold). Search per model: `ref('<model>')` in other
models, `ref('<model>')` in `platform/tests/`, and the model name as a word anywhere outside
`platform/models/`, `platform/tests/` and `*.md` (exporters read `gold.<model>` in SQL
strings; `pipeline.yml` names models in `select`/`exclude`). `enabled=false` occurs in no
model. One exposure exists: `gold_semantic_model` in `models/gold/politics/schema.yml`.
116 models are leaves; 109 of them have a Python, ML or `pipeline.yml` reader.

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `gold/parliament/fct_prime_minister_ballot` | test-only | no downstream `ref()`; name outside models/tests only in `docs/parliament-data-model.md:158` and `docs/political-observatory-v2.md:76`, which says its "workspace export was removed on 2026-10-22" | check: keep if Political Observatory v2 returns; otherwise delete with its tests and the `prime_minister_ballots` seed. Deleted 2026-10-23; seed kept (see cleanup status) |
| `gold/parliament/fct_prime_minister_party_vote` | test-only | same as above; seed `prime_minister_party_votes` feeds only this model | deleted 2026-10-23 |
| `gold/parliament/mart_party_pair_context` | test-only | only `platform/tests/parliament/assert_context_denominators.sql` refs it | deleted 2026-10-23 |
| `gold/parliament/mart_party_cohesion_context` | test-only | same test file | deleted 2026-10-23 |
| `gold/jobs/dim_occupation` | test-only | no downstream model or exporter; target of a `relationships` test in `models/gold/jobs/schema.yml:61`; listed in `public/data/schema/er.json` | keep: dimension of `fct_job_ads` shown in the published ER diagram |
| Exporters (`platform/publish/**`) | check | 1 exposure covers 13 politics models; no exporter reading `gold.*` is declared as an exposure | add exposures per export script so lineage shows the delivery edge |
| 51 bronze models with no YAML entry | check | `bronze/politics` (14): `stg_budget_coverage`, `stg_budget_frame`, `stg_budget_language_area`, `stg_budget_language_coverage`, `stg_budget_outturn`, `stg_decision_index`, `stg_decision_point`, `stg_party_activity`, `stg_party_vote`, `stg_point_citation`, `stg_point_reservation`, `stg_rfc_version`, `stg_speech_vote_candidate`, `stg_topic_session_party`; `bronze/welfare` (14): `stg_ess_respondents`, `stg_fk_diagnosis_chapters`, `stg_fk_sick_leave_cases`, `stg_fk_sick_pay_rate`, `stg_fohm_health`, `stg_fohm_measures`, `stg_kolada_kpis`, `stg_kolada_municipalities`, `stg_kolada_values`, `stg_scb_aku_month`, `stg_scb_aku_region`, `stg_scb_aku_regions`, `stg_scb_population`, `stg_scb_regions`; `bronze/parliament` (8): `stg_riksdagen_bill_preparation`, `stg_riksdagen_reports`, `stg_riksdagen_studies`, `stg_riksdagen_votes`, `stg_scb_election_seats`, `stg_scb_elections`, `stg_scb_psu`, `stg_val_riksdag_result`; `bronze/sweden` (7): `stg_kb_libraries`, `stg_kb_statistics`, `stg_similarity_panel`, `stg_similarity_points`, `stg_sweden_kolada_kpis`, `stg_sweden_scb_geography`, `stg_sweden_scb_tables`; `bronze/taxes` (4): `stg_oecd_revenue`, `stg_oecd_taxing_wages`, `stg_scb_household_spending`, `stg_skatteverket_rates`; `bronze/market` (2): `stg_market_ads`, `stg_market_conditions`; `bronze/news` (2): `stg_news_items`, `stg_news_people` | keep; add a YAML entry with key `not_null`/`unique` tests where the grain is known. 44 of them have no test at all; downstream gold tests cover them indirectly |
| `silver/eu_ai_act/int_ai_act_article_actors.py`, `bronze/jobs/stg_collection_coverage`, `bronze/job_ai_governance/stg_job_gov_examples` | check | YAML entry exists but has no column or model test, and no singular test refs them | add key tests |
| 34 gold models without `contract: {enforced: true}` | check | 149 of 183 gold models enforce a contract. Missing: `bridge_job_skills`, `dim_committee`, `dim_employer`, `dim_job_cluster`, `dim_location`, `dim_market_occupation_group`, `dim_municipality`, `dim_occupation`, `dim_party`, `fct_budget_frame`, `fct_concept_alignment`, `fct_election_municipality`, `fct_job_ads`, `fct_news_item_topic`, `fct_prime_minister_ballot`, `fct_prime_minister_party_vote`, `mart_cluster_assignments`, `mart_cluster_shares`, `mart_ethics_agreement`, `mart_job_ad_municipality_field`, `mart_job_ad_occupation_month`, `mart_job_ad_unmatched_municipalities`, `mart_job_clusters`, `mart_job_trends_monthly`, `mart_moral_foundation_agreement`, `mart_moral_foundation_shares`, `mart_moral_party_spread`, `mart_moral_swedish_check`, `mart_municipality_three_spaces`, `mart_party_cohesion_context`, `mart_party_pair_context`, `mart_skill_trends_monthly`, `mart_skill_year_comparison`, `mart_sweden_future_topic_clusters` | add contracts, starting with exported ones (`mart_job_trends_monthly` is in the semantic exposure) |

## 3. Python modules

276 modules under `platform/`, `ml/` and `scripts/`, excluding dbt Python models, tests,
`conftest.py` and `__init__.py`. A module is used if its path, its dotted module path or
its file name appears in any tracked text file, or its stem appears in an `import`/`from`
line or as a quoted string (catches `importlib` specs). 261 are used by non-test code or a
command. The rest:

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `ml/research/export_workers_ai.py` | unused (by any command) | its name occurs only in its own docstring; no workflow, `pipeline.yml`, `package.json` or doc runs it. It writes `frontend/public/data/workers-ai/debate/`, which `frontend/src/clusters/SentencePlacer.tsx:62` reads | keep: manual producer of a live file. Document the command in `docs/workers-ai.md` |
| `ml/mlkit/overnight.py` | check (docs-only) | run as `python -m mlkit.overnight` in `ml/README.md:30` and `ml/cards/*.md`; nothing automated runs it | keep: documented manual runner |
| `ml/research/export_public_maps.py` | check (docs-only) | only `docs/public-clustering-method.md:150,182` | keep: documented manual export |
| `platform/legacy/generate_data_dictionary.py` | check (docs-only) | only `docs/data-dictionary.md:3`, `docs/README.md:19`, `docs/legacy-cleanup.md:32`; the generated `docs/data-dictionary.md` is stale (section 8) | regenerate the dictionary or delete both together |
| `ml/research/public_results.py` | test-only | `ml/tests/test_public_research.py:14`; commands in `docs/public-clustering-method.md:98` and `ml/cluster_lab/README.md:16` | keep: documented manual command |
| `platform/compliance_intelligence/completion.py` | test-only | `platform/tests/compliance_intelligence/test_completion.py`; `docs/compliance-intelligence/completion.md` | keep: manual review CLI |
| `platform/compliance_intelligence/public_documents.py` | test-only | `test_public_documents.py`; `docs/compliance-intelligence/kkv-alternative.md` | keep: manual review CLI |
| `platform/publish/politics_boost.py` | test-only | `platform/tests/python/test_politics_boost.py:12`; writes `politics/parliament/boost.json`, read by `platform/quality/measures.py:419` and `quality/validity_registry.yml:119` | keep; add it to the politics subject or document the manual run |
| `platform/publish/politics_story.py` | test-only | `test_politics_story.py:11`; writes `politics/parliament/story.json`, read by `issue_debates.py:94` | keep, same as above |
| `platform/publish/issue_debates.py` | test-only | `test_issue_debates.py:9`; writes `politics/parliament/sakdebatter.json`, described in `frontend/src/projects/ProjectTech.tsx:143` | keep, same as above |
| `platform/nlp/ai_act_terms.py` | test-only | `platform/tests/python/test_ai_act_diffusion.py`; named in `docs/ai-governance-timeline.md` | check how `seeds/cross_domain/ai_act_terms.csv` is regenerated; keep if it is the generator |
| `platform/ingest/statskontoret/outturn_ingest.py` | test-only | `test_outturn_ingest.py:6`; writes `warehouse/outturn.sqlite`, and `outturn.sqlite` occurs nowhere else. dbt reads the committed `politics/parliament/budgets/outturn-areas.json` instead (`models/bronze/politics/sources.yml:64`), and no tracked code writes that file | check: either restore the step that turns the SQLite file into `outturn-areas.json`, or delete the ingest and its test |
| `platform/ingest/riksdagen/policy_ingest.py` | test-only | `test_policy_ingest.py:3`; writes `policy.sqlite`, which occurs nowhere else | check, as above |
| `platform/ingest/riksdagen/issue_ingest.py` | test-only | `test_issue_ingest.py:9`; writes `issue_speeches.sqlite`, which occurs nowhere else | check, as above |
| `scripts/check_security_headers.py` | test-only | loaded by `platform/tests/architecture/test_security.py:9`; manual commands in `docs/security.md:76` | keep |

Other scripts: `scripts/rank_local_jobs.mjs` (command in `docs/job-intelligence.md:127`) and
`scripts/start_cluster_lab.ps1` (`ml/cluster_lab/README.md:65`) are documented manual tools; keep.

## 4. Frontend

Import graph built from every `import … from`, `import()`, side-effect import, CSS
`@import` and `import.meta.glob` (the feed's `./posts/*.tsx` glob in `meaning/Feed.tsx:13`
counts every post as used) under `frontend/` and `worker/`. Every CSS file and every post
is reachable. Exported symbols were then searched as whole words in other files.

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `frontend/src/compliance/ComplianceExplorer.tsx` | check (unrouted) | no importer in `frontend/src` or `worker/`; `App.tsx` has no compliance route. Hashed into the release by `scripts/check_compliance_release.mjs:19` and `platform/compliance_intelligence/explorer.py:28` | delete only with both hash lists and a new reviewed release |
| `frontend/src/job-intelligence/JobIntelligence.tsx` | check (unrouted) | no importer; same two hash lists; `platform/tests/compliance_intelligence/test_job_content.py:31` | as above |
| `loadJobPreview`, `loadSymbolicPreview` (`home/umapIntroData.ts`) | unused | one occurrence each in the repository | delete |
| `backdropShade` (`home/backdropGeometry.ts`) | unused | one occurrence | delete |
| `setLocale` (`i18n.ts:14`) | unused | one occurrence; `i18n.ts:7` says the Swedish copy stays though nothing switches to it | keep: it is the switch the retained Swedish copy needs |
| `groupRoot`, `cvMatch`, `rankJob`, `validityOf`, `nodesOfCheck`, `nodeStatuses`, `tablesOf`, `refreshDelivery`, `MEANING` | test-only | used only by `frontend/tests/unit/*.test.ts` or `r2-delivery.spec.ts` | keep: tested entry points |
| About 60 exports used only inside their own file, e.g. `router.ts` (`REDIRECTS`, `redirectOf`, `pageOf`, `parseLocation`), `quality/QualityPanel.tsx` (`STATUS_TEXT`, `VALIDITY_TEXT`, `Glyph`, `StatusMark`, `ProductQualityView`), `quality/data.ts::loadQuality`, `clusters/debateData.ts` (`loadDebateSessions`, `loadDebateSession`), `ui/Story.tsx` (`ChartSection`, `SourceCaption`), `sweden/template.tsx` (`MethodDrawer`, `Interpretations`), `ui/dash/Dash.tsx::SlicerSelect`, `report/board/Columns.tsx::ColumnMultiples`, and type-only exports in `quality/types.ts`, `symbolic/atlasTypes.ts`, `tech/erLayout.ts`, `workersAi/*.ts` | check | no other file names them | drop the `export` keyword; no deletion. `ChartSection`, `SourceCaption`, `SlicerSelect` and `MethodDrawer` are named in `docs/data-storytelling.md`, `docs/design-system.md` and `docs/sweden-design.md` as shared components, so keep those exported |
| `frontend/public/previews/*.webp` (2) | unused | no reference anywhere, including `frontend/public` | deleted 2026-10-23 |
| `frontend/public/fonts/manrope-*.woff2`, `Manrope-OFL.txt` (3) | unused | no `@font-face` or other reference; site font is Helvetica (`tokens.css:7`) | deleted 2026-10-23 |
| `frontend/public/data/politics/parliament/debate-stats/*.json` (34) | check | not read by `frontend/src`, not in `catalog.json`; written by `platform/publish/export_debates.py:34`; read by `politics_story.py:164`, `issue_debates.py:82` and `configs/cluster_lab/public_research*.yaml` | keep: build input for other exports and ML configs |
| Other public data not named in frontend code (`gold/tables/*`, `gold/marts/*`, `parquet/**`, `workers-ai/ai-act-*/**`, `clusters/*.json`, `philosophy/moral/*`, `reports/*`) | used | each path is listed in `frontend/public/data/catalog.json` or a `configs/delivery/*.json` spec, so it is published open data; job cluster shards are listed in `jobs/cluster-summary.json` `shards` and read by `ClusterVisualsPage.tsx:127` | keep |
| CSS families with no class name in any `.ts`/`.tsx`: `.builder-*` (`report/theme.css`, 19 lines), `.budget-ledger*` (`pages.css`, 22), `.party-card*` (`parties/parties.css`, 11), `.q-case*` (`quality/quality.css`, 5), `.boxplot*` (`report/longread.css`, 3) | unused | prefix search returns 0 TS/TSX files | deleted 2026-10-23 |
| About 440 other CSS class selectors never written literally in TS/TSX (largest: `report/longread.css` 60, `report/theme.css` 49, `styles.css` 49, `ui/dash/dash.css` 28) | check | many are built at runtime (`ph-era-${i}`, `cc-rel-${type}`, `dk-*` from props) | review per family before deleting |

## 5. GitHub workflows

Triggers read from each file; run history from `gh run list --limit 1000` (905 runs since
2026-09-26).

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `refresh-job-analysis.yml` | duplicate | manual only; one job runs `python platform/pipeline.py run jobs_analysis` with the same data setup, concurrency group and failure issue that `data-subject.yml` provides. 0 runs in the window | merge: call `data-subject.yml` with `subjects: jobs_analysis` as `refresh-jobs.yml` and `refresh-news.yml` do. Kept 2026-10-23 (see cleanup status) |
| `refresh-welfare.yml` | duplicate | reimplements `data-subject.yml` for `welfare parliament taxes` (push, run `--only ingest,dbt,export`, run `--only publish`), plus a `full_refresh` input that `data-subject.yml` lacks | merge after adding a `full-refresh` input to `data-subject.yml`. Kept 2026-10-23 (see cleanup status) |
| `refresh-diva.yml` | check | manual only, 0 runs in the window; runs ingest, then export and publish, with no dbt step | keep: the only harvester for DiVA months |
| `terraform.yml` | check | 3 runs, 3 failures (last 2026-10-22) | fix or disable; it is not a duplicate. Cause found 2026-10-23 (see cleanup status) |
| Others (`ci`, `security`, `build-warehouse`, `cluster-jobs`, `data-heartbeat`, `data-subject`, `publish-r2`, `refresh-jobs`, `refresh-news`) | used | each ran in the window, or is called (`data-subject` by `refresh-jobs`/`refresh-news`) | keep |

## 6. Dependencies

npm: `hyparquet` is a dynamic `import('hyparquet')` in `frontend/src/parquet.ts:28`; `three`
is imported by `frontend/src/sweden/**`; `@axe-core/playwright` by 10 specs; `prettier`,
`typescript`, `vite`, `@vitejs/plugin-react`, `@playwright/test` and `wrangler` by scripts,
configs and deploy. Python: every requirement in `platform/requirements.txt`,
`requirements-*.in`, `requirements-symbolic.txt` and `ml/requirements.txt` has at least one
importing module (`pytest`, `dbt-core` and `pip-audit` are tools). Nothing is unused.

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `scikit-learn` 1.9.1 vs 1.8.0 | duplicate | `platform/requirements.txt` vs `ml/requirements.txt` | align versions |
| `pandas` 3.0.6 vs 3.0.1 | duplicate | same two files | align |
| `pyarrow` 25.0.1 vs 23.0.1 | duplicate | same two files | align |
| `PyYAML` 6.0.1 vs 6.0.2 | duplicate | same two files | align |
| `torch` 2.5.1 vs 2.14.1+cpu | duplicate | `ml/requirements.txt` vs `platform/requirements-ml.in` | align, or document why the local ML venv pins older wheels |
| `sentence-transformers` 5.4.1 vs 6.1.0 | duplicate | `ml/requirements.txt` vs `platform/requirements-symbolic.txt` | align |

## 7. Size and near-duplicates

Executable lines are lines that are not blank, not comment-only and not inside a Python
docstring or a `/* */` block; CSS counts every rule line. 74 of 1,138 code files exceed 300.
Generated data, `platform/sources/` and `.claude/` are excluded.

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `frontend/src/compliance/ComplianceExplorer.tsx` | oversized | 1,332 | delete if unrouted (section 4); otherwise split |
| `frontend/src/products/DrugCombReport.tsx` | oversized | 1,025 | split by section when next touched |
| `frontend/src/concepts/ConceptConstellationPage.tsx` | oversized | 981 | split |
| `frontend/src/sweden/Similarity.tsx`, `Belonging.tsx`, `Language.tsx`, `Futures.tsx`, `Measurement.tsx` | oversized | 955, 947, 862, 697, 675 | split; `Futures.tsx` and `Language.tsx` share 19 identical 8-line windows, so extract the shared part first |
| `frontend/src/philosophy/PhilosophyAtlasPage.tsx`, `clusters/ClusterLab.tsx`, `symbolic/SymbolicAtlasPage.tsx`, `concepts/Journey.tsx` | oversized | 874, 767, 661, 603 | split |
| CSS over 300: `sweden/sweden.css` 1,231, `report/longread.css` 1,055, `styles.css` 982, `report/theme.css` 906, `home/home.css` 724, `tech/tech.css` 674, `concepts/concepts.css` 597, `ui/dash/dash.css` 554, `report/board/board.css` 490, `sweden/atlas/atlas.css` 459, `symbolic/symbolic.css` 447, `report/dash.css` 443, `tokens.css` 434, `meaning/meaning.css` 406, `design-system.css` 399, `products/products.css` 397, `report/report.css` 377, `philosophy/philosophy.css` 366, `products/mlviz.css` 363, `quality/quality.css` 336, `job-intelligence/workspace.css` 318, `ui/story.css` 316, `clusters/clusters.css` 304 | oversized | line counts | remove dead families first (section 4), then split |
| Other TS/TSX over 300: `compliance/model.ts` 503, `lawqa/AskTheLaw.tsx` 486, `clusters/ClusterVisualsPage.tsx` 482, `symbolic/ResearchStory.tsx` 428, `charts/MultiLineChart.tsx` 379, `sweden/template.tsx` 375, `sweden/MeasurementExplore.tsx` 349, `sweden/FuturesExplore.tsx` 344, `products/DataExplorer.tsx` 337, `compliance/exports.ts` 332, `sweden/MunicipalityField.tsx` 330, `job-intelligence/ranking.ts` 326, `companies/model.ts` 324, `projects/projectRegistry.ts` 316, `ui/dash/TechCard.tsx` 313, `meaning/posts/job-language-maps.tsx` 301 | oversized | line counts | split when touched |
| Python over 300: `products/drugcomb/pipeline/src/drugsyn/figures.py` 501, `compliance_intelligence/analytics.py` 496, `compliance_intelligence/legal_review.py` 427, `publish/release.py` 385, `publish/job_companies.py` 384, `ml/cluster_lab/sweep.py` 366, `quality/measures.py` 361, `ml/cluster_lab/representations.py` 355, `ml/mlkit/tasks/polarization.py` 341, `legacy/build_gold.py` 333, `ingest/riksdagen/studies_ingest.py` 327, `ml/cluster_lab/public_research.py` 326, `ml/cluster_lab/datasets.py` 324, `compliance_intelligence/decision_ingest.py` 322, `compliance_intelligence/sources.py` 314, `compliance_intelligence/legal_extraction.py` 314, `nlp/symbolic/rank_clusters.py` 303 | oversized | line counts (paths under `platform/` unless they start with `ml/`) | split when touched |
| Tests over 300: `platform/tests/python/test_release.py` 385, `frontend/tests/portfolio.spec.ts` 380, `test_phase1.py` 364, `test_phase4.py` 360, `test_phase3.py` 357, `frontend/tests/sweden.spec.ts` 308 | oversized | line counts | keep; split only if they grow |
| `dump(name, payload)` in 6 exporters | duplicate | identical AST in `publish/ai_politics/export_ai_politics.py`, `publish/concepts/export_concepts.py:70`, `publish/eu_ai_act/export_ai_act.py`, `publish/job_ai_governance/export_job_ai_governance.py`, `publish/philosophy/export_philosophy.py`, `publish/quality/export_quality.py` | merge into `platform/lib/common.py` next to `write_json` |
| `sha256` in `ml/ai_act/diffusion.py` and `ingest/jobtech/ingest_market.py` | duplicate | identical bodies; `lib/rawstore.py:42` already has `sha256(payload)` | use the library one |
| `read` in `legacy/build_report_audits.py`, `legacy/validate_gold.py`, `legacy/validate_politics.py` | duplicate | identical bodies | merge into a legacy helper or `lib/common.read_json` |
| `text_url` in `ingest/philosophy/ingest_corpus.py` and `ingest/symbolic/ingest_corpus.py`; `excerpt` in `publish/concepts/export_concepts.py` and `publish/philosophy/export_philosophy.py`; `code` in `ingest/riksdagen/history_ingest.py` and `studies_ingest.py` | duplicate | identical function bodies | merge when touched |
| Feed post pairs `wel-panel-a/b` (31 shared 8-line windows), `pol-votes-a/b/c` (30, 21, 21), `job-ai`/`job-ai-fields` (25), `job-clusters*` (15-18), `pol-issues-a/b` (18) | duplicate | identical normalized 8-line windows between the files | extract the shared chart body into the subject's `*-kit.tsx` |
| `AskThePlatform.tsx` and `lawqa/AskTheLaw.tsx` | duplicate | 6 shared windows | check: share the search and answer block |

## 8. Stale docs

Every backticked or linked path and every `npm run` command in tracked Markdown outside
`.claude/` and `platform/sources/` was checked against the tree. All `npm run` commands
exist. Paths under `warehouse/`, R2 keys and run outputs were excluded as not tracked by
design. `docs/legacy-cleanup.md` names deleted files on purpose, as a removal log, and is
not listed. `docs/roadmap.md`'s `platform/publish/diva_terms.py` is planned work.

| Item | Status | Evidence | Action |
| --- | --- | --- | --- |
| `docs/chart-review.md` | stale | 11 paths that no longer exist, e.g. `frontend/src/politik/ThemeLayout.tsx`, `frontend/src/jobb/charts.tsx`, `frontend/src/welfare/WelfareExplorer.tsx`, `frontend/src/aiact/TimeSeries.tsx`, `frontend/tests/politik.spec.ts` | archive or mark as a 2026-10-13 snapshot |
| `docs/taxes.md:16-18,47,51,56` | stale | `frontend/src/taxes/calculator.ts`, `rules.ts`, `frontend/tests/unit/tax-calculator.test.ts` do not exist; there is no `frontend/src/taxes/` | rewrite the calculator section |
| `docs/storage-and-serving.md:46` | stale | `useData`/`useGoldData` "in `frontend/src/politics/data.ts`"; `useData` is in `frontend/src/meaning/kit.tsx`, `useGoldData` no longer exists | fix the path |
| `docs/data-constellation.md` | stale | `frontend/src/constellation/graph.ts`, `frontend/tests/unit/constellation.test.ts` missing; `frontend/src/ui/Trace.tsx` is now `frontend/src/meaning/Trace.tsx` | fix |
| `docs/design-system.md:71,167` | stale | `ui/Disclosure.tsx` and `politik/workspace/workspace.css` do not exist | fix: the approved design reference should name live files |
| `docs/job-intelligence-report.md` | stale | `frontend/src/jobb/JobsReport.tsx`, `frontend/tests/companies.policy.ts`, `companies.spec.ts`, `job-intelligence.spec.ts` missing | fix |
| `docs/ai-act.md` | stale | `frontend/tests/aiact.spec.ts`, `frontend/tests/unit/aiact.test.ts` missing | fix |
| `docs/political-observatory-v2.md:61` | stale | command `python platform/publish/politics_workspace.py`; the script was removed (2026-10-22 per `docs/parliament-data-model.md:159`) | remove the command |
| `docs/compliance-intelligence/validation.md`, `job-company-validation.md`, `repository-audit.md`, `kkv-alternative.md` | stale | `frontend/src/politik/workspace/Elections.tsx`, `jobb/JobsReport.tsx`, `frontend/src/jobb/data.ts`, `frontend/tests/compliance.spec.ts` missing | mark as dated review records or fix |
| `docs/data-dictionary.md` | stale | generated; names `data/budget/keywords.csv` (now `platform/sources/budget/keywords.csv`) and `politics/parliament/similarity/top.json`, `speakers/summary.json`, `votes/summary.json`, which are not in `frontend/public/data` | regenerate with `platform/legacy/generate_data_dictionary.py` or delete both |
| `platform/products/homie/README.md` | stale | `app/analytics/queries.py`, `tests/test_contract.py` not in `platform/products/homie/` | fix |
| `docs/workers-ai.md` | stale (gap) | does not name `ml/research/export_workers_ai.py`, the only producer of `workers-ai/debate/` | add the command |
| `AGENTS.md`, `CLAUDE.md`, `.claude/skills/graph-first/SKILL.md` | check | require `graphify-out/graph.json`, which is ignored (`.gitignore:13`) and absent from this checkout and the primary one | say how to build it, or that it is optional when absent |
| `ml/cluster_lab/README.md` | check | `configs/cluster_lab/replay.local.yaml` is not tracked; it may be a local file by design | say that it is local |
| `platform/dbt_project.yml` seed config | stale | `seeds.portfolio.sweden_language.research_domains` sets `column_types`, but the file is `seeds/sweden/research_domains.csv`, so the config does not apply | move the entry under `sweden:`. Done 2026-10-23 |
