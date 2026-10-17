# Phase 5 validation

Historical validation run. The later authenticated population, frozen cohort and expanded evidence batch are recorded in [current completion](completion.md). Counts and input-status statements below refer to this report's original run.

Checked 2026-10-17. The four explorer pages and research exports are implemented;
the public release is still an explicit unavailable state. SCB access subsequently
became available: an authenticated count request returned HTTP 200 at
`2026-10-17T10:55:30.208432+00:00`. That access check is not a frozen 50-company
cohort or a human approval of any legal outcome.

## Results

| Check | Result |
| --- | --- |
| Full Python suite, fresh workspace-local basetemp | 616 passed, 2 skipped; 135.78 seconds. |
| Final Phase 5 producer/review tests | 15 passed, including Python/TypeScript metric agreement and presentation-fingerprint rejection. |
| Full desktop/mobile Playwright suite | 150 passed, 2 skipped; 2.3 minutes. |
| New explorer browser checks within that suite | 8 passed, including mobile empty/detail states, source links, filtering, foreign group roots and expiry. |
| Security policy checks against the production build | 2 distinct tests repeated three times; 6 passed in 9.5 seconds. |
| Frontend unit tests | 111 passed. |
| TypeScript, production build and formatting | Passed. |
| Prose scanner on new UI/export copy and changed Markdown | Zero findings. |

The producer tests use owned synthetic PDFs, temporary canonical registries and
test-role human reviews. A cross-language test compares browser count/currency
results with the actual Phase 4 Python output from that reviewed synthetic flow.
No fixture company is placed in the public artifact. Real authority-publication
regressions remain pending real canonical identities and actual human reviews.

SVG width/height and source/release metadata are checked from downloaded file
contents. PNG header bytes verify exactly 1200 × 1500 pixels; square SVG is exactly
1200 × 1200. CSV and Markdown downloads succeed. PNG uses generated SVG values,
with no screenshot-based data extraction. Formula-like CSV cells, XML markup,
unsafe source URLs, stale approvals, altered staged metrics and cross-company
attribution are covered by tests. Dependency reverification deadlines also limit
the public release.

Visual inspection covered desktop/mobile unavailable states and a synthetic test
portrait export. The report shell, Helvetica stack and existing neutral/violet
tokens remain consistent. The verification notice is the visual marker; ranks do
not use risk colors. Hierarchy remains readable without a card grid, and no
project-specific root tokens or motion were added. Module axe checks passed.

The new project changes the retained project count from 11 to 12; those navigation
assertions were updated. Route discovery now waits for the compliance report shell.
Security test teardown cancels remaining routed requests through Playwright's
documented cleanup option. Browser runs use separate output directories to prevent
artifact collisions. Existing homepage intro, scroll and animation tests passed;
their implementation files were not edited.

## Files changed for Phase 5

- `platform/compliance_intelligence/explorer.py`: private staging, exact-artifact
  human approval, promotion, withdrawal and dependency expiry.
- `platform/tests/compliance_intelligence/test_phase5.py`: producer, review, public
  projection, cross-language and build-fingerprint regression checks.
- `frontend/src/compliance/{ComplianceExplorer.tsx,model.ts,exports.ts,compliance.css}`:
  four views, validation, structured exports and scoped styling.
- `frontend/public/data/compliance/release.json`: unavailable state only.
- `frontend/src/{App.tsx,router.ts}`, `projects/projectRegistry.ts`: lazy route and
  existing-menu integration.
- `frontend/tests/{compliance.spec.ts,compliance.policy.ts}`, `fixtures/compliance.ts`,
  `unit/compliance.test.ts`: browser/security and isolated fixture coverage.
- `frontend/tests/{portfolio.spec.ts,routes.spec.ts,security.policy.ts}` and
  `frontend/security.playwright.config.ts`: navigation contracts and security cleanup.
- `scripts/check_compliance_release.mjs`, `package.json`: public-data build gate.
- `frontend/public/_headers`: no-store for the current compliance envelope; CSP unchanged.
- `.github/workflows/ci.yml`: Node 22 for Python/TypeScript reconciliation.
- Compliance README, architecture, dictionary, public methodology and Phase 5 docs.

Extensive unrelated worktree changes were preserved. No public R2 upload, deployment,
actual human review or full enforcement ingestion was performed. Follow
[Phase 5 operations](phase-5.md) for the remaining real-data and publication steps.
