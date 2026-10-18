# Job Intelligence graph update

Updated 2026-10-18 with the installed Graphify interpreter. The local graph now contains **7,477 nodes, 18,394 edges and 661 communities**, compared with 6,289 nodes before this update.

## Scope and evidence

The update re-extracted 414 tracked code files: production frontend/platform code, selected scripts, Worker files and the canonical job-link SQL schema. The selection includes the Worker unit-test file. It also extracted 41 semantic nodes and 91 evidence-labelled edges from five public documents:

- `docs/job-intelligence.md`
- `docs/job-intelligence-report.md`
- `docs/compliance-intelligence/README.md`
- `docs/compliance-intelligence/architecture.md`
- `docs/compliance-intelligence/job-company-integration.md`

The broad repository has 947 structural candidates. This bounded update excludes unrelated ML, configuration and most tests. Tier-aware merging preserves unselected AST sources and previous semantic evidence; 3,536 prior nodes outside the selected source set remain present. Earlier document/media evidence was retained without claiming fresh verification. No CV, profile, private research, environment or raw collection file was read for this update.

New semantic edges carry exact source paths, line locations, evidence quotes and `EXTRACTED` confidence with score 1.0. No fuzzy entity merge or external model backend was used. SQL identity links retain their canonical table definition.

## Verification and limitations

Both local caches resolve these symbols to current source locations:

| Symbol              | Source                                                |
| ------------------- | ----------------------------------------------------- |
| `JobIntelligence()` | `frontend/src/job-intelligence/JobIntelligence.tsx:9` |
| `rankJob()`         | `frontend/src/job-intelligence/ranking.ts:61`         |
| `useWorkspace()`    | `frontend/src/job-intelligence/useWorkspace.ts:13`    |
| `job_company_link`  | `platform/compliance_intelligence/job_links.sql:16`   |

Post-build diagnostics report zero missing/dangling endpoints and zero duplicate or collapsed edges, with **25 self-loops**. The graph has 318 isolated nodes and 343 nodes without a source path, including external-reference stubs. Community cohesion ranges from **0.026992615227909345 to 1.0**, median **1.0**; singleton communities can have perfect cohesion, so this is not an accuracy score.

The fresh extraction fragment separately reports 2,033 dangling-endpoint edges, 37 self-loops, two exact duplicates and 262 undirected same-endpoint collapses before merge. Fragment references can resolve against retained nodes or become reference stubs during graph construction. The post-build zero count does not prove that the extractor resolved every external symbol. The graph remains a navigation index; verify relationships against source before changing behavior.

Seven entrypoints/scripts yielded no symbols. Windows multiprocessing failed and Graphify completed a sequential AST fallback. No dependency was installed. AST extraction failed-source list is empty.

AST used zero model tokens; external LLM API calls were zero. Host-session semantic input/output usage is unavailable to Graphify. Its zero counters must not be interpreted as zero session usage or a measured cost saving. No dollar-cost or token-reduction benchmark was measured.

## Local outputs

`graphify-out/graph.json`, `GRAPH_REPORT.md`, health diagnostics, scope receipts, manifests and cost annotations remain ignored local artifacts in both the integration checkout and the original checkout. Original-cache root metadata identifies its local query root and separately records the integration snapshot source. Previous graph/report/manifest/cost files are preserved in a timestamped local backup.

HTML was not regenerated because the graph exceeds 5,000 nodes. Any existing `graph.html` describes the earlier graph. This audit contains only generic implementation and verification information; graph contents are not added to Git.
