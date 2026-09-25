# Storage and serving

How data reaches the site, and how to move a file without touching a component.

## The model

| Layer | Holds | Rule |
|---|---|---|
| JSON contracts | KPI cards, chart series, indexes, `delivery.json` | Needed for first paint. Served from the site |
| Document shards | Speech transcripts, decision detail, law provisions | Loaded on demand, one document at a time. Served from object storage |
| Catalogue | Every delivered file, with size and SHA-256 | Generated, never hand-edited |

`scripts/build-catalog.py` writes two files:

- **`public/data/catalog.json`** — one entry per delivered file: `path`, `product`, `format`,
  `bytes`, `rows`, `schema_version`, `partition`, `sha256`, `run_id`. Read by the upload step
  and the validators. The browser never fetches it; at 1.4 MB it is far outside the JSON budget.
- **`public/data/delivery.json`** — 144 bytes: the base URL per format, plus the prefixes that
  mark a path as a shard. This is what the site fetches at startup.

`run_id` is a hash of the catalogued content, not a timestamp, so an unchanged tree rebuilds
byte-identically.

## How the site resolves a path

Components ask for logical paths (`gold/overview.json`), never URLs. `src/dataSource.ts`
fetches `delivery.json` once, decides whether the path is a shard, and prefixes the matching
base. Three entry points:

| Function | Use |
|---|---|
| `fetchData(path, init?)` | any fetch of a data file |
| `useData(path, root)` / `useGoldData(path)` | React hooks in `src/politics/data.ts` |
| `useDataUrl(path)` | a resolved URL for an anchor or download link |

If `delivery.json` is missing or unreadable, everything falls back to `/data/`, which is the
pre-move layout. The site therefore keeps working from a plain checkout with no bucket at all.

Generated files such as `products/datasets.json` still carry `/data/`-rooted paths. The
resolver strips that prefix, so both conventions work.

## Adding a delivered file

1. Write it under `public/data/<product>/`.
2. Run `npm run data:catalog`.
3. Reference it by logical path through one of the three entry points above.

If it belongs in a shard directory, add its prefix to `SHARD_DIRECTORIES` in
`scripts/build-catalog.py`. The site reads that list from `delivery.json`, so nothing in
`src/` changes.

## The shards on R2

Done on 2026-09-25. All 3,470 shards are in the Cloudflare R2 bucket `anton-portfolio`,
served from the public development URL, and removed from this repository. The sequence
below is what was run, and what to rerun after a data rebuild.

**Setup, once.** Create an R2 bucket, enable public read on it, and apply
`scripts/r2-cors.json` (it allows `GET`/`HEAD` with range headers from the site origins —
edit the origins if the site moves). Put `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` and `R2_BUCKET` in GitHub Actions secrets. They are read from the
environment and never written to disk.

1. `npm run data:catalog` — refresh the catalogue.
2. `python scripts/upload-shards.py --dry-run` — confirm the set to transfer: 3,470 files,
   489.1 MB on the first run.
3. `python scripts/upload-shards.py` then `python scripts/upload-shards.py --verify-only`.
   Verify compares every catalogued hash against the object's stored metadata and exits
   non-zero if a single shard is missing or stale.
4. Point `BASES["shard"]` in `scripts/build-catalog.py` at the public bucket URL and rerun
   `npm run data:catalog`. No component changes.
5. Only now remove the shard files from `public/data/`.

After a rebuild that changes shards, steps 1–3 are enough: the upload transfers only files
whose hash differs.

**R2 now holds the only readily available copy of this data.** `scripts/build-politics.py`
needs three external local sources to regenerate the shards (`--parliament`, `--allegoria`,
`--local-corpus`), and one of those is not in any repository. Git history still has them,
because the move was made as an ordinary commit rather than a history rewrite.

Two things about the public development URL. Cloudflare rate-limits `r2.dev` and advises
against relying on it once the site is announced, so move `BASES["shard"]` to a custom domain
before then. It does honour the bucket CORS policy: a request carrying
`Origin: https://korv9.github.io` comes back with that exact origin, not a wildcard.

## How the validators handle remote files

`scripts/delivery.py` reads a delivered path from disk when it is present and from the
delivery base when it is not, so both validators keep their full coverage:

- `validate-politics.py` verifies every local file byte for byte, asserts that each absent
  file is a catalogued shard rather than a silent loss, and still reconciles all 1,436
  roll-call member totals by fetching the decision shards.
- `validate-gold.py` still checks all 714 gold source hashes, fetching the 516 that moved.

The authoritative integrity check for object storage is `upload-shards.py --verify-only`.

## Sizes

Measured 2026-09-25.

| | Before | After |
|---|---|---|
| `public/data/` files | 4,004 | **536** |
| `public/data/` size | 652 MB | **158 MB** |
| `dist/` | 655 MB | **157 MB** |
| Share of the 1 GB Pages limit | 64% | **15%** |
| Start-page bundle | 433.5 KiB | **332.6 KiB** |

The remaining bulk is the 74 MB speech index under `discovery/`. It is a candidate for
Parquet rather than object storage, because the site filters it rather than reading it one
document at a time, and that change would also lift the current one-year-at-a-time search
limit.
