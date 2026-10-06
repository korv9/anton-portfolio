# Quality & validity

Correct data and valid measurement are different problems. This platform tests both, and keeps
them apart.

- **Data quality** asks whether the data correctly represents what it claims to represent. Did
  I build the dataset correctly?
- **Analytical (construct) validity** asks whether an analysis or model measures the construct
  it is meant to measure. Does the analysis answer the question it claims to answer?

A dataset can pass every quality check and still support an invalid conclusion. In the Symbolic
Atlas, for example, every occurrence is extracted correctly, yet the baseline clusters follow
which book a passage comes from more than its symbolic meaning.

```
npm run quality            # evaluate, dbt build --select tag:quality, publish
npm run quality:build      # python platform/quality/evaluate.py && dbt build --select tag:quality
npm run quality:publish    # frontend/public/data/quality/*.json
```

Pages:

- `#quality` is the technical overview: product matrix, the Symbolic Atlas case study, every
  analysis, every check, method and limitations.
- Each major product has a compact *Quality & validity* section.
- Data Constellation has a *Quality* view, and the node panel shows quality and validity for
  products and models.

## Standards: what is and is not claimed

- The platform maps selected checks to **ISO/IEC 25012** data-quality characteristics.
- Where quantitative measures are defined, each states its calculation, numerator, denominator
  and threshold. This is **aligned with ISO/IEC 25024 measurement principles where
  applicable**; no exact ISO/IEC 25024 formula is claimed.
- ML and analytics data-quality considerations (split integrity, leakage, imbalance, coverage)
  may reference the **ISO/IEC 5259** family. They are recorded as validity diagnostics of kind
  `ml_data_quality`, not as ISO/IEC 25012 dimensions.

This is an internal engineering quality model inspired by and mapped to these standards. It is
not ISO-certified, not "fully ISO compliant" and has not been audited against any standard.

## Data-quality dimensions (`platform/quality/dimensions.py`)

| Dimension | Plain question | ISO/IEC 25012 |
|---|---|---|
| Accuracy | Does the data match the source? | Accuracy (inherent) |
| Completeness | Is expected data missing? | Completeness (inherent) |
| Consistency | Do related records agree? | Consistency (inherent) |
| Credibility | Where does the data come from? | Credibility (inherent) |
| Currentness | How fresh is the data? | Currentness (inherent) |
| Traceability | Can every value be traced to the file it came from? | Traceability (inherent and system-dependent) |

Each product declares only the dimensions it actually evaluates.

**Accuracy** means a stored or derived value correctly represents its source attribute. Two
examples:

- an AI Act article number matches the Official Journal;
- a symbol occurrence points at the matched word.

Accuracy is never used to mean that a model measures the intended concept; that is construct
validity. Whether a corpus represents its domain is **representativeness**, also a validity
question.

## Validity vocabulary

Kinds:

- `construct_validity`: are we measuring the thing we think we're measuring?
- `confounding`: could something else explain the result?
- `representativeness`: does the data represent the domain the question is about?
- `ml_data_quality`: are the training and evaluation data sound?

Statuses: `supported`, `warning`, `insufficient_evidence`, `invalidated`, `not_evaluated`. The
platform never says "true", "proven" or "verified meaning". An analysis takes the status of its
weakest diagnostic.

## Registries

**`platform/quality/quality_registry.yml`** has one entry per check. Each entry has:

- `id`, `product`, `dataset`, `dimension`, `description`;
- `method`: one of `dbt_test`, `python`, `manual_review`, `not_measured`, `not_applicable`;
- `measure`, with `numerator` and `denominator` for ratios;
- `threshold`, an optional `warn_at`, and `comparator` (`>=`, `<=` or `==`);
- `severity`: `info`, `warning` or `error`;
- `source`: what the check is checked against;
- `gate`: whether a failure blocks a run;
- `dbt` (for dbt checks: test names, or a folder plus test kinds), `function` (for Python
  checks) or `reason` (for unmeasured or inapplicable checks).

**`platform/quality/validity_registry.yml`** has one entry per analysis. Each entry has:

- the question, target construct and proxy measure;
- its diagnostics. Each diagnostic has:
  - a `function` that reads an existing artefact;
  - a `rule` (`metric_below` or `metric_above`, with `then` and `otherwise` statuses), or a
    stated `status` for qualitative findings;
  - an interpretation.
- a conclusion, and optionally a history function.

The registry also lists **confounders**: analysis, confounder, diagnostic, effect, mitigation
and remaining risk.

`registry.py` refuses the following, and the tests run it:

- duplicate ids;
- unknown dimensions, statuses, methods or products;
- a measured check without a threshold;
- a Python check without its function;
- a validity kind that pretends to be an ISO/IEC 25012 dimension.

## Result schemas

**Quality check** (`gold.mart_quality_checks`), one row per check:

- identity and definition: `quality_check_id`, `product_id`, `dataset_id`, `dimension`,
  `measure_name`, the numerator and denominator definitions;
- the result: `value`, `numerator`, `denominator`, `threshold`, `warn_at`, `comparator`,
  `status`;
- how it was evaluated: `severity`, `method`, `source`, `gate`, `sample_size`, `reviewed_at`,
  `details`, `evaluated_at`.

Statuses are `pass`, `warning`, `fail`, `not_measured` and `not_applicable`. Severity is
separate from status. A dbt test test checks that `not_measured` and `not_applicable` never
carry a value, and that measured statuses always do.

**Validity diagnostic** (`gold.mart_analysis_validity`), one row per diagnostic:

- the analysis: `analysis_id`, `product_id`, `kind`, `question`, `target_construct`,
  `proxy_measure`;
- the diagnostic: `diagnostic`, `experiment`, `result` (derived), `rule`, `status`;
- the reading: `interpretation` and `conclusion` (both interpretation), `evaluated_at`.

**Summaries:**

- `mart_product_quality_summary` is product × dimension with measured, pass, warning, fail,
  not-measured and not-applicable counts.
- `mart_product_validity_summary` is product × validity kind.

There is no single quality score anywhere. Also: `mart_analysis_confounders`,
`mart_validity_history`.

## How checks run (`platform/quality/evaluate.py`)

1. Load and validate both registries.
2. Resolve each dbt check's tests from the dbt manifest, run only those tests
   (`dbt test --select …`) and read `run_results.json`. The existing dbt tests are reused, not
   rewritten. A test that errored or was skipped (for example because its model is not built)
   measured nothing; a check whose tests all failed to run is `not_measured`.
3. Python checks (`measures.py`) cover what dbt cannot:
   - source reconciliation, such as two independent counts of the same JobTech archives, or
     the AI Act's published structure;
   - provenance hashes;
   - official-host checks;
   - freshness from the raw fetch logs.
4. Manual reviews record `sample_size`, the valid count, `reviewed_at` and the reviewer's role
   (not a name). The value is labelled sample-based. Without a review the check is
   `not_measured`.
5. Validity diagnostics are read from the pipelines' own artefacts. No model is retrained or
   re-embedded. The artefacts are:
   - Symbolic Atlas `experiments/comparison.json`, plus the before-cleaning history;
   - the Philosophy Atlas and concept-layer `run.json`;
   - the politics vote model's `boost.json`;
   - the AI Act navigator and the timeline mart.
6. Outputs go to `warehouse/features/quality/`: `quality_checks.parquet`,
   `analysis_validity.parquet`, `validity_history.parquet`, `confounders.parquet`,
   `products.parquet` and `run.json`, which records the registry's SHA-256. `history.jsonl`
   appends every run's statuses, so a change such as warning → fix → pass can be followed.

`build-warehouse.yml` runs the evaluation before storing the warehouse in R2. After the store it
runs `evaluate.py --gate`, which fails the run if a **gated** check failed. Gated checks are
structural: keys, relations, reconciliation, provenance, required sources. Validity
diagnostics never block a build.

## Current results (6 October 2026)

There are 42 checks across seven products, built on 259 existing dbt tests:

- 36 pass;
- 4 are not measured;
- 2 are not applicable.

There are 14 analyses with 27 diagnostics: 7 supported, 11 warning, 9 insufficient evidence.

- **Fixed.** `politics_keys_and_relations` failed in the first run: 4 roll calls had a
  committee key that does not exist (`''` three times in 2025/26, `'p'` once in 1994/95),
  because their designations (`0604-1`, `p19`) name no committee. They now go to the committee
  `ovrigt` (Övriga omröstningar), which has no policy issue, and the check passes.
- **Not measured.** These are all real gaps:
  - Symbolic occurrence sample review (no sample reviewed yet);
  - Riksdag vote totals against member votes;
  - job-ad parsed fields against source records;
  - welfare values against the agencies' own tables.
- **Not applicable.** Currentness for the historical text corpora (Symbolic, Philosophy).
- **Symbolic Atlas (flagship).**
  - Baseline: largest book's share of a cluster 0.69; 11 % of occurrences in cross-book
    clusters.
  - After book centring: 0.58 and 32 %.
  - Before paratext cleaning, the baseline was 0.74 and 7 %.
  - Book entropy rises and trustworthiness barely moves. No cluster has been reviewed, so
    "symbolic meaning" stays insufficient evidence.
- **Politics vote model.** Training and test sessions differ, which is supported. The model
  beats the majority baseline for 4 of 8 parties, which is a warning.
- **Concept layer.** Same-corpus neighbours are 3.8 × chance (warning); Swedish and English
  anchors agree for every concept (supported).

## Adding a product

1. Add the product to `products` in `quality_registry.yml`.
2. Register checks. Prefer existing dbt tests (`method: dbt_test`). Add a Python measure only
   for what dbt cannot check. Use `not_measured` with a reason rather than inventing a
   measurement.
3. Register its analyses in `validity_registry.yml`, with diagnostics that read existing
   artefacts.
4. Run `npm run quality`, then render `<ProductQuality product="…" />` on the product page.

## Limitations

- Accuracy against an independent copy of the source is measured for some products only.
- Thresholds are editorial and stated with every check.
- Freshness depends on the fetch logs and the job stream's manifest. Job ads, parliament,
  welfare, taxes and news refresh each morning; the other sources only when the warehouse is
  rebuilt by hand, so their currentness ages between builds.
- A supported diagnostic means one test did not find a problem, not that a conclusion is
  proven.
- Diagnostic labels and interpretations are in English.
