# Validation and changed files

Run date: 2026-10-16. Phase 0 only. No live ingestion, publishing, deployment or
remote write was performed. Test data is synthetic and held in memory.

## Results

| Check | Result | Notes |
| --- | --- | --- |
| `python -m pytest platform/tests/compliance_intelligence -q` | 15 passed | Empty isolated schema, original-byte hashing, unknown defaults, legal-category/monetary/finality guards, decision/case linkage, review and attribution safeguards. |
| `python -m pytest platform/tests -q --basetemp <new workspace tmp directory>` | 456 passed, 2 skipped | Completed in 41.81 seconds. Includes the new contract tests. |
| Initial `python -m pytest platform/tests -q` | 322 passed, 2 skipped, 134 setup errors | Windows denied access to `C:/Users/46762/AppData/Local/Temp/pytest-of-46762`. Retried using a fresh GUID-named directory under workspace `tmp/`; no source fix needed. |
| `npm run test:unit` | 99 passed | Existing frontend Node unit suite. |
| `npm run check` | Failed outside changed scope | Unused imports and missing `label`/`ceiling` props in `frontend/src/politik/workspace/Elections.tsx`; missing `Overview`, `Parliament`, `Economy` and `Debates` imports in `Workspace.tsx`. |
| `npm run format:check` | Failed outside changed scope | Reported `frontend/src/politik/workspace/{data.ts,Elections.tsx,logic.ts,Workspace.tsx}`. These files were not edited by this task. |
| Repository prose scanner | Passed after editing one flagged phrase | Ran `.claude/skills/de-ai-writing/scripts/check_ai_signs.py` on every new Markdown document; final scan has zero hits. |
| Local document links and whitespace | Passed | Checked links relative to each document and trailing whitespace in new files. |
| `npm.cmd run ideas:extract -- --input <final answer file> --project compliance-intelligence --apply` | Failed on existing journal data | `platform/idea_lineage/store.py` raises `KeyError: 'created_at'` while reading the existing journal, before writing events. Decisions remain recorded below; unrelated journal data was not edited. |
| Browser/E2E and deployment checks | Not run | No frontend, route, CSS, hosting or animation change. |

The frontend failures describe the shared worktree at test time; this is not a
comparison against a clean checkout or a diagnosis of other ongoing work. Full logs
remain in ignored workspace files `tmp/compliance-phase0-{pytest,pytest-retry,unit,format}.log`.

The contract checks do not establish correct identity resolution, an immutable
50-company sample or a working publication gate. Those are explicitly outside Phase 0.
Cross-table semantic checks still required are listed in the dictionary/architecture.

## Files added

All task changes are new files. Existing tracked files, including the homepage,
intro components, workflow registry and delivery configuration, were not edited.

| File | Purpose |
| --- | --- |
| `docs/compliance-intelligence/README.md` | Scope, navigation and executable entry point. |
| `docs/compliance-intelligence/repository-audit.md` | Actual repository and storage/deployment findings. |
| `docs/compliance-intelligence/architecture.md` | Entity/cohort/lifecycle design, provenance, review and metrics. |
| `docs/compliance-intelligence/source-feasibility.md` | Official-source matrix, history, access and reuse evidence. |
| `docs/compliance-intelligence/data-dictionary.md` | Fields, grain, constraints, required-field mapping and deferred checks. |
| `docs/compliance-intelligence/risks.md` | Privacy/publication risks and control owners. |
| `docs/compliance-intelligence/phase-1-handoff.md` | Exact inputs, steps, outputs and acceptance checks for Phase 1. |
| `docs/compliance-intelligence/validation.md` | This report. |
| `platform/compliance_intelligence/schema.sql` | Thirteen empty domain tables and local constraints. |
| `platform/compliance_intelligence/contracts.py` | In-memory schema interface and unimplemented original-document reader protocol. |
| `platform/tests/compliance_intelligence/test_contracts.py` | Offline executable contract checks. |

No dependencies, migrations in the live warehouse, company sample rows, enforcement
records, dashboard code or source credentials were added.

## Decisions for handoff

Decision: Freeze a source-backed legal-entity cohort before searching enforcement data.

Decision: Keep unreviewed evidence outside the publicly backed-up warehouse and R2 bucket.

Finding: Existing employer IDs include name fallbacks and cannot establish legal identity.

Finding: Published regulatory/court sources have unequal and incomplete historical coverage.

Open question: Establish authorized register access and dataset reuse terms before selecting 50 companies.
