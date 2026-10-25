# Storage and serving

Where the data lives and how the site finds a file. What builds and publishes the data, and
when, is in [pipeline.md](pipeline.md). The rules for a versioned release are in
[r2-delivery-contract.md](r2-delivery-contract.md).

## What is stored where

| What | Where | Written by |
|---|---|---|
| Code, dbt models, seeds, schemas, test fixtures | Git | Commits |
| The site's JSON, 690 files in the catalogue | `frontend/public/data/` in Git, which the site reads; also in R2 releases, which it does not | The exports; a group's publish step |
| Parquet marts (68 files) and document shards (4,586) | R2 bucket `anton-portfolio` | A group's publish step |
| Raw source files, ML features, the DuckDB warehouse | R2, under `warehouse/` | `pipeline.py push`, `build-warehouse.yml` |
| Secrets | GitHub and Cloudflare secrets | By hand |

The counts are from `catalog.json` on 13 October 2026. The bucket is public and holds only
open data. A folder called `private` in a public bucket is not an access boundary; private
originals, such as the degree project's source material, are not uploaded.

## The catalogue

`platform/publish/build_catalog.py` (`npm run data:catalog`) writes two files in
`frontend/public/data/`:

- `catalog.json`: one entry per delivered file with `path`, `product`, `format`, `bytes`,
  `rows`, `schema_version`, `partition`, `sha256` and `run_id`. The publish step and the
  validators read it. The browser never fetches it; it is 1.8 MB.
- `delivery.json`: what the site fetches at startup. It holds the base URL per format, the
  prefixes that mark a path as a shard, and the Parquet parts per dataset.

`run_id` is a hash of the catalogued content, so an unchanged tree rebuilds byte for byte.
Entries written by catalogue version 2 carry the SHA-256 and size of the exact bytes. Entries
for files that were moved to R2 under version 1 keep a hash taken after CRLF was normalised
and are marked `sha256-crlf-normalized`; they are read back with that rule and get an exact
hash the next time they are published.

## How the site resolves a path

Components ask for logical paths such as `gold/overview.json`, never URLs.
`frontend/src/dataSource.ts` turns the path into a URL.

| Function | Use |
|---|---|
| `fetchData(path, init?)` | Any fetch of a data file |
| `useData(path, root)`, `useGoldData(path)` | React hooks in `frontend/src/politics/data.ts` |
| `useDataUrl(path)`, `resolveDataUrl(path)` | A resolved URL for a link or download |

The production site reads the data committed under `frontend/public/data`. The committed
`delivery.json` has schema version 1, JSON base `data/`, and the bucket's `r2.dev` address for
Parquet and shards. It has no `manifest_url`, and `VITE_R2_MANIFEST_URL` is not used, so the
site reads most groups from these bases, not from the versioned releases the workflows publish
to R2 ([r2-delivery-contract.md](r2-delivery-contract.md)). The exception is `live`: paths under
its `prefixes` (`job-assistant/`, `LIVE_PREFIXES` in `build_catalog.py`) are resolved through its
`manifest_url`, the active R2 manifest. That group is never committed under `frontend/public/data`,
so it exists only as a release. Use `VITE_DELIVERY_MODE=local` to read a local export instead.

`VITE_DELIVERY_MODE=local` reads everything from `data/`, for development and offline
fixtures. On localhost a missing `delivery.json` is tolerated the same way.

## Adding a delivered file

1. Write it under `frontend/public/data/<product>/`.
2. Run `npm run data:catalog`.
3. Read it by logical path through one of the functions above.
4. Give it to a delivery group in `configs/delivery/`, or leave it to `baseline`.

A directory whose files are read one document at a time goes in `SHARD_DIRECTORIES` in
`build_catalog.py`. The site reads that list from `delivery.json`, so nothing in `src/` changes.

## Validators and remote files

`platform/lib/delivery.py` reads a delivered path from disk when it is there and from the
delivery base when it is not, so the checks in `npm run data:check` keep their full coverage:

- `validate_politics.py` verifies every local file byte for byte, asserts that each absent
  file is a catalogued shard, and reconciles all 1,436 roll-call member totals by fetching the
  decision shards.
- `validate_gold.py` checks all 714 gold source hashes, fetching the ones that moved.

## What moved to R2, and what that cost

On 2026-09-25 the 3,470 document shards (489.1 MB) went to the bucket and left the repository.

| | Before | After |
|---|---|---|
| `frontend/public/data/` files | 4,004 | 536 |
| `frontend/public/data/` size | 652 MB | 158 MB |
| `dist/` | 655 MB | 157 MB |
| Start-page bundle | 433.5 KiB | 332.6 KiB |

The speech index under `discovery/` followed: 140 MB of JSON, one file per session, became
Parquet with one part per session under `parquet/speech_cards/` (39 MB, the same 256,498
rows). `discovery/index.json` stays on the site and lists the parts. JSON served by the site
fell from 221.6 MB to 82.5 MB.

R2 holds the only readily available copy of the shards. `platform/legacy/build_politics.py`
needs three local sources to regenerate them (`--parliament`, `--allegoria`,
`--local-corpus`), and one of those is in no repository. Git history still has the files,
because the move was an ordinary commit.

`platform/publish/upload.py` is the unversioned uploader from that move. No workflow or
delivery group uses it; releases go through `platform/publish/release.py`.

## The bucket's address

`r2.dev` is rate-limited, and the first CI run that read from it got 429s. The production
data domain is `https://data.antonernstsson.com/`, set as the repository variable
`R2_PUBLIC_BASE`. With the variable unset, the catalogue falls back to the `r2.dev` address.
`platform/publish/r2-cors.json` lists the origins allowed to read the bucket; a request with
`Origin: https://antonernstsson.com` comes back with that exact origin. Setting up the domain
is in [deploy.md](deploy.md).
