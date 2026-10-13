# Release verification, 13 October 2026

Branch: `korv9/r2-daily-delivery`. Includes the current portfolio changes, public clustering research and the data-delivery fixes. The branch incorporates the latest main JobTech delivery before testing.

## Local checks

- TypeScript, Prettier, 90 frontend unit tests and the production build passed.
- Platform: 421 passed, two skipped. Windows required a workspace `--basetemp` because the system temporary directory denied access.
- ML: 11 tests passed.
- Gold, budget, product and politics data contracts passed, including 4,586 catalogued shards.
- Wrangler deployment dry run passed.
- Full browser suite: 124 passed; two remaining checks expected the retired language switch. Updated those checks to verify the current English introduction and job-search text. All eight CV browser tests then passed on desktop and mobile.
- Fixed the cluster research link from the unrecognized `#welfare` address to `#sweden`.

## Supervised task outcomes

- Public-data repair succeeded: metadata-backed annex handling, preserved checkpoints, explicit tax model ancestry and an isolated bootstrap through 37 dbt nodes for 62 decisions. Live source checks confirmed the parent document and the eight missing annex routes. A complete scheduled source refresh remains to be observed.
- News repair succeeded: optional model failures preserve the dated prior summary; mandatory input and write failures stop publication. Semantic delivery validation succeeded with 61 focused regression tests.
- Workflow integration succeeded: 31 focused YAML/Bash regressions cover credentials, checkpoint ordering, optional summaries, staged bootstrap and one activation after all groups succeed.
- R2 delivery succeeded: 19 publisher regression tests and seven focused browser checks cover immutable releases, conditional activation, lazy indexes, pinned snapshots and rollback.
- All active Orca dispatches reported success; their terminal resources were released after review. Earlier completed dispatches transferred their terminals to these follow-up tasks.

## Real R2 smoke

Published only already-public news and polls into `smoke-r2-delivery-20261013`, using `manifests/smoke-r2-delivery-20261013.json`. Conditional creation, conditional replacement, repeat publication, exact-byte readback and rollback passed. The production `manifests/current.json` bytes remained unchanged.

A Chromium page on localhost fetched the public smoke manifest, verified index and payload hashes, and read 130 news items. The manifest returned HTTP 200 and `no-cache, max-age=0, must-revalidate`. This proves browser access from localhost, not every production or preview origin.

## Activation still pending

Production keeps the schema1 bootstrap until the complete public bundle is materialized, staged and verified. Run `publish-r2.yml` for that bootstrap, then enable the live manifest through the documented build configuration. Scheduled workflows publish data directly to R2; the site must be switched to the live manifest to display those updates. Verify the actual production domain, CORS and cache rules at that point. No private thesis source, raw warehouse or credentials are included in this commit.

Decision: Merge the verified code while keeping full R2 activation separate from the isolated smoke.
Finding: Real R2 supports the conditional writes and rollback used by the new publisher.
Open question: Confirm the first complete GitHub bootstrap and source refresh before enabling live delivery.
