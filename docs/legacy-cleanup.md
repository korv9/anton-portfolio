# Legacy cleanup

Audited on 13 October 2026 from `origin/main` at `587266f`, including PR46.
The assigned checkout had no graph. Focused 1,000-token Graphify queries used
the existing `shiner` graph read-only; all evidence below was checked here.

## Removed

| Files | Evidence of disuse |
|---|---|
| `platform/ingest/jobtech/export_analytics.py`, `build_powerbi.py`, `validate_powerbi.py`, `render_trends.py` | The isolated Power BI chain produced `Jobs.csv`, `Skills.csv`, `Comparison.csv`, PBIP/PBIR and a preview. No imports, subprocess calls, npm scripts, workflows or documented reproduction commands call it. No PBIP/PBIR or preview artifacts are tracked. Its only external filename reference was a comparison in `export_presentation.py`'s docstring, now removed. The manual `refresh-job-analysis.yml` runs `run_history_pipeline.py`, which uses `export_presentation.py` for the five site tables and workbook. |
| `frontend/src/politik/analytics/areas.ts`, `load.ts` | No application or test imports. TypeScript AST traversal from `main.tsx`, including exports and dynamic imports, confirmed both are unreachable. The earlier code-structure review independently identified them. |
| `frontend/src/politik/story/Debatterna.tsx`, `parts.tsx`, `story.css` | The retired debate story has no route or external imports; `parts.tsx` was imported only by `Debatterna.tsx`. Its stylesheet has no imports. Current debate routes load `debatter/Sakdebatter`, `Partiledardebatter` and `DebateView` through `PoliticsProduct.tsx`. |
| `frontend/src/taxes/TaxCalculator.tsx` | No imports, test references or route entry point. The tax aliases redirect into politics; `SkatterTheme` does not load this wrapper. Kept the calculation core, rules, fixtures and checks. Corrected the tax documentation's claims about the retired page and absent history module. |
| `frontend/src/jobs/jobs.css` | No stylesheet imports, including CSS `@import`, or HTML entry-point references. The live jobs product loads its own styles and the cluster stylesheet. |
| Platform `matplotlib` requirement | Its only caller in the platform environment was `render_trends.py`. DrugComb still declares Matplotlib in its separate `pipeline/pyproject.toml`. |
| `export_presentation.py`'s `ROLE_FILTER` alias | No readers in code, tests, commands or documentation. All queries use `ALL_ROLES` or `DATA_ROLES`; configuration still updates both. |

`build_politics.py` now uses the existing `common.raw_sha` helper in its mirror
and catalogue instead of a duplicate exact-byte SHA-256 function. CRLF bytes
remain significant. This does not switch historical catalogue hashes to the
portable newline-normalising hash.

## Retained and migration requirements

- `build_gold.py`, `build_products.py`, `build_speech_browser.py` and the four
  validators remain in `data:build` / `data:check`. CI and the manual historical
  jobs workflow call them. Politics dbt still reads delivered legacy facts.
- `build_politics.py` remains the documented snapshot reconstruction path in
  `storage-and-serving.md`; it calls `politics_budget.repair_budget`.
  `budget-provenance.md` also documents the budget CLI. The data dictionary
  still documents `generate_data_dictionary.py` as its generator.
- `build_report_audits.py` remains for published RFC and budget-language
  provenance. The committed report manifest records its historical script
  name/hash, and `test_report_exports.py` checks the outputs. Its old local
  path assumptions need migration and reconciliation before retirement.
- Older Riksdag issue/policy/vote and Statskontoret ingestion modules retain
  parser tests and CLI entry points. Their test-only callers do not establish
  that their reconstruction role can be discarded.
- Politics analytics `metrics.ts` / `types.ts` and tax `calculator.ts` /
  `rules.ts` retain direct unit-test callers, including real roll-call and
  Skatteverket fixture checks. Those meaningful checks remain intact.
- No dbt model was safely removable. Jobs marts feed the active presentation
  exporter; remaining subjects are selected by scheduled/manual workflows,
  npm commands or documented dbt builds. Unfiltered warehouse builds also
  select terminal models. A missing downstream `ref` is insufficient evidence.
- No npm script or workflow was removed; their file entry points resolve. React,
  Hyparquet, frontend tools, Wrangler and remaining Python dependencies have
  active imports or deployment/check callers. Jsonschema validates releases
  and optional news summaries; Snowball also powers `nlp/issue_lexicon.py`.
- Full live R2 bootstrap is still pending. Schema1 deliveries, historical
  catalogue compatibility, checkpoint restore, tax bootstrap ancestry,
  public-data annexes, optional news failure handling and R2 safeguards remain
  required. No datasets, public artifacts or provenance snapshots were deleted.

## Checks

- `python -m pytest platform/tests -q --basetemp tmp/pytest-legacy-cleanup-20261013-2`:
  421 passed, 2 skipped. The first invocation failed because its temp parent
  did not exist; the corrected full run passed.
- `npm run check`, `npm run format:check`, `npm run test:unit` and
  `npm run build`: passed; all 90 unit tests passed.
- `npm run data:check`: passed. Verified 31 tables, 714 source hashes,
  42 gold files, 12 sourced budget years, 16 exact party positions,
  eight project contracts, 22 DrugComb tables, 351 local politics checksums,
  4,586 catalogued shards and 1,436 roll-call member totals.
- `npx playwright test --config=frontend/playwright.config.ts routes.spec.ts navigation.spec.ts politik.spec.ts debatter.spec.ts jobb.spec.ts --output=test-results/legacy-cleanup-20261013-2 --workers=2`:
  19 passed, including desktop routes and mobile navigation. An initial npm
  forwarding attempt lost its flags on Windows and was stopped; the direct
  invocation used the unique output directory above.
- A local temporary-file check confirmed `common.raw_sha` equals SHA-256 of
  exact CRLF/binary bytes and the legacy mirror copies changed files while
  skipping identical ones. No data was rebuilt or ingested.
- npm/workflow file entry points resolve; repository-wide searches found no
  stale callers of the deleted JobTech chain or alias. No public-data files,
  workflows, dbt models, ML code or meaningful tests changed.
- `python .claude/skills/de-ai-writing/scripts/check_ai_signs.py docs/legacy-cleanup.md`:
  zero hits. The scanner lives under the skill; the root `scripts/` path in
  `CLAUDE.md` is absent. New prose was also reviewed by hand.
- `git diff --check`: passed. No R2 writes, remote publication or graph rebuild.
